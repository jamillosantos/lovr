package models

import (
	"time"

	"github.com/jamillosantos/logviewer/internal/domain"
	"github.com/jamillosantos/logviewer/internal/service/entryreader"
)

type Entry struct {
	ID         string       `json:"$id"`
	Timestamp  time.Time    `json:"timestamp"`
	Level      domain.Level `json:"level"`
	Message    string       `json:"message"`
	Fields     []*Field     `json:"fields,omitempty"`
	Caller     string       `json:"caller,omitempty"`
	Stacktrace string       `json:"stacktrace,omitempty"`
}

type Field struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}

type SearchResponse struct {
	Count   int64   `json:"count"`
	Entries []Entry `json:"entries"`
}

func MapSearchResponse(response entryreader.SearchResponse) SearchResponse {
	return SearchResponse{
		Count:   response.Count,
		Entries: DomainToLogEntries(response.Entries),
	}
}
