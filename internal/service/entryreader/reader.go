package entryreader

import (
	"context"
	"log"
	"time"

	"github.com/blugelabs/bluge"
	"github.com/blugelabs/bluge/search"
	querystr "github.com/blugelabs/query_string"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/service/processors"
)

type BlugeWriter interface {
	Reader() (*bluge.Reader, error)
}

type EntriesCounter interface {
	EntriesCount() int64
}

type BlugeReader interface {
	Search(ctx context.Context, req bluge.SearchRequest) (search.DocumentMatchIterator, error)
	Fields() ([]string, error)
}

type Reader struct {
	blugeWriter    BlugeWriter
	entriesCounter EntriesCounter
}

func NewReader(w BlugeWriter, entriesCounter EntriesCounter) *Reader {
	return &Reader{
		blugeWriter:    w,
		entriesCounter: entriesCounter,
	}
}

type SearchRequest struct {
	Since    time.Time
	Until    time.Time
	Query    string
	PageSize int
}

type SearchResponse struct {
	Count    int64
	Entries  []*domain.LogEntry
	Duration time.Duration
}

func (r *Reader) Search(_ context.Context, req SearchRequest) (SearchResponse, error) {
	blugeReader, err := r.blugeWriter.Reader()
	if err != nil {
		return SearchResponse{}, err
	}

	qs := make([]bluge.Query, 0)
	if !req.Since.IsZero() || !req.Until.IsZero() {
		qs = append(qs, bluge.NewDateRangeInclusiveQuery(req.Since, req.Until, false, false).SetField(processors.FieldTimestamp))
	}
	if req.Query != "" {
		q, err := querystr.ParseQueryString(req.Query, querystr.DefaultOptions())
		if err != nil {
			return SearchResponse{}, err
		}
		qs = append(qs, q)
	}

	var q bluge.Query
	if len(qs) == 0 {
		q = bluge.NewMatchAllQuery()
	} else {
		q = bluge.NewBooleanQuery().AddMust(
			qs...,
		)
	}

	pageSize := req.PageSize
	if pageSize < 15 {
		pageSize = 15
	} else if pageSize > 200 {
		pageSize = 200
	}

	request := bluge.NewTopNSearch(pageSize, q).
		SortBy([]string{"-" + processors.FieldTimestamp}).
		WithStandardAggregations().
		IncludeLocations()
	documentMatchIterator, err := blugeReader.Search(context.Background(), request)
	if err != nil {
		log.Fatalf("error executing search: %v", err)
	}

	entries := make([]*domain.LogEntry, 0)

	match, err := documentMatchIterator.Next()
	for err == nil && match != nil {
		entry := &domain.LogEntry{
			Fields: make([]domain.LogField, 0),
		}
		entries = append(entries, entry)
		err = match.VisitStoredFields(func(field string, value []byte) bool {
			switch field {
			case processors.FieldID:
				entry.ID = string(value)
			case processors.FieldTimestamp:
				v, err := bluge.DecodeDateTime(value)
				if err == nil {
					entry.Timestamp = v
				}
			// TODO What to do when fail parsing the datetime.
			case processors.FieldMessage:
				entry.Message = string(value)
			case processors.FieldLevel:
				entry.Level = domain.Level(value)
			case processors.FieldCaller:
				entry.Caller = string(value)
			case processors.FieldStacktrace:
				entry.Stacktrace = string(value)
			default:
				entry.Fields = append(entry.Fields, domain.LogField{
					Key:   field,
					Value: string(value),
				})
			}
			return true
		})
		if err != nil {
			log.Fatalf("error loading stored fields: %v", err)
		}
		match, err = documentMatchIterator.Next()
	}
	if err != nil {
		log.Fatalf("error iterator document matches: %v", err)
	}

	return SearchResponse{
		Count:    r.entriesCounter.EntriesCount(),
		Duration: documentMatchIterator.Aggregations().Duration(),
		Entries:  entries,
	}, nil
}
