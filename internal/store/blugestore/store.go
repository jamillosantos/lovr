package blugestore

import (
	"context"
	"fmt"
	"reflect"
	"strconv"

	"github.com/blugelabs/bluge"
	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/jamillosantos/logviewer/internal/domain"
	"github.com/jamillosantos/logviewer/internal/ulid"
)

type BlugeWriter interface {
	Update(id segment.Term, doc segment.Document) error
}

type Store struct {
	writer BlugeWriter
}

func New(writer BlugeWriter) *Store {
	return &Store{
		writer: writer,
	}
}

func (s *Store) Add(_ context.Context, entry domain.LogEntry) error {
	id, err := ulid.New()
	if err != nil {
		return fmt.Errorf("failed creating the entry ID: %w", err)
	}

	doc := bluge.NewDocument(id.String()).
		AddField(bluge.NewTextField("$id", id.String())).
		AddField(bluge.NewTextField("message", entry.Message)).
		AddField(bluge.NewTextField("level", string(entry.Level))).
		AddField(bluge.NewTextField("caller", entry.Caller)).
		AddField(bluge.NewTextField("stacktrace", entry.Stacktrace))

	for k, v := range entry.Fields {
		var field bluge.Field

		switch vv := v.(type) {
		case string:
			field = bluge.NewTextField(k, vv)
		case int:
			field = bluge.NewNumericField(k, float64(vv))
		case int64:
			field = bluge.NewNumericField(k, float64(vv))
		case float64:
			field = bluge.NewNumericField(k, vv)
		case bool:
			field = bluge.NewTextField(k, strconv.FormatBool(vv))
		default:
			return fmt.Errorf("field type not supported: %s", reflect.TypeOf(v).Name())
		}

		doc = doc.AddField(field)
	}

	return s.writer.Update(doc.ID(), doc)
}
