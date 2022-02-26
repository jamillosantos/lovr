package store

import (
	"context"

	"github.com/jamillosantos/logviewer/internal/domain"
)

type Store interface {
	Add(ctx context.Context, entry domain.LogEntry) error
}
