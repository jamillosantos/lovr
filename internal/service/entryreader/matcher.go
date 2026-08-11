package entryreader

import (
	"context"
	"fmt"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search/query"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/service/processors"
)

// Matcher evaluates the web UI search syntax against individual entries by
// running each one through a private in-memory bleve index: index the entry,
// run the query, drop the entry. Slower than a hand-written evaluator, but
// the filter and the web search cannot drift apart.
type Matcher struct {
	index bleve.Index
	query query.Query
}

func NewMatcher(expr string) (*Matcher, error) {
	q, err := buildQuery(expr)
	if err != nil {
		return nil, err
	}
	index, err := bleve.NewMemOnly(processors.NewIndexMapping())
	if err != nil {
		return nil, fmt.Errorf("error creating the filter index: %w", err)
	}
	return &Matcher{
		index: index,
		query: q,
	}, nil
}

func (m *Matcher) Match(ctx context.Context, entry *domain.Entry) (bool, error) {
	if m.query == nil {
		return true, nil
	}
	id, doc, err := processors.BuildDoc(entry)
	if err != nil {
		return false, err
	}
	if err := m.index.Index(id, doc); err != nil {
		return false, fmt.Errorf("error indexing the entry: %w", err)
	}
	defer func() {
		_ = m.index.Delete(id)
	}()

	req := bleve.NewSearchRequestOptions(m.query, 1, 0, false)
	result, err := m.index.SearchInContext(ctx, req)
	if err != nil {
		return false, fmt.Errorf("error matching the entry: %w", err)
	}
	return result.Total > 0, nil
}

func (m *Matcher) Close() error {
	return m.index.Close()
}
