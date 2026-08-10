package processors

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/iancoleman/orderedmap"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/ulid"
)

const (
	FieldTimestamp  = "timestamp"
	FieldMessage    = "message"
	FieldLevel      = "level"
	FieldCaller     = "caller"
	FieldStacktrace = "stacktrace"

	// FieldTimestampNanos carries the full-precision timestamp: bleve
	// truncates stored datetime values to seconds.
	FieldTimestampNanos = "timestamp_ns"
)

// NewIndexMapping builds the bleve mapping for log entries: timestamp as a
// real datetime (for range windows and sorting) and level as a keyword (for
// exact matches); everything else is mapped dynamically.
func NewIndexMapping() mapping.IndexMapping {
	doc := bleve.NewDocumentMapping()
	doc.AddFieldMappingsAt(FieldTimestamp, bleve.NewDateTimeFieldMapping())
	doc.AddFieldMappingsAt(FieldLevel, bleve.NewKeywordFieldMapping())

	storedOnly := bleve.NewKeywordFieldMapping()
	storedOnly.Index = false
	storedOnly.IncludeInAll = false
	doc.AddFieldMappingsAt(FieldTimestampNanos, storedOnly)

	m := bleve.NewIndexMapping()
	m.DefaultMapping = doc
	return m
}

// Indexer indexes log entries into a bleve index.
type Indexer struct {
	index bleve.Index
}

func NewIndexer(index bleve.Index) *Indexer {
	return &Indexer{
		index: index,
	}
}

func (s *Indexer) Process(_ context.Context, entry *domain.Entry) error {
	logEntry := mapToLogEntry(entry)
	if logEntry.Timestamp.IsZero() {
		// Entries with a missing/unparseable timestamp would never match the
		// live-tail date-range windows. Fall back to ingestion time.
		logEntry.Timestamp = time.Now()
	}

	id, err := ulid.New(logEntry.Timestamp)
	if err != nil {
		return fmt.Errorf("failed creating the entry ID: %w", err)
	}

	doc := map[string]interface{}{
		FieldTimestamp:      logEntry.Timestamp,
		FieldTimestampNanos: strconv.FormatInt(logEntry.Timestamp.UnixNano(), 10),
		FieldMessage:        logEntry.Message,
		FieldLevel:          string(logEntry.Level),
	}
	if logEntry.Caller != "" {
		doc[FieldCaller] = logEntry.Caller
	}
	if logEntry.Stacktrace != "" {
		doc[FieldStacktrace] = logEntry.Stacktrace
	}
	for _, k := range logEntry.Fields.Keys() {
		v, _ := logEntry.Fields.Get(k)
		doc[k] = normalizeValue(v)
	}

	return s.index.Index(id.String(), doc)
}

// normalizeValue converts orderedmap values (as produced by the JSON parser)
// into plain maps, which bleve indexes as sub-documents with dotted field
// names.
func normalizeValue(v interface{}) interface{} {
	vv, ok := v.(orderedmap.OrderedMap)
	if !ok {
		return v
	}
	m := make(map[string]interface{}, len(vv.Keys()))
	for _, k := range vv.Keys() {
		val, _ := vv.Get(k)
		m[k] = normalizeValue(val)
	}
	return m
}
