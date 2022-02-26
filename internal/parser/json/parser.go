package json

import (
	"bufio"
	"encoding/json"
	"io"
	"time"

	"github.com/jeremywohl/flatten/v2"

	"github.com/jamillosantos/logviewer/internal/domain"
	"github.com/jamillosantos/logviewer/internal/parser"
)

type JSONParser struct {
	s *bufio.Scanner
	r io.Reader
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
	if !p.s.Scan() {
		return domain.LogEntry{}, io.EOF
	}
	jsonBytes := p.s.Bytes()
	data := make(map[string]interface{})
	err := json.Unmarshal(jsonBytes, &data)
	if err != nil {
		return domain.LogEntry{}, err
	}
	return p.mapToLogEntry(data)
}

func (p *JSONParser) mapToLogEntry(data map[string]interface{}) (domain.LogEntry, error) {
	m, err := flatten.Flatten(data, "", flatten.DotStyle)
	if err != nil {
		return domain.LogEntry{}, nil
	}
	var (
		ts         time.Time
		msg        string
		level      domain.Level
		caller     string
		stacktrace string
	)
	if m, ok := m["ts"]; ok {
		if s, ok := m.(float64); ok {
			seconds := int64(s) // throw away the
			nseconds := int64((s - float64(seconds)) * float64(time.Second))
			ts = time.Unix(seconds, nseconds)
		}
	}
	if s, ok := p.getString(m, "msg"); ok {
		msg = s
	}
	if s, ok := p.getString(m, "level"); ok {
		level = domain.Level(s)
	}
	if s, ok := p.getString(m, "caller"); ok {
		caller = s
	}
	if s, ok := p.getString(m, "stacktrace"); ok {
		stacktrace = s
	}
	delete(m, "ts")
	delete(m, "msg")
	delete(m, "level")
	delete(m, "caller")
	delete(m, "stacktrace")
	return domain.LogEntry{
		Timestamp:  ts,
		Level:      level,
		Message:    msg,
		Fields:     m,
		Caller:     caller,
		Stacktrace: stacktrace,
	}, nil

}

func (p *JSONParser) getString(m map[string]interface{}, s string) (string, bool) {
	if m, ok := m[s]; ok {
		if s, ok := m.(string); ok {
			return s, true
		}
	}
	return "", false
}
