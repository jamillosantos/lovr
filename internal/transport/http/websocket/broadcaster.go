package websocket

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/logctx"
	"github.com/jamillosantos/lovr/internal/service/entryreader"
	"github.com/jamillosantos/lovr/internal/transport/http/models"
)

const (
	pollInterval = time.Second
	pageSize     = 100
)

type EntriesSearcher interface {
	Search(_ context.Context, _ entryreader.SearchRequest) (entryreader.SearchResponse, error)
}

type WebsSocketConn interface {
	ReadJSON(data interface{}) error
	WriteJSON(data interface{}) error
	Close() error
}

type batchEntries struct {
	Entries []models.Entry `json:"entries,omitempty"`
	Err     string         `json:"err,omitempty"`
}

type Connection struct {
	conn            WebsSocketConn
	writeChannel    chan *batchEntries
	entriesSearcher EntriesSearcher

	fetchQueryM sync.Mutex
	fetchQuery  searchQuery
	queryGen    int

	// queryKick wakes the fetcher when a new client query arrives.
	queryKick chan struct{}
}

// NewConnection creates a new connection.
func NewConnection(conn WebsSocketConn, entriesSearcher EntriesSearcher) *Connection {
	return &Connection{
		conn:            conn,
		entriesSearcher: entriesSearcher,
		writeChannel:    make(chan *batchEntries, 10),
		queryKick:       make(chan struct{}, 1),
	}
}

// Handle starts the goroutines that will handle reading/writing. Also, it initializes the fetching logs agent.
func (c *Connection) Handle(ctx context.Context) {
	var wc sync.WaitGroup

	ctxHandlers, cancelFunc := context.WithCancel(ctx)
	defer cancelFunc()

	// The connection reads/writes have no deadlines, so closing the
	// connection is the only way to unblock them once the context ends.
	watcherDone := make(chan struct{})
	go func() {
		defer close(watcherDone)
		<-ctxHandlers.Done()
		_ = c.conn.Close()
	}()

	wc.Add(3)
	go c.handleReader(ctxHandlers, cancelFunc, &wc)
	go c.handleWriter(ctxHandlers, cancelFunc, &wc)
	go c.entriesFetcher(ctxHandlers, cancelFunc, &wc)

	wc.Wait()
	<-watcherDone
}

// handleReader runs as a goroutine started by Handle. It reads from the websocket connection updating the c.fetchQuery
// that, then, will be used for the next round of fetching.
func (c *Connection) handleReader(ctx context.Context, cancelFunc context.CancelFunc, wg *sync.WaitGroup) {
	defer func() {
		cancelFunc()
		wg.Done()
	}()

	var query searchQuery
	for {
		err := c.conn.ReadJSON(&query)
		if err != nil {
			logctx.Error(ctx, "failed reading message", zap.Error(err))
			return
		}

		c.fetchQueryM.Lock()
		c.fetchQuery = query
		c.queryGen++
		c.fetchQueryM.Unlock()

		select {
		case c.queryKick <- struct{}{}:
		default:
		}

		select {
		case <-ctx.Done():
			return
		default:
		}
	}
}

// handleWriter is a goroutine initialized by Handle. It is responsible for watching the writeChannel for writing
// messages to the client.
func (c *Connection) handleWriter(ctx context.Context, cancelFunc context.CancelFunc, wg *sync.WaitGroup) {
	defer func() {
		cancelFunc()
		wg.Done()
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-c.writeChannel:
			err := c.conn.WriteJSON(msg)
			if err != nil {
				logctx.Error(ctx, "failed writing message", zap.Error(err))
				return
			}
		}
	}
}

// entriesFetcher is a goroutine initialized by Handle. It keeps searching what has been requested by the client,
// advancing a Since watermark so every poll only delivers new entries. All results are sent through the writeChannel.
//
// The first poll of a query (Since zero) returns the newest page as an initial
// snapshot. Subsequent polls page through the window oldest-first so bursts
// larger than one page are drained without losing entries. The window's lower
// bound is inclusive (entries sharing the watermark timestamp may be indexed
// after a poll read it), so the ids already delivered at the watermark are
// tracked and filtered out.
func (c *Connection) entriesFetcher(ctx context.Context, cancelFunc context.CancelFunc, wg *sync.WaitGroup) {
	defer func() {
		cancelFunc()
		wg.Done()
	}()

	// Wait for the first client query: results should always reflect a query
	// the client actually sent.
	select {
	case <-ctx.Done():
		return
	case <-c.queryKick:
	}

	var boundaryIDs map[string]struct{}

	for {
		c.fetchQueryM.Lock()
		query := c.fetchQuery
		gen := c.queryGen
		c.fetchQueryM.Unlock()

		firstPage := query.Since.IsZero()
		if firstPage {
			boundaryIDs = nil
		}

		searchResponse, err := c.entriesSearcher.Search(ctx, entryreader.SearchRequest{
			Since:     query.Since,
			Query:     query.Query,
			PageSize:  pageSize,
			Ascending: !firstPage,
		})
		if err != nil {
			logctx.Error(ctx, "failed fetching information", zap.Error(err))
			if !c.send(ctx, &batchEntries{Err: err.Error()}) {
				return
			}
			if !c.waitNext(ctx) {
				return
			}
			continue
		}

		entries := searchResponse.Entries
		if len(boundaryIDs) > 0 {
			kept := make([]*domain.LogEntry, 0, len(entries))
			for _, e := range entries {
				if _, ok := boundaryIDs[e.ID]; !ok {
					kept = append(kept, e)
				}
			}
			entries = kept
		}

		if len(entries) == 0 {
			if !c.waitNext(ctx) {
				return
			}
			continue
		}

		maxTS := entries[0].Timestamp
		for _, e := range entries[1:] {
			if e.Timestamp.After(maxTS) {
				maxTS = e.Timestamp
			}
		}

		// Only advance the watermark if the client didn't swap the query while
		// this search ran; otherwise these results belong to a stale view.
		c.fetchQueryM.Lock()
		current := c.queryGen == gen
		if current {
			c.fetchQuery.Since = maxTS
		}
		c.fetchQueryM.Unlock()
		if !current {
			continue
		}

		newBoundary := make(map[string]struct{})
		for _, e := range entries {
			if e.Timestamp.Equal(maxTS) {
				newBoundary[e.ID] = struct{}{}
			}
		}
		if maxTS.Equal(query.Since) {
			// No forward progress; keep excluding what was already sent.
			for id := range boundaryIDs {
				newBoundary[id] = struct{}{}
			}
		}
		boundaryIDs = newBoundary

		if !firstPage {
			// Drain pages come oldest-first; the wire format is newest-first.
			for i, j := 0, len(entries)-1; i < j; i, j = i+1, j-1 {
				entries[i], entries[j] = entries[j], entries[i]
			}
		}

		if !c.send(ctx, &batchEntries{Entries: models.DomainToLogEntries(entries)}) {
			return
		}

		if len(searchResponse.Entries) == pageSize {
			// The window may hold more than one page; keep draining.
			continue
		}
		if !c.waitNext(ctx) {
			return
		}
	}
}

// send delivers a batch to the writer goroutine, giving up when the context ends.
func (c *Connection) send(ctx context.Context, batch *batchEntries) bool {
	select {
	case <-ctx.Done():
		return false
	case c.writeChannel <- batch:
		return true
	}
}

// waitNext paces the poll loop, waking up early when a new query arrives.
func (c *Connection) waitNext(ctx context.Context) bool {
	timer := time.NewTimer(pollInterval)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-c.queryKick:
		return true
	case <-timer.C:
		return true
	}
}
