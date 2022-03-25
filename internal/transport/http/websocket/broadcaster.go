package websocket

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/jamillosantos/lovr/internal/logctx"
	"github.com/jamillosantos/lovr/internal/service/entryreader"
	"github.com/jamillosantos/lovr/internal/transport/http/models"
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
	Err     error          `json:"err,omitempty"`
}

type Connection struct {
	conn            WebsSocketConn
	writeChannel    chan *batchEntries
	entriesSearcher EntriesSearcher

	fetchQueryM sync.Mutex
	fetchQuery  searchQuery
}

// NewConnection creates a new connection.
func NewConnection(conn WebsSocketConn, entriesSearcher EntriesSearcher) *Connection {
	return &Connection{
		conn:            conn,
		entriesSearcher: entriesSearcher,
		writeChannel:    make(chan *batchEntries, 10),
	}
}

// Handle starts the goroutines that will handle reading/writing. Also, it initializes the fetching logs agent.
func (c *Connection) Handle(ctx context.Context) {
	defer func() {
		_ = c.conn.Close()
	}()
	var wc sync.WaitGroup

	ctxHandlers, cancelFunc := context.WithCancel(ctx)

	wc.Add(3)
	go c.handleReader(ctxHandlers, cancelFunc, &wc)
	go c.handleWriter(ctxHandlers, cancelFunc, &wc)
	go c.entriesFetcher(ctxHandlers, cancelFunc, &wc)

	wc.Wait()
	<-ctxHandlers.Done()
	close(c.writeChannel)
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
		c.fetchQueryM.Unlock()

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

// entriesFetcher is a goroutine initialized by Handle. It will keep searching what has been requested by the client
// and will try matching what was found from the last search. All results found will be sent through the writeChannel.
func (c *Connection) entriesFetcher(ctx context.Context, cancelFunc context.CancelFunc, wg *sync.WaitGroup) {
	defer func() {
		cancelFunc()
		wg.Done()
	}()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		searchResponse, err := c.entriesSearcher.Search(ctx, queryToSearchRequest(c.fetchQuery))
		if err != nil {
			c.writeChannel <- &batchEntries{
				Err: err,
			}
			logctx.Error(ctx, "failed fetching information", zap.Error(err))
			continue
		}

		if len(searchResponse.Entries) == 0 {
			continue
		}

		// Update the `Since` for next search match only new entries.
		c.fetchQueryM.Lock()
		c.fetchQuery.Since = searchResponse.Entries[len(searchResponse.Entries)-1].Timestamp
		c.fetchQueryM.Unlock()

		c.writeChannel <- &batchEntries{
			Entries: models.DomainToLogEntries(searchResponse.Entries),
		}
		time.Sleep(time.Second)
	}
}

// queryToSearchRequest converts a searchQuery to a searchRequest to be passed to the EntriesSearcher.
func queryToSearchRequest(q searchQuery) entryreader.SearchRequest {
	return entryreader.SearchRequest{
		Since: q.Since,
		Query: q.Query,
	}
}
