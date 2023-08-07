package json

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"

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

func (p *JSONParser) Next() (domain.Entry, error) {
	p.currentLine++
	if !p.s.Scan() {
		return domain.Entry{}, io.EOF
	}
	jsonBytes := p.s.Bytes()

	var data orderedmap.OrderedMap
	if err := json.Unmarshal(jsonBytes, &data); err != nil {
		return domain.Entry{}, fmt.Errorf("%w: invalid JSON at line %d: %s", ErrInvalidEntryFormat, p.currentLine, err.Error())
	}
	return data, nil
}
