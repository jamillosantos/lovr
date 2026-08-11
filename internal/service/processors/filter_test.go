package processors

import (
	"context"
	"errors"
	"testing"

	"github.com/iancoleman/orderedmap"
	"github.com/stretchr/testify/require"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/service"
)

type fakeMatcher struct {
	result bool
	err    error
}

func (f fakeMatcher) Match(_ context.Context, _ *domain.Entry) (bool, error) {
	return f.result, f.err
}

func TestFilter_Process(t *testing.T) {
	entry := orderedmap.New()
	entry.Set("level", "info")

	t.Run("should pass a matching entry through", func(t *testing.T) {
		p := NewFilter(fakeMatcher{result: true})
		require.NoError(t, p.Process(context.Background(), entry))
	})

	t.Run("should skip a non-matching entry", func(t *testing.T) {
		p := NewFilter(fakeMatcher{result: false})
		err := p.Process(context.Background(), entry)
		require.ErrorIs(t, err, service.ErrSkipEntry)
	})

	t.Run("should propagate matcher errors", func(t *testing.T) {
		wantErr := errors.New("boom")
		p := NewFilter(fakeMatcher{err: wantErr})
		err := p.Process(context.Background(), entry)
		require.ErrorIs(t, err, wantErr)
	})
}
