package filters

import "io"

type FilterConstructor func(io.Reader) Filter

var parsers = map[string]FilterConstructor{}

// Register
func Register(key string, parser FilterConstructor) {
	if _, ok := parsers[key]; ok {
		panic("parser already registered: " + key)
	}
	parsers[key] = parser
}

func New(key string, reader io.Reader) Filter {
	newFilter, ok := parsers[key]
	if !ok {
		panic("parser not registered: " + key)
	}
	return newFilter(reader)
}
