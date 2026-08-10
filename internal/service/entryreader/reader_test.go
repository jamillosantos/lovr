package entryreader_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/iancoleman/orderedmap"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/service/entryreader"
	"github.com/jamillosantos/lovr/internal/service/processors"
)

func TestReader_Search(t *testing.T) {
	ctx := context.Background()

	index, err := bleve.NewMemOnly(processors.NewIndexMapping())
	require.NoError(t, err)
	defer func() {
		_ = index.Close()
	}()

	indexer := processors.NewIndexer(index)
	base := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	levels := []string{"info", "error", "info"}
	routes := []string{"/api/v1/users", "/api/v1/login", "/api/v1/login"}
	for i := 0; i < 3; i++ {
		m := orderedmap.New()
		m.Set("ts", base.Add(time.Duration(i)*time.Second).Format(time.RFC3339))
		m.Set("level", levels[i])
		m.Set("msg", fmt.Sprintf("message number%d", i))
		m.Set("field1", "value1")
		m.Set("route", routes[i])
		entry := domain.Entry(*m)
		require.NoError(t, indexer.Process(ctx, &entry))
	}

	reader := entryreader.NewReader(index)

	t.Run("should return all entries sorted by timestamp descending", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{})
		require.NoError(t, err)
		assert.Equal(t, int64(3), got.Count)
		require.Len(t, got.Entries, 3)
		assert.Equal(t, "message number2", got.Entries[0].Message)
		assert.Equal(t, "message number0", got.Entries[2].Message)
		fields := got.Entries[0].Fields.Keys()
		assert.Contains(t, fields, "field1")
		assert.Contains(t, fields, "route")
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

	t.Run("should combine bare terms with AND semantics", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{
			Query: "level:info route:/api/v1/login",
		})
		require.NoError(t, err)
		require.Len(t, got.Entries, 1)
		assert.Equal(t, "message number2", got.Entries[0].Message)
		assert.Equal(t, domain.Level("info"), got.Entries[0].Level)
	})

	t.Run("should require every token of a multi-token value", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{
			Query: "route:/api/v1/login",
		})
		require.NoError(t, err)
		require.Len(t, got.Entries, 2)
		for _, e := range got.Entries {
			v, _ := e.Fields.Get("route")
			assert.Equal(t, "/api/v1/login", v)
		}
	})

	t.Run("should keep explicit exclusions working", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{
			Query: "route:/api/v1/login -level:error",
		})
		require.NoError(t, err)
		require.Len(t, got.Entries, 1)
		assert.Equal(t, "message number2", got.Entries[0].Message)
	})

	t.Run("should fail on an invalid query", func(t *testing.T) {
		_, err := reader.Search(ctx, entryreader.SearchRequest{Query: `level:"unterminated`})
		assert.Error(t, err)
	})

	t.Run("should match substrings inside terms with wildcards", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{Query: "message:*umber1*"})
		require.NoError(t, err)
		require.Len(t, got.Entries, 1)
		assert.Equal(t, "message number1", got.Entries[0].Message)
	})

	t.Run("should combine wildcards with regular terms (AND)", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{
			Query: "level:info message:*umber*",
		})
		require.NoError(t, err)
		require.Len(t, got.Entries, 2)
		for _, e := range got.Entries {
			assert.Equal(t, domain.Level("info"), e.Level)
		}
	})

	t.Run("should support negated wildcards", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{
			Query: "field1:value1 -message:*umber1*",
		})
		require.NoError(t, err)
		require.Len(t, got.Entries, 2)
		for _, e := range got.Entries {
			assert.NotEqual(t, "message number1", e.Message)
		}
	})

	t.Run("should support unfielded wildcards", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{Query: "*umber2*"})
		require.NoError(t, err)
		require.Len(t, got.Entries, 1)
		assert.Equal(t, "message number2", got.Entries[0].Message)
	})

	t.Run("should list entries having a key via _exists_", func(t *testing.T) {
		got, err := reader.Search(ctx, entryreader.SearchRequest{Query: "_exists_:route"})
		require.NoError(t, err)
		assert.Len(t, got.Entries, 3)

		got, err = reader.Search(ctx, entryreader.SearchRequest{Query: "_exists_:nope"})
		require.NoError(t, err)
		assert.Empty(t, got.Entries)

		// Negated: entries without the key.
		got, err = reader.Search(ctx, entryreader.SearchRequest{
			Query: "field1:value1 -_exists_:nope",
		})
		require.NoError(t, err)
		assert.Len(t, got.Entries, 3)
	})

	t.Run("should list searchable fields without internal ones", func(t *testing.T) {
		fields, err := reader.Fields(ctx)
		require.NoError(t, err)
		assert.Contains(t, fields, "field1")
		assert.Contains(t, fields, "level")
		assert.Contains(t, fields, "message")
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
		values, err := reader.FieldValues(ctx, "message", "num", 0)
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
