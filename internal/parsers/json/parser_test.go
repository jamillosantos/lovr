package json

import (
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJSONParser_Next(t *testing.T) {
	r := strings.NewReader(`{"level":"error","msg":"error message","field1":"value1","field2":2}
{"level":"debug","msg":"error message 2","nested":{"field":"value"}}
this is not a JSON`)
	p, err := NewJSONParser(r)
	require.NoError(t, err)

	entry, err := p.Next()
	require.NoError(t, err)
	assert.Equal(t, []string{"level", "msg", "field1", "field2"}, entry.Keys())
	level, ok := entry.Get("level")
	require.True(t, ok)
	assert.Equal(t, "error", level)
	field2, ok := entry.Get("field2")
	require.True(t, ok)
	assert.Equal(t, float64(2), field2)

	entry, err = p.Next()
	require.NoError(t, err)
	msg, ok := entry.Get("msg")
	require.True(t, ok)
	assert.Equal(t, "error message 2", msg)

	_, err = p.Next()
	require.ErrorIs(t, err, ErrInvalidEntryFormat)

	_, err = p.Next()
	require.ErrorIs(t, err, io.EOF)
}
