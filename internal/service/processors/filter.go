package processors

import (
	"context"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/service"
)

// EntryMatcher reports whether an entry matches a filter expression.
type EntryMatcher interface {
	Match(ctx context.Context, entry *domain.Entry) (bool, error)
}

// Filter skips entries rejected by the matcher.
type Filter struct {
	matcher EntryMatcher
}

func NewFilter(matcher EntryMatcher) *Filter {
	return &Filter{
		matcher: matcher,
	}
}

func (f *Filter) Process(ctx context.Context, entry *domain.Entry) error {
	ok, err := f.matcher.Match(ctx, entry)
	if err != nil {
		return err
	}
	if !ok {
		return service.ErrSkipEntry
	}
	return nil
}
