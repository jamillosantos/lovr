package service

import (
	"context"

	"github.com/jamillosantos/logviewer/internal/domain"
)

type EntryFetcher interface {
	Next() (domain.LogEntry, error)
}

type EntriesReader struct {
	fetcher EntryFetcher
}

type EntryProcessor interface {
	Process(ctx context.Context, entry domain.LogEntry) error
}

func NewEntriesReader(fetcher EntryFetcher) *EntriesReader {
	return &EntriesReader{
		fetcher: fetcher,
	}
}

func (r *EntriesReader) Start(ctx context.Context, entryProcessors ...EntryProcessor) error {
	for {
		entry, err := r.fetcher.Next()
		if err != nil {
			return err
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		for _, ep := range entryProcessors {
			if err := ep.Process(ctx, entry); err != nil {
				return err
			}
		}
	}
}
