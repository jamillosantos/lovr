package entryreader

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/blugelabs/bluge"
	"github.com/blugelabs/bluge/search"
	querystr "github.com/blugelabs/query_string"
	"github.com/iancoleman/orderedmap"

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
	// Ascending returns the oldest matching entries first (used by the live
	// tail to page through a window without losing entries). Default is
	// newest first.
	Ascending bool
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
	defer func() {
		_ = blugeReader.Close()
	}()

	qs := make([]bluge.Query, 0)
	if !req.Since.IsZero() || !req.Until.IsZero() {
		until := req.Until
		if until.IsZero() {
			// bluge encodes timestamps as unix nanoseconds; this is the
			// highest bound it can represent (year 2262).
			until = time.Unix(0, math.MaxInt64)
		}
		// The lower bound is inclusive: entries sharing the boundary
		// timestamp may be indexed after a poll read it, and consumers
		// deduplicate by entry ID.
		qs = append(qs, bluge.NewDateRangeInclusiveQuery(req.Since, until, true, false).SetField(processors.FieldTimestamp))
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

	sortOrder := "-" + processors.FieldTimestamp
	if req.Ascending {
		sortOrder = processors.FieldTimestamp
	}
	request := bluge.NewTopNSearch(pageSize, q).
		SortBy([]string{sortOrder}).
		WithStandardAggregations().
		IncludeLocations()
	documentMatchIterator, err := blugeReader.Search(context.Background(), request)
	if err != nil {
		return SearchResponse{}, fmt.Errorf("error executing search: %w", err)
	}

	entries := make([]*domain.LogEntry, 0)

	match, err := documentMatchIterator.Next()
	for err == nil && match != nil {
		entry := &domain.LogEntry{
			Fields: *orderedmap.New(),
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
				entry.Fields.Set(field, string(value))
			}
			return true
		})
		if err != nil {
			return SearchResponse{}, fmt.Errorf("error loading stored fields: %w", err)
		}
		match, err = documentMatchIterator.Next()
	}
	if err != nil {
		return SearchResponse{}, fmt.Errorf("error iterating document matches: %w", err)
	}

	return SearchResponse{
		Count:    r.entriesCounter.EntriesCount(),
		Duration: documentMatchIterator.Aggregations().Duration(),
		Entries:  entries,
	}, nil
}
