package models

import (
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

func DomainToLogFields(fields []domain.LogField) []*Field {
	if len(fields) == 0 {
		return nil
	}
	r := make([]*Field, len(fields))
	for i, f := range fields {
		r[i] = &Field{
			Key:   f.Key,
			Value: f.Value,
		}
	}
	return r
}
