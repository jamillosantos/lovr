package processors

import (
	"testing"

	"github.com/iancoleman/orderedmap"
	"github.com/stretchr/testify/assert"
)

func Test_mapToLogEntry(t *testing.T) {
	newInput := func() *orderedmap.OrderedMap {
		m := orderedmap.New()
		m.Set("ts", "2026-01-01T12:00:00Z")
		m.Set("level", "error")
		m.Set("msg", "hello")
		m.Set("field1", "value1")
		return m
	}

	t.Run("should extract the well-known keys leaving the rest as fields", func(t *testing.T) {
		got := mapToLogEntry(newInput())
		assert.Equal(t, "hello", got.Message)
		assert.Equal(t, "error", string(got.Level))
		assert.Equal(t, 2026, got.Timestamp.Year())
		assert.Equal(t, []string{"field1"}, got.Fields.Keys())
	})

	t.Run("should not mutate the input entry", func(t *testing.T) {
		m := newInput()
		got1 := mapToLogEntry(m)
		got2 := mapToLogEntry(m)
		assert.Equal(t, got1, got2)
		assert.Equal(t, []string{"ts", "level", "msg", "field1"}, m.Keys())
	})
}
