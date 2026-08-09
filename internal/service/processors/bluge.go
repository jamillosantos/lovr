package processors

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/blugelabs/bluge"
	"github.com/blugelabs/bluge/index"
	segment "github.com/blugelabs/bluge_segment_api"
	"github.com/iancoleman/orderedmap"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/ulid"
)

var (
	ErrFieldTypeNotSupported = errors.New("field type not supported")
)

const (
	FieldID         = "_id"
	FieldTimestamp  = "timestamp"
	FieldMessage    = "message"
	FieldLevel      = "level"
	FieldCaller     = "caller"
	FieldStacktrace = "stacktrace"
)

type BlugeWriter interface {
	Update(id segment.Term, doc segment.Document) error
}

type Bluger struct {
	writer       *bluge.Writer
	entriesCount atomic.Int64
}

func NewBluger(writer *bluge.Writer) *Bluger {
	return &Bluger{
		writer: writer,
	}
}

func (s *Bluger) Process(_ context.Context, entry *domain.Entry) error {
	logEntry := mapToLogEntry(entry)

	id, err := ulid.New(logEntry.Timestamp)
	if err != nil {
		return fmt.Errorf("failed creating the entry ID: %w", err)
	}

	fID := bluge.NewTextField(FieldID, id.String())
	fID.FieldOptions = fieldOptions()
	fTimestamp := bluge.NewDateTimeField(FieldTimestamp, logEntry.Timestamp.UTC())
	fTimestamp.FieldOptions = fieldOptions()
	fMessage := bluge.NewTextField(FieldMessage, logEntry.Message)
	fMessage.FieldOptions = fieldOptions()
	fLevel := bluge.NewTextField(FieldLevel, string(logEntry.Level))
	fLevel.FieldOptions = fieldOptions()
	fCaller := bluge.NewTextField(FieldCaller, logEntry.Caller)
	fCaller.FieldOptions = fieldOptions()
	fStacktrace := bluge.NewTextField(FieldStacktrace, logEntry.Stacktrace)
	fStacktrace.FieldOptions = fieldOptions()

	doc := bluge.NewDocument(id.String()).
		AddField(fID).
		AddField(fTimestamp).
		AddField(fMessage).
		AddField(fLevel).
		AddField(fCaller).
		AddField(fStacktrace)

	if err := addFields(doc, "", logEntry.Fields); err != nil {
		return err
	}

	b := index.NewBatch()
	b.Insert(doc)
	err = s.writer.Batch(b)
	if err != nil {
		return err
	}
	s.entriesCount.Add(1)
	return nil
}

// addFields indexes every entry of fields into doc. Nested maps are flattened
// using dot-separated keys (e.g. "a.b").
func addFields(doc *bluge.Document, prefix string, fields orderedmap.OrderedMap) error {
	for _, k := range fields.Keys() {
		v, _ := fields.Get(k)

		key := k
		if prefix != "" {
			key = prefix + "." + k
		}

		var field bluge.Field

		switch vv := v.(type) {
		case orderedmap.OrderedMap:
			if err := addFields(doc, key, vv); err != nil {
				return err
			}
			continue
		case string:
			ff := bluge.NewTextField(key, vv)
			ff.FieldOptions = fieldOptions()
			field = ff
		case []interface{}:
			var value strings.Builder
			for i, vvv := range vv {
				if i > 0 {
					value.WriteString(" ")
				}
				value.WriteString(fmt.Sprint(vvv))
			}
			ff := bluge.NewTextField(key, value.String())
			ff.FieldOptions = fieldOptions()
			field = ff
		case int:
			ff := bluge.NewNumericField(key, float64(vv))
			ff.FieldOptions = fieldOptions()
			field = ff
		case int64:
			ff := bluge.NewNumericField(key, float64(vv))
			ff.FieldOptions = fieldOptions()
			field = ff
		case float64:
			ff := bluge.NewNumericField(key, vv)
			ff.FieldOptions = fieldOptions()
			field = ff
		case bool:
			ff := bluge.NewTextField(key, strconv.FormatBool(vv))
			ff.FieldOptions = fieldOptions()
			field = ff
		default:
			return fmt.Errorf("%w: %s", ErrFieldTypeNotSupported, reflect.TypeOf(v))
		}

		doc.AddField(field)
	}
	return nil
}

func (s *Bluger) EntriesCount() int64 {
	return s.entriesCount.Load()
}

func fieldOptions() bluge.FieldOptions {
	return bluge.Store | bluge.Aggregatable | bluge.Index | bluge.Sortable
}
