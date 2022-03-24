package json

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/iancoleman/orderedmap"

	"github.com/jamillosantos/logviewer/internal/domain"
	"github.com/jamillosantos/logviewer/internal/parser"
)

var ErrInvalidEntryFormat = errors.New("invalid error")

type JSONParser struct {
	s *bufio.Scanner
	r io.Reader

	currentLine int
}

const maxBufferSize = 32 * 1024

func NewJSONParser(r io.Reader) (parser.Parser, error) {
	s := bufio.NewScanner(r)
	s.Buffer(make([]byte, maxBufferSize), maxBufferSize) // 32k
	return &JSONParser{
		s: s,
		r: r,
	}, nil
}

func (p *JSONParser) Next() (domain.LogEntry, error) {
	p.currentLine++
	if !p.s.Scan() {
		return domain.LogEntry{}, io.EOF
	}
	jsonBytes := p.s.Bytes()

	var data orderedmap.OrderedMap
	if err := json.Unmarshal(jsonBytes, &data); err != nil {
		return domain.LogEntry{}, fmt.Errorf("%w: invalid JSON at line %d: %s", ErrInvalidEntryFormat, p.currentLine, err.Error())
	}
	return p.mapToLogEntry(&data), nil
}

func (p *JSONParser) mapToLogEntry(inputData *orderedmap.OrderedMap) domain.LogEntry {
	data := orderedmap.New()

	flatten("", inputData, data)

	var (
		ts         time.Time
		msg        string
		level      domain.Level
		caller     string
		stacktrace string
	)
	if m, ok := data.Get("ts"); ok {
		if s, ok := m.(float64); ok {
			seconds := int64(s) // throw away the
			nseconds := int64((s - float64(seconds)) * float64(time.Second))
			ts = time.Unix(seconds, nseconds)
		}
	}
	if s, ok := p.getString(data, "msg"); ok {
		msg = s
	}
	if s, ok := p.getString(data, "level"); ok {
		level = domain.Level(s)
	}
	if s, ok := p.getString(data, "caller"); ok {
		caller = s
	}
	if s, ok := p.getString(data, "stacktrace"); ok {
		stacktrace = s
	}
	data.Delete("ts")
	data.Delete("msg")
	data.Delete("level")
	data.Delete("caller")
	data.Delete("stacktrace")

	keys := data.Keys()
	f := make([]domain.LogField, 0, len(keys))
	for _, k := range keys {
		v, _ := data.Get(k)
		f = append(f, domain.LogField{
			Key:   k,
			Value: v,
		})
	}

	return domain.LogEntry{
		Timestamp:  ts,
		Level:      level,
		Message:    msg,
		Fields:     f,
		Caller:     caller,
		Stacktrace: stacktrace,
	}

}

func flatten(prefix string, data, dest *orderedmap.OrderedMap) {
	keys := data.Keys()
	for _, k := range keys {
		v, ok := data.Get(k)
		if !ok {
			continue
		}
		switch vv := v.(type) {
		case orderedmap.OrderedMap:
			flatten(prefix+k+".", &vv, dest)
		case *orderedmap.OrderedMap:
			flatten(prefix+k+".", vv, dest)
		default:
			dest.Set(prefix+k, vv)
		}
	}
}

func (p *JSONParser) getString(m *orderedmap.OrderedMap, s string) (string, bool) {
	if m, ok := m.Get(s); ok {
		if s, ok := m.(string); ok {
			return s, true
		}
	}
	return "", false
}
