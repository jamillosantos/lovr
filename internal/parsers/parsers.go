package parsers

import "io"

type ParserConstructor func(io.Reader) (Parser, error)

var parsers = map[string]ParserConstructor{}

func Register(key string, parser ParserConstructor) {
	if _, ok := parsers[key]; ok {
		panic("parser already registered: " + key)
	}
	parsers[key] = parser
}

func New(key string, r io.Reader) (Parser, error) {
	if parser, ok := parsers[key]; ok {
		return parser(r)
	}
	panic("parser not registered: " + key)
}
