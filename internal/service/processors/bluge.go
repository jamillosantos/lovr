package processors

import (
	"context"
	"fmt"
	"reflect"
	"strconv"

	"github.com/blugelabs/bluge"
	"github.com/blugelabs/bluge/index"
	segment "github.com/blugelabs/bluge_segment_api"
	"go.uber.org/atomic"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/ulid"
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

func (s *Bluger) Process(_ context.Context, entry domain.LogEntry) error {
	id, err := ulid.New(entry.Timestamp)
	if err != nil {
		return fmt.Errorf("failed creating the entry ID: %w", err)
	}

	fID := bluge.NewTextField(FieldID, id.String())
	fID.FieldOptions = fieldOptions()
	fTimestamp := bluge.NewDateTimeField(FieldTimestamp, entry.Timestamp.UTC())
	fTimestamp.FieldOptions = fieldOptions()
	fMessage := bluge.NewTextField(FieldMessage, entry.Message)
	fMessage.FieldOptions = fieldOptions()
	fLevel := bluge.NewTextField(FieldLevel, string(entry.Level))
	fLevel.FieldOptions = fieldOptions()
	fCaller := bluge.NewTextField(FieldCaller, entry.Caller)
	fCaller.FieldOptions = fieldOptions()
	fStacktrace := bluge.NewTextField(FieldStacktrace, entry.Stacktrace)
	fStacktrace.FieldOptions = fieldOptions()

	doc := bluge.NewDocument(id.String()).
		AddField(fID).
		AddField(fTimestamp).
		AddField(fMessage).
		AddField(fLevel).
		AddField(fCaller).
		AddField(fStacktrace)

	for _, f := range entry.Fields {
		var field bluge.Field

		k, v := f.Key, f.Value

		switch vv := v.(type) {
		case string:
			ff := bluge.NewTextField(k, vv)
			ff.FieldOptions = fieldOptions()
			field = ff
		case int:
			ff := bluge.NewNumericField(k, float64(vv))
			ff.FieldOptions = fieldOptions()
			field = ff
		case int64:
			ff := bluge.NewNumericField(k, float64(vv))
			ff.FieldOptions = fieldOptions()
			field = ff
		case float64:
			ff := bluge.NewNumericField(k, vv)
			ff.FieldOptions = fieldOptions()
			field = ff
		case bool:
			ff := bluge.NewTextField(k, strconv.FormatBool(vv))
			ff.FieldOptions = fieldOptions()
			field = ff
		default:
			return fmt.Errorf("field type not supported: %s", reflect.TypeOf(v).Name())
		}

		doc.AddField(field)
	}

	b := index.NewBatch()
	b.Insert(doc)
	err = s.writer.Batch(b)
	if err != nil {
		return err
	}
	s.entriesCount.Inc()
	return nil
}

func (s *Bluger) EntriesCount() int64 {
	return s.entriesCount.Load()
}

func fieldOptions() bluge.FieldOptions {
	return bluge.Store | bluge.Aggregatable | bluge.Index | bluge.Sortable
}
