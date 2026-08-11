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

func TestReader_Histogram(t *testing.T) {
	ctx := context.Background()

	index, err := bleve.NewMemOnly(processors.NewIndexMapping())
	require.NoError(t, err)
	defer func() {
		_ = index.Close()
	}()

	indexer := processors.NewIndexer(index)
	base := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	// 40 entries over 40 minutes: minute 0-19 info, 20-39 alternating
	// error/info.
	for i := 0; i < 40; i++ {
		level := "info"
		if i >= 20 && i%2 == 0 {
			level = "error"
		}
		m := orderedmap.New()
		m.Set("ts", base.Add(time.Duration(i)*time.Minute).Format(time.RFC3339))
		m.Set("level", level)
		m.Set("msg", fmt.Sprintf("m%d", i))
		entry := domain.Entry(*m)
		require.NoError(t, indexer.Process(ctx, &entry))
	}

	reader := entryreader.NewReader(index)

	t.Run("should bucket counts grouped by level", func(t *testing.T) {
		res, err := reader.Histogram(ctx, entryreader.HistogramRequest{
			Since:   base,
			Until:   base.Add(40 * time.Minute),
			Buckets: 4,
			GroupBy: "level",
		})
		require.NoError(t, err)
		assert.Equal(t, []string{"info", "error"}, res.Groups)
		require.Len(t, res.Buckets, 4)

		total := map[string]int{}
		for _, b := range res.Buckets {
			for g, c := range b.Counts {
				total[g] += c
			}
		}
		assert.Equal(t, 30, total["info"])
		assert.Equal(t, 10, total["error"])

		// First half is info only.
		assert.Zero(t, res.Buckets[0].Counts["error"])
		assert.Zero(t, res.Buckets[1].Counts["error"])
		assert.Positive(t, res.Buckets[2].Counts["error"])
	})

	t.Run("should resolve the window from the data when no range is given", func(t *testing.T) {
		res, err := reader.Histogram(ctx, entryreader.HistogramRequest{
			Buckets: 10,
			GroupBy: "level",
		})
		require.NoError(t, err)
		assert.Equal(t, base, res.Start)
		assert.True(t, res.End.After(base.Add(39*time.Minute)))

		total := 0
		for _, b := range res.Buckets {
			for _, c := range b.Counts {
				total += c
			}
		}
		assert.Equal(t, 40, total)
	})

	t.Run("should respect the query", func(t *testing.T) {
		res, err := reader.Histogram(ctx, entryreader.HistogramRequest{
			Query:   "level:error",
			Buckets: 5,
			GroupBy: "level",
		})
		require.NoError(t, err)
		assert.Equal(t, []string{"error"}, res.Groups)

		total := 0
		for _, b := range res.Buckets {
			total += b.Counts["error"]
		}
		assert.Equal(t, 10, total)
	})

	t.Run("should count everything as one group without groupBy", func(t *testing.T) {
		res, err := reader.Histogram(ctx, entryreader.HistogramRequest{Buckets: 2})
		require.NoError(t, err)
		assert.Equal(t, []string{"all"}, res.Groups)
		total := 0
		for _, b := range res.Buckets {
			total += b.Counts["all"]
		}
		assert.Equal(t, 40, total)
	})

	t.Run("should return empty for an empty result set", func(t *testing.T) {
		res, err := reader.Histogram(ctx, entryreader.HistogramRequest{
			Query:   "level:nope",
			GroupBy: "level",
		})
		require.NoError(t, err)
		assert.Empty(t, res.Groups)
	})
}
