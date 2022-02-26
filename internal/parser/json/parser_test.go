package json

import (
	"encoding/json"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/jamillosantos/logviewer/internal/domain"
)

var (
	wantEntry = domain.LogEntry{
		Level:   domain.LevelError,
		Message: "error message",
		Fields: map[string]interface{}{
			"field1": "value1",
			"field2": float64(2),
		},
	}
)

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
