package service

import (
	"context"
	"errors"
	"io"

	"github.com/jamillosantos/lovr/internal/domain"
)

type EntryFetcher interface {
	Next() (domain.LogEntry, error)
}

type EntriesReader struct {
	fetcher      EntryFetcher
	errorHandler func(ctx context.Context, err error) error
}

type EntryProcessor interface {
	Process(ctx context.Context, entry domain.LogEntry) error
}

func NewEntriesReader(fetcher EntryFetcher, errorHandler func(ctx context.Context, err error) error) *EntriesReader {
	return &EntriesReader{
		fetcher:      fetcher,
		errorHandler: errorHandler,
	}
}

func (r *EntriesReader) Start(ctx context.Context, entryProcessors ...EntryProcessor) error {
	for {
		entry, err := r.fetcher.Next()
		switch {
		case errors.Is(err, io.EOF):
			return err
		case err != nil:
			err = r.errorHandler(ctx, err)
			if err != nil {
				return err
			}
			continue
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
