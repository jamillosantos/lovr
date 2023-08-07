package processors

import (
	"testing"

	"github.com/iancoleman/orderedmap"
	"github.com/stretchr/testify/require"

	"github.com/jamillosantos/lovr/internal/service"
)

func TestFilter_Process(t *testing.T) {
	t.Run("should process the entry", func(t *testing.T) {
		p, err := NewFilter(`level == "info"`)
		require.NoError(t, err)
		e := orderedmap.New()
		e.Set("level", "info")
		err = p.Process(nil, e)
		require.NoError(t, err)
	})

	t.Run("should fail when an expression does not return a boolean", func(t *testing.T) {
		p, err := NewFilter(`level`)
		require.NoError(t, err)
		e := orderedmap.New()
		e.Set("level", "info")
		err = p.Process(nil, e)
		require.ErrorIs(t, err, ErrFilterExpressionMustReturnBoolean)
	})

	t.Run("should skip entry when criteria does not match", func(t *testing.T) {
		p, err := NewFilter(`level == "info"`)
		require.NoError(t, err)
		e := orderedmap.New()
		e.Set("level", "warning")
		err = p.Process(nil, e)
		require.ErrorIs(t, err, service.ErrSkipEntry)
	})
}
