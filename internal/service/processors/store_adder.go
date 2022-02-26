package processors

import (
	"context"

	"github.com/jamillosantos/logviewer/internal/domain"
)

type StoreAdder interface {
	Add(ctx context.Context, entry domain.LogEntry) error
}

type EntryAdder struct {
	entryAdder StoreAdder
}

func NewEntryAdder(store StoreAdder) *EntryAdder {
	return &EntryAdder{
		entryAdder: store,
	}
}

func (b *EntryAdder) Process(ctx context.Context, entry domain.LogEntry) error {
	return b.entryAdder.Add(ctx, entry)
}
