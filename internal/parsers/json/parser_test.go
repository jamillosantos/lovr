package json

import (
	"encoding/json"
	"testing"

	"github.com/iancoleman/orderedmap"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/jamillosantos/lovr/internal/domain"
)

var (
	wantEntry = domain.LogEntry{
		Level:   domain.LevelError,
		Message: "error message",
		Fields: []domain.LogField{
			{"field1", "value1"},
			{"field2", float64(2)},
		},
	}
)

/*
func TestJSONParser_mapToLogEntry(t *testing.T) {
	p := &JSONParser{}
	givenMap := map[string]interface{}{
		"level":  string(wantEntry.Level),
		"msg":    wantEntry.Message,
		"field1": wantEntry.Fields["field1"],
		"field2": wantEntry.Fields["field2"],
	}
	gotEntry, err := p.mapToLogEntry(givenMap)
	assert.NoError(t, err)
	assert.Equal(t, wantEntry, gotEntry)
}

func TestJSONParser_Next(t *testing.T) {

	wantEntry2 := domain.LogEntry{
		Level:   domain.LevelDebug,
		Message: "error message 2",
		Fields: map[string]interface{}{
			"field2.1": "value1",
			"field2.2": float64(2),
		},
	}

	r := strings.NewReader(`{"level":"error","msg":"error message","field1":"value1","field2":2}
{"level":"debug","msg":"error message 2","field2.1":"value1","field2.2":2}
this is not a JSON`)
	p, err := NewJSONParser(r)
	require.NoError(t, err)

	gotEntry, err := p.Next()
	assert.NoError(t, err)
	assert.Equal(t, wantEntry, gotEntry)

	gotEntry, err = p.Next()
	assert.NoError(t, err)
	assert.Equal(t, wantEntry2, gotEntry)

	gotEntry, err = p.Next()
	assert.ErrorAs(t, err, &json.SyntaxError{})
	assert.Equal(t, wantEntry2, gotEntry)

	_, err = p.Next()
	assert.ErrorIs(t, err, io.EOF)
}
*/

func Test_flatten(t *testing.T) {
	jsonBytes := []byte(`{
	"a": {
		"b": "value a.b",
		"c": 1
	},
	"b": "value b",
	"c": {
		"a": "value c.a",
		"b": "value c.b"
	}
}`)
	o := orderedmap.New()
	dst := orderedmap.New()
	err := json.Unmarshal(jsonBytes, o)
	require.NoError(t, err)

	flatten("", o, dst)

	v, ok := dst.Get("a.b")
	require.True(t, ok)
	assert.Equal(t, v, "value a.b")

	v, ok = dst.Get("a.c")
	require.True(t, ok)
	assert.Equal(t, v, float64(1))

	v, ok = dst.Get("b")
	require.True(t, ok)
	assert.Equal(t, v, "value b")

	v, ok = dst.Get("c.a")
	require.True(t, ok)
	assert.Equal(t, v, "value c.a")

	v, ok = dst.Get("c.b")
	require.True(t, ok)
	assert.Equal(t, v, "value c.b")
}
