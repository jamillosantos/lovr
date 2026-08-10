package entryreader_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/blugelabs/bluge"
	"github.com/iancoleman/orderedmap"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/service/entryreader"
	"github.com/jamillosantos/lovr/internal/service/processors"
)

func TestReader_Search(t *testing.T) {
	ctx := context.Background()

	writer, err := bluge.OpenWriter(bluge.InMemoryOnlyConfig())
	require.NoError(t, err)
	defer func() {
		_ = writer.Close()
	}()

	bluger := processors.NewBluger(writer)
	base := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 3; i++ {
		m := orderedmap.New()
		m.Set("ts", base.Add(time.Duration(i)*time.Second).Format(time.RFC3339))
		m.Set("level", "info")
		m.Set("msg", fmt.Sprintf("message number%d", i))
		m.Set("field1", "value1")
		entry := domain.Entry(*m)
		require.NoError(t, bluger.Process(ctx, &entry))
	}

	reader := entryreader.NewReader(writer, bluger)

	t.Run("should return all entries sorted by timestamp descending", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{})
		require.NoError(t, err)
		assert.Equal(t, int64(3), got.Count)
		require.Len(t, got.Entries, 3)
		assert.Equal(t, "message number2", got.Entries[0].Message)
		assert.Equal(t, "message number0", got.Entries[2].Message)
		assert.Equal(t, []string{"field1"}, got.Entries[0].Fields.Keys())
	})

	t.Run("should return entries since the given time (inclusive) when until is not given", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{Since: base.Add(time.Second)})
		require.NoError(t, err)
		require.Len(t, got.Entries, 2)
		assert.Equal(t, "message number2", got.Entries[0].Message)
		assert.Equal(t, "message number1", got.Entries[1].Message)
	})

	t.Run("should return entries oldest first when ascending", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{Ascending: true})
		require.NoError(t, err)
		require.Len(t, got.Entries, 3)
		assert.Equal(t, "message number0", got.Entries[0].Message)
		assert.Equal(t, "message number2", got.Entries[2].Message)
	})

	t.Run("should filter entries by query", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{Query: "number1"})
		require.NoError(t, err)
		require.Len(t, got.Entries, 1)
		assert.Equal(t, "message number1", got.Entries[0].Message)
	})

	t.Run("should tolerate malformed queries", func(t *testing.T) {
		// The query string parser is lenient and never fails on user input;
		// malformed queries simply match nothing (or whatever it could parse).
		_, err := reader.Search(ctx, entryreader.SearchRequest{Query: "level:(unterminated"})
		assert.NoError(t, err)
	})

	t.Run("should list searchable fields without internal ones", func(t *testing.T) {
		fields, err := reader.Fields(ctx)
		require.NoError(t, err)
		assert.Contains(t, fields, "field1")
		assert.Contains(t, fields, "level")
		assert.Contains(t, fields, "message")
		assert.NotContains(t, fields, "_id")
		assert.NotContains(t, fields, "_all")
		assert.IsIncreasing(t, fields)
	})

	t.Run("should list field values with counts", func(t *testing.T) {
		values, err := reader.FieldValues(ctx, "field1", "", 0)
		require.NoError(t, err)
		require.Len(t, values, 1)
		assert.Equal(t, "value1", values[0].Value)
		assert.Equal(t, uint64(3), values[0].Count)
	})

	t.Run("should filter field values by prefix", func(t *testing.T) {
		values, err := reader.FieldValues(ctx, "message", "Num", 0)
		require.NoError(t, err)
		require.Len(t, values, 3)
		for _, v := range values {
			assert.Contains(t, v.Value, "number")
		}

		values, err = reader.FieldValues(ctx, "message", "nope", 0)
		require.NoError(t, err)
		assert.Empty(t, values)
	})

	t.Run("should return no values for binary-indexed fields", func(t *testing.T) {
		values, err := reader.FieldValues(ctx, "timestamp", "", 0)
		require.NoError(t, err)
		assert.Empty(t, values)
	})
}
