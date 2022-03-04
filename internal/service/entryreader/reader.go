package entryreader

import (
	"context"
	"log"
	"time"

	"github.com/blugelabs/bluge"
	"github.com/blugelabs/bluge/search"

	"github.com/jamillosantos/logviewer/internal/domain"
	"github.com/jamillosantos/logviewer/internal/service/processors"
)

type BlugeWriter interface {
	Reader() (*bluge.Reader, error)
}

type BlugeReader interface {
	Count() (count uint64, err error)
	Search(ctx context.Context, req bluge.SearchRequest) (search.DocumentMatchIterator, error)
	Fields() ([]string, error)
}

type Reader struct {
	blugeWriter BlugeWriter
}

func NewReader(w BlugeWriter) *Reader {
	return &Reader{
		blugeWriter: w,
	}
}

type SearchRequest struct {
}

type SearchResponse struct {
	Count    uint64
	Entries  []*domain.LogEntry
	Duration time.Duration
}

func (r *Reader) Search(_ context.Context, _ SearchRequest) (SearchResponse, error) {
	blugeReader, err := r.blugeWriter.Reader()
	if err != nil {
		return SearchResponse{}, err
	}

	query := bluge.NewMatchAllQuery()
	request := bluge.NewAllMatches(query).
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
		Count:    documentMatchIterator.Aggregations().Count(),
		Duration: documentMatchIterator.Aggregations().Duration(),
		Entries:  entries,
	}, nil
}
