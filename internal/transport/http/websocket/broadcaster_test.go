//go:generate go run github.com/golang/mock/mockgen -package=websocket -destination=websocket_mock_test.go . EntriesSearcher,WebsSocketConn
package websocket

import (
	"context"
	"errors"
	"io"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"

	"github.com/jamillosantos/logviewer/internal/domain"
	"github.com/jamillosantos/logviewer/internal/service/entryreader"
	"github.com/jamillosantos/logviewer/internal/transport/http/models"
)

type mocksObj struct {
	entriesSearcher *MockEntriesSearcher
	conn            *MockWebsSocketConn
}

func buildMocks(t *testing.T) mocksObj {
	ctrl := gomock.NewController(t)
	return mocksObj{
		entriesSearcher: NewMockEntriesSearcher(ctrl),
		conn:            NewMockWebsSocketConn(ctrl),
	}
}

func TestConnection_handleReader(t *testing.T) {
	t.Run("should update the fetchQuery when receiving a message", func(t *testing.T) {
		mocks := buildMocks(t)
		ctx, cancelFunc := context.WithCancel(context.Background())
		defer cancelFunc()

		wantQuery := searchQuery{
			Since: time.Now(),
		}

		mocks.conn.EXPECT().ReadJSON(gomock.Any()).Do(func(q interface{}) {
			assert.IsType(t, &searchQuery{}, q)
			query := q.(*searchQuery)
			*query = wantQuery
		}).Return(nil)
		mocks.conn.EXPECT().ReadJSON(gomock.Any()).Return(io.EOF)
		conn := NewConnection(mocks.conn, mocks.entriesSearcher)

		var wg sync.WaitGroup
		wg.Add(1)
		conn.handleReader(ctx, cancelFunc, &wg)

		assert.Equal(t, wantQuery, conn.fetchQuery)
	})

	t.Run("should drop connection when the reading from the socket fails", func(t *testing.T) {
		mocks := buildMocks(t)
		ctx, cancelFunc := context.WithCancel(context.Background())
		defer cancelFunc()

		wantErr := errors.New("random error")

		mocks.conn.EXPECT().ReadJSON(gomock.Any()).Return(wantErr)
		conn := NewConnection(mocks.conn, mocks.entriesSearcher)

		var wg sync.WaitGroup
		wg.Add(1)
		conn.handleReader(ctx, cancelFunc, &wg)
	})

	t.Run("should stop when the given context is done", func(t *testing.T) {
		mocks := buildMocks(t)
		ctx, cancelFunc := context.WithCancel(context.Background())
		defer cancelFunc()

		mocks.conn.EXPECT().ReadJSON(gomock.Any()).Return(nil)
		conn := NewConnection(mocks.conn, mocks.entriesSearcher)

		var wg sync.WaitGroup
		wg.Add(1)
		cancelFunc()
		conn.handleReader(ctx, cancelFunc, &wg)
	})
}

func TestConnection_handleWriter(t *testing.T) {
	t.Run("should write the given message to the connection", func(t *testing.T) {
		mocks := buildMocks(t)
		ctx, cancelFunc := context.WithCancel(context.Background())
		defer cancelFunc()

		wantMsg := &batchEntries{
			Entries: []models.Entry{
				{
					Timestamp: time.Now(),
					Level:     domain.LevelInfo,
					Message:   "Message 1",
				},
			},
		}

		mocks.conn.EXPECT().WriteJSON(wantMsg).Return(nil)
		conn := NewConnection(mocks.conn, mocks.entriesSearcher)

		var wg sync.WaitGroup
		wg.Add(1)
		conn.writeChannel <- wantMsg
		go func() {
			time.Sleep(time.Millisecond * 100)
			cancelFunc()
		}()
		conn.handleWriter(ctx, cancelFunc, &wg)
	})

	t.Run("should drop connection when the reading from the socket fails", func(t *testing.T) {
		mocks := buildMocks(t)
		ctx, cancelFunc := context.WithCancel(context.Background())
		defer cancelFunc()

		wantErr := errors.New("random error")

		mocks.conn.EXPECT().WriteJSON(gomock.Any()).Return(wantErr)
		conn := NewConnection(mocks.conn, mocks.entriesSearcher)

		var wg sync.WaitGroup
		wg.Add(1)
		conn.writeChannel <- &batchEntries{}
		conn.handleWriter(ctx, cancelFunc, &wg)
	})

	t.Run("should stop when the given context is done", func(t *testing.T) {
		mocks := buildMocks(t)
		ctx, cancelFunc := context.WithCancel(context.Background())
		defer cancelFunc()

		conn := NewConnection(mocks.conn, mocks.entriesSearcher)

		var wg sync.WaitGroup
		wg.Add(1)
		cancelFunc()
		conn.handleWriter(ctx, cancelFunc, &wg)
	})
}

