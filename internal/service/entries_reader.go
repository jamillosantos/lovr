package service

import (
	"context"
	"errors"
	"io"

	"github.com/jamillosantos/lovr/internal/domain"
)

var (
	// ErrSkipEntry should be returned by an EntryProcessor to indicate that the entry should be skipped.
	ErrSkipEntry = errors.New("skip entry")
)

type EntryFetcher interface {
	Next() (domain.Entry, error)
}

type EntriesReader struct {
	fetcher      EntryFetcher
	errorHandler func(ctx context.Context, err error) error
}

type EntryProcessor interface {
	Process(ctx context.Context, entry *domain.Entry) error
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

	ProcessorLoop:
		for _, ep := range entryProcessors {
			err := ep.Process(ctx, &entry)
			switch {
			case errors.Is(err, ErrSkipEntry):
				break ProcessorLoop
			case err != nil:
				err = r.errorHandler(ctx, err)
				if err != nil {
					return err
				}
			}
		}
	}
}
