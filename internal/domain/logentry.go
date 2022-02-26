package domain

import "time"

type LogEntry struct {
	Timestamp  time.Time
	Level      Level
	Message    string
	Fields     map[string]interface{}
	Caller     string
	Stacktrace string
}
