package domain

import (
	"time"

	"github.com/iancoleman/orderedmap"
)

type LogField struct {
	Key   string
	Value interface{}
}

type Entry = orderedmap.OrderedMap

type LogEntry struct {
	ID         string
	Timestamp  time.Time
	Level      Level
	Message    string
	Fields     orderedmap.OrderedMap
	Caller     string
	Stacktrace string
}
