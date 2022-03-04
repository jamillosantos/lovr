package api

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/jamillosantos/logviewer/internal/domain"
	"github.com/jamillosantos/logviewer/internal/service/entryreader"
)

type Entry struct {
	Timestamp  time.Time    `json:"timestamp"`
	Level      domain.Level `json:"level"`
	Message    string       `json:"message"`
	Fields     []*Field     `json:"fields"`
	Caller     string       `json:"caller"`
	Stacktrace string       `json:"stacktrace"`
}

type Field struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}

type SearchResponse struct {
	Count   uint64   `json:"count"`
	Entries []*Entry `json:"entries"`
}

func (api *API) EntriesSearch(fctx *fiber.Ctx) error {
	ctx := fctx.UserContext()

	searchResponse, err := api.reader.Search(ctx, entryreader.SearchRequest{})
	if err != nil {
		return err
	}
	return fctx.JSON(mapSearchResponse(searchResponse))
}

func mapSearchResponse(response entryreader.SearchResponse) SearchResponse {
	return SearchResponse{
		Count:   response.Count,
		Entries: mapEntries(response.Entries),
	}
}

func mapEntries(entries []*domain.LogEntry) []*Entry {
	r := make([]*Entry, len(entries))
	for i, e := range entries {
		r[i] = mapEntry(e)
	}
	return r
}

func mapEntry(e *domain.LogEntry) *Entry {
	return &Entry{
		Timestamp:  e.Timestamp,
		Level:      e.Level,
		Message:    e.Message,
		Fields:     mapFields(e.Fields),
		Caller:     e.Caller,
		Stacktrace: e.Stacktrace,
	}
}

func mapFields(fields []domain.LogField) []*Field {
	r := make([]*Field, len(fields))
	for i, f := range fields {
		r[i] = mapField(f)
	}
	return r
}

func mapField(f domain.LogField) *Field {
	return &Field{
		Key:   f.Key,
		Value: f.Value,
	}
}