func TestConnection_entriesFetcher(t *testing.T) {
	t.Run("should write the given message to the connection", func(t *testing.T) {
		mocks := buildMocks(t)
		ctx, cancelFunc := context.WithCancel(context.Background())
		defer cancelFunc()

		wantLogEntry := &domain.LogEntry{
			Timestamp: time.Now(),
			Level:     domain.LevelError,
			Message:   "Message 1",
		}

		wantSearchQuery := searchQuery{
			Since: time.Now(),
			Query: "query",
		}

		wantBatch := &batchEntries{
			Entries: []models.Entry{
				{
					Timestamp: wantLogEntry.Timestamp,
					Level:     wantLogEntry.Level,
					Message:   wantLogEntry.Message,
				},
			},
		}

		mocks.entriesSearcher.EXPECT().Search(ctx, entryreader.SearchRequest{
			Since: wantSearchQuery.Since,
			Query: wantSearchQuery.Query,
		}).Do(func(context.Context, entryreader.SearchRequest) {
			time.Sleep(time.Millisecond * 200)
		}).Return(entryreader.SearchResponse{
			Entries: []*domain.LogEntry{
				wantLogEntry,
			},
		}, nil)

		conn := NewConnection(mocks.conn, mocks.entriesSearcher)

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			time.Sleep(time.Millisecond * 100)
			cancelFunc()
		}()
		conn.fetchQuery = wantSearchQuery
		conn.entriesFetcher(ctx, cancelFunc, &wg)

		assert.Len(t, conn.writeChannel, 1)
		assert.Equal(t, wantBatch, <-conn.writeChannel)
	})

	t.Run("should not write when entries found are empty", func(t *testing.T) {
		mocks := buildMocks(t)
		ctx, cancelFunc := context.WithCancel(context.Background())
		defer cancelFunc()

		mocks.entriesSearcher.EXPECT().Search(gomock.Any(), gomock.Any()).
			Do(func(context.Context, entryreader.SearchRequest) {
				time.Sleep(time.Millisecond * 200)
			}).
			Return(entryreader.SearchResponse{
				Entries: []*domain.LogEntry{},
			}, nil)

		conn := NewConnection(mocks.conn, mocks.entriesSearcher)

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			time.Sleep(time.Millisecond * 100)
			cancelFunc()
		}()
		conn.entriesFetcher(ctx, cancelFunc, &wg)

		assert.Empty(t, conn.writeChannel)
	})

	t.Run("should write error when searching entries fails", func(t *testing.T) {
		mocks := buildMocks(t)
		ctx, cancelFunc := context.WithCancel(context.Background())
		defer cancelFunc()

		wantErr := errors.New("random error")
		wantBatch := &batchEntries{
			Err: wantErr,
		}

		mocks.entriesSearcher.EXPECT().Search(gomock.Any(), gomock.Any()).
			Do(func(context.Context, entryreader.SearchRequest) {
				time.Sleep(time.Millisecond * 200)
			}).
			Return(entryreader.SearchResponse{}, wantErr)

		conn := NewConnection(mocks.conn, mocks.entriesSearcher)

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			time.Sleep(time.Millisecond * 100)
			cancelFunc()
		}()
		conn.entriesFetcher(ctx, cancelFunc, &wg)

		assert.Len(t, conn.writeChannel, 1)
		assert.Equal(t, wantBatch, <-conn.writeChannel)
	})

	t.Run("should stop when given context is done", func(t *testing.T) {
		mocks := buildMocks(t)
		ctx, cancelFunc := context.WithCancel(context.Background())
		defer cancelFunc()

		conn := NewConnection(mocks.conn, mocks.entriesSearcher)

		var wg sync.WaitGroup
		wg.Add(1)
		cancelFunc()
		conn.entriesFetcher(ctx, cancelFunc, &wg)
		assert.Empty(t, conn.writeChannel)
	})
}

func TestConnection_Handle(t *testing.T) {
	mocks := buildMocks(t)
	ctx, cancelFunc := context.WithCancel(context.Background())
	defer cancelFunc()

	mocks.conn.EXPECT().Close()
	mocks.conn.EXPECT().ReadJSON(gomock.Any())

	conn := NewConnection(mocks.conn, mocks.entriesSearcher)
	cancelFunc()
	conn.Handle(ctx)
}
