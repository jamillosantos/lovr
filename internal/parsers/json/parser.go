package json

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/iancoleman/orderedmap"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/parsers"
)

var ErrInvalidEntryFormat = errors.New("invalid error")

type JSONParser struct {
	s *bufio.Scanner
	r io.Reader

	currentLine int
}

const maxBufferSize = 32 * 1024

func init() {
	parsers.Register("json", NewJSONParser)
}

func NewJSONParser(r io.Reader) (parsers.Parser, error) {
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
	var (
		ts         time.Time
		msg        string
		level      domain.Level
		caller     string
		stacktrace string
	)
	if m, ok := getTS(inputData); ok {
		ts = parseTS(m)
	}
	if s, ok := p.getString(inputData, "msg"); ok {
		msg = s
	}
	if s, ok := p.getString(inputData, "level"); ok {
		level = domain.Level(s)
	}
	if s, ok := p.getString(inputData, "caller"); ok {
		caller = s
	}
	if s, ok := p.getString(inputData, "stacktrace"); ok {
		stacktrace = s
	}
	inputData.Delete("ts")
	inputData.Delete("msg")
	inputData.Delete("level")
	inputData.Delete("caller")
	inputData.Delete("stacktrace")

	f := buildFieldsFromMap(inputData)

	return domain.LogEntry{
		Timestamp:  ts,
		Level:      level,
		Message:    msg,
		Fields:     f,
		Caller:     caller,
		Stacktrace: stacktrace,
	}

}

func buildFieldsFromMap(data *orderedmap.OrderedMap) []domain.LogField {
	keys := data.Keys()
	fields := make([]domain.LogField, 0, len(keys))
	for _, k := range keys {
		v, _ := data.Get(k)
		lf := domain.LogField{
			Key:   k,
			Value: v,
		}

		switch vv := v.(type) {
		case orderedmap.OrderedMap:
			lf.Value = buildFieldsFromMap(&vv)
		case *orderedmap.OrderedMap:
			lf.Value = buildFieldsFromMap(vv)
		}

		fields = append(fields, lf)
	}
	return fields
}

func parseTS(m interface{}) time.Time {
	switch m := m.(type) {
	case string:
		return parseTSString(m)
	case float64:
		seconds := int64(m) // throw away the
		nseconds := int64((m - float64(seconds)) * float64(time.Second))
		return time.Unix(seconds, nseconds)
	default:
		return time.Time{}
	}
}

var tsFormats = []string{time.Layout, time.ANSIC, time.UnixDate, time.RubyDate, time.RFC822, time.RFC822Z, time.RFC850,
	time.RFC1123, time.RFC1123Z, time.RFC3339, time.RFC3339Nano, time.Stamp, time.StampMilli, time.StampMicro,
	time.StampNano}

func parseTSString(m string) time.Time {
	for _, f := range tsFormats {
		if t, err := time.Parse(f, m); err == nil {
			return t
		}
	}
	return time.Time{}
}

var timestampKeys = []string{"timestamp", "@timestamp", "ts", "time", "date", "datetime"}

func getTS(data *orderedmap.OrderedMap) (interface{}, bool) {
	for _, k := range timestampKeys {
		if v, ok := data.Get(k); ok {
			return v, true
		}
	}
	return nil, false
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
