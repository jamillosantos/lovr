package models

import (
	"github.com/iancoleman/orderedmap"

	"github.com/jamillosantos/lovr/internal/domain"
)

func DomainToLogEntries(entries []*domain.LogEntry) []Entry {
	if len(entries) == 0 {
		return nil
	}
	r := make([]Entry, len(entries))
	for i, e := range entries {
		DomainToLogEntry(e, &r[i])
	}
	return r
}

func DomainToLogEntry(e *domain.LogEntry, dst *Entry) {
	*dst = Entry{
		ID:         e.ID,
		Timestamp:  e.Timestamp,
		Level:      e.Level,
		Message:    e.Message,
		Fields:     DomainToLogFields(e.Fields),
		Caller:     e.Caller,
		Stacktrace: e.Stacktrace,
	}
}

func DomainToLogFields(fields orderedmap.OrderedMap) []*Field {
	keys := fields.Keys()
	if len(keys) == 0 {
		return nil
	}
	r := make([]*Field, len(keys))
	for i, k := range keys {
		v, _ := fields.Get(k)
		r[i] = &Field{
			Key:   k,
			Value: v,
		}
	}
	return r
}
