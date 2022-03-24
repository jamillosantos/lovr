package domain

import "time"

type LogField struct {
	Key   string
	Value interface{}
}

type LogEntry struct {
	ID         string
	Timestamp  time.Time
	Level      Level
	Message    string
	Fields     []LogField
	Caller     string
	Stacktrace string
}
