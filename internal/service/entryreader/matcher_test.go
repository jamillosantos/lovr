package entryreader_test

import (
	"context"
	"testing"

	"github.com/iancoleman/orderedmap"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/service/entryreader"
)

func matcherEntry(pairs ...string) *domain.Entry {
	m := orderedmap.New()
	for i := 0; i+1 < len(pairs); i += 2 {
		m.Set(pairs[i], pairs[i+1])
	}
	entry := domain.Entry(*m)
	return &entry
}

func TestMatcher_Match(t *testing.T) {
	ctx := context.Background()

	errEntry := matcherEntry(
		"level", "error",
		"msg", "connection timeout on upstream",
		"route", "/api/v1/login",
		"service", "api-gateway",
	)
	infoEntry := matcherEntry(
		"level", "info",
		"msg", "request served",
		"route", "/api/v1/users",
		"service", "worker",
	)

	tests := []struct {
		name  string
		query string
		entry *domain.Entry
		want  bool
	}{
		{"field match", "level:error", errEntry, true},
		{"field mismatch", "level:error", infoEntry, false},
		{"implicit AND matches", "level:error route:/api/v1/login", errEntry, true},
		{"implicit AND rejects partial", "level:error route:/api/v1/users", errEntry, false},
		{"OR matches either side", "level:fatal OR level:error", errEntry, true},
		{"OR rejects when neither side", "level:fatal OR level:warn", errEntry, false},
		{"parentheses precedence", "service:api-gateway (level:fatal OR level:error)", errEntry, true},
		{"value list", "level:(fatal OR error)", errEntry, true},
		{"value list rejects", "level:(fatal OR warn)", errEntry, false},
		{"wildcard", "service:api*", errEntry, true},
		{"wildcard rejects", "service:api*", infoEntry, false},
		{"bare term hits message", "timeout", errEntry, true},
		{"bare term rejects", "timeout", infoEntry, false},
		{"negation", "-level:error", infoEntry, true},
		{"negation rejects", "-level:error", errEntry, false},
		{"exists", "_exists_:route", errEntry, true},
		{"exists rejects", "_exists_:stacktrace", errEntry, false},
		{"quoted phrase", `message:"connection timeout"`, errEntry, true},
		{"empty query matches everything", "", infoEntry, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, err := entryreader.NewMatcher(tt.query)
			require.NoError(t, err)
			defer func() {
				_ = m.Close()
			}()
			got, err := m.Match(ctx, tt.entry)
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}

	t.Run("matcher is reusable across entries", func(t *testing.T) {
		m, err := entryreader.NewMatcher("level:error")
		require.NoError(t, err)
		defer func() {
			_ = m.Close()
		}()
		for i := 0; i < 3; i++ {
			got, err := m.Match(ctx, errEntry)
			require.NoError(t, err)
			assert.True(t, got)
			got, err = m.Match(ctx, infoEntry)
			require.NoError(t, err)
			assert.False(t, got)
		}
	})

	t.Run("invalid query fails at construction", func(t *testing.T) {
		_, err := entryreader.NewMatcher("level:(error")
		require.Error(t, err)
	})
}
