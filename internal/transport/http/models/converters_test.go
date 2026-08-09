package models

import (
	"testing"
	"time"

	"github.com/iancoleman/orderedmap"
	"github.com/stretchr/testify/assert"

	"github.com/jamillosantos/lovr/internal/domain"
)

func Test_domainToLogEntries(t *testing.T) {
	t.Run("should return nil when no entries are provided", func(t *testing.T) {
		assert.Nil(t, DomainToLogEntries([]*domain.LogEntry{}))
	})

	t.Run("should return a list of entries", func(t *testing.T) {
		want1 := Entry{
			Timestamp: time.Now(),
			Level:     domain.LevelError,
			Message:   "message",
		}
		want2 := Entry{
			Timestamp: time.Now(),
			Level:     domain.LevelError,
			Message:   "message 2",
		}
		got := DomainToLogEntries([]*domain.LogEntry{
			{
				Timestamp: want1.Timestamp,
				Level:     want1.Level,
				Message:   want1.Message,
			},
			{
				Timestamp: want2.Timestamp,
				Level:     want2.Level,
				Message:   want2.Message,
			},
		})
		assert.Equal(t, []Entry{
			want1, want2,
		}, got)
	})
}

func Test_domainToLogEntry(t *testing.T) {
	want := Entry{
		Timestamp: time.Now(),
		Level:     domain.LevelError,
		Message:   "message",
		Fields: []*Field{
			{
				Key:   "key1",
				Value: "value1",
			},
		},
		Caller:     "caller",
		Stacktrace: "stacktrace",
	}
	fields := orderedmap.New()
	fields.Set(want.Fields[0].Key, want.Fields[0].Value)
	var got Entry
	DomainToLogEntry(&domain.LogEntry{
		Timestamp:  want.Timestamp,
		Level:      want.Level,
		Message:    want.Message,
		Fields:     *fields,
		Caller:     want.Caller,
		Stacktrace: want.Stacktrace,
	}, &got)
	assert.Equal(t, want, got)
}

func Test_domainToLogFields(t *testing.T) {
	t.Run("should return nil when given empty fields", func(t *testing.T) {
		assert.Nil(t, DomainToLogFields(*orderedmap.New()))
	})

	t.Run("should return a list of fields", func(t *testing.T) {
		fields := orderedmap.New()
		fields.Set("key1", "value1")
		fields.Set("key2", 2)
		got := DomainToLogFields(*fields)
		assert.Equal(t, []*Field{
			{
				Key:   "key1",
				Value: "value1",
			},
			{
				Key:   "key2",
				Value: 2,
			},
		}, got)
	})
}
