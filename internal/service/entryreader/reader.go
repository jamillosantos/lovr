package entryreader

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search/query"
	"github.com/iancoleman/orderedmap"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/service/processors"
)

// Reader searches log entries indexed by processors.Indexer.
type Reader struct {
	index bleve.Index
}

func NewReader(index bleve.Index) *Reader {
	return &Reader{
		index: index,
	}
}

type SearchRequest struct {
	Since    time.Time
	Until    time.Time
	Query    string
	PageSize int
	// Ascending returns the oldest matching entries first (used by the live
	// tail to page through a window without losing entries). Default is
	// newest first.
	Ascending bool
}

type SearchResponse struct {
	Count    int64
	Entries  []*domain.LogEntry
	Duration time.Duration
}

func (r *Reader) Search(ctx context.Context, req SearchRequest) (SearchResponse, error) {
	qs := make([]query.Query, 0, 2)
	if !req.Since.IsZero() || !req.Until.IsZero() {
		until := req.Until
		if until.IsZero() {
			// Effectively unbounded upper end.
			until = time.Date(2200, 1, 1, 0, 0, 0, 0, time.UTC)
		}
		inclusive := true
		// Both bounds are inclusive: entries sharing a boundary timestamp
		// must not be lost when paging (consumers deduplicate by entry ID).
		dr := bleve.NewDateRangeInclusiveQuery(req.Since, until, &inclusive, &inclusive)
		dr.SetField(processors.FieldTimestamp)
		qs = append(qs, dr)
	}
	if req.Query != "" {
		rest, wildcards := extractWildcards(req.Query)
		if rest != "" {
			parsed, err := query.NewQueryStringQuery(rest).Parse()
			if err != nil {
				return SearchResponse{}, fmt.Errorf("invalid query: %w", err)
			}
			qs = append(qs, requireAllTerms(parsed))
		}
		qs = append(qs, wildcards...)
	}

	var q query.Query
	switch len(qs) {
	case 0:
		q = bleve.NewMatchAllQuery()
	case 1:
		q = qs[0]
	default:
		q = bleve.NewConjunctionQuery(qs...)
	}

	pageSize := req.PageSize
	if pageSize < 15 {
		pageSize = 15
	} else if pageSize > 200 {
		pageSize = 200
	}

	sortOrder := "-" + processors.FieldTimestamp
	if req.Ascending {
		sortOrder = processors.FieldTimestamp
	}

	request := bleve.NewSearchRequestOptions(q, pageSize, 0, false)
	request.SortBy([]string{sortOrder})
	request.Fields = []string{"*"}

	result, err := r.index.SearchInContext(ctx, request)
	if err != nil {
		return SearchResponse{}, fmt.Errorf("error executing search: %w", err)
	}

	entries := make([]*domain.LogEntry, 0, len(result.Hits))
	for _, hit := range result.Hits {
		entry := &domain.LogEntry{
			ID:     hit.ID,
			Fields: *orderedmap.New(),
		}

		keys := make([]string, 0, len(hit.Fields))
		for k := range hit.Fields {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, k := range keys {
			value := hit.Fields[k]
			switch k {
			case processors.FieldTimestampNanos:
				if s, ok := value.(string); ok {
					if nanos, err := strconv.ParseInt(s, 10, 64); err == nil {
						entry.Timestamp = time.Unix(0, nanos).UTC()
					}
				}
			case processors.FieldTimestamp:
				// Fallback only: the stored datetime is truncated to seconds.
				if entry.Timestamp.IsZero() {
					if s, ok := value.(string); ok {
						if ts, err := parseStoredTime(s); err == nil {
							entry.Timestamp = ts
						}
					}
				}
			case processors.FieldMessage:
				entry.Message, _ = value.(string)
			case processors.FieldLevel:
				if s, ok := value.(string); ok {
					entry.Level = domain.Level(s)
				}
			case processors.FieldCaller:
				entry.Caller, _ = value.(string)
			case processors.FieldStacktrace:
				entry.Stacktrace, _ = value.(string)
			default:
				entry.Fields.Set(k, value)
			}
		}
		entries = append(entries, entry)
	}

	count, err := r.index.DocCount()
	if err != nil {
		return SearchResponse{}, fmt.Errorf("error counting entries: %w", err)
	}

	return SearchResponse{
		Count:    int64(count),
		Duration: result.Took,
		Entries:  entries,
	}, nil
}

func parseStoredTime(s string) (time.Time, error) {
	ts, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return time.Parse(time.RFC3339, s)
	}
	return ts, nil
}

// extractWildcards pulls tokens containing * or ? out of the query string
// (bleve's query string syntax has no wildcard support) and converts them to
// wildcard queries matching inside indexed terms, e.g. msg:*onnect* or
// route:/api/*/login. Field prefixes and +/- modifiers are honored; the
// remaining tokens are returned for regular query string parsing.
func extractWildcards(q string) (string, []query.Query) {
	tokens := strings.Fields(q)
	kept := make([]string, 0, len(tokens))
	var wildcards []query.Query

	for _, token := range tokens {
		// _exists_:key is sugar for key:* (any value indexed for the key).
		exists := false
		if rest, ok := strings.CutPrefix(strings.TrimLeft(token, "+-"), "_exists_:"); ok && rest != "" {
			modifier := strings.TrimSuffix(token, "_exists_:"+rest)
			token = modifier + rest + ":*"
			exists = true
		}

		// Quoted phrases are left for the query string parser.
		if !exists && (!strings.ContainsAny(token, "*?") || strings.Contains(token, `"`)) {
			kept = append(kept, token)
			continue
		}

		modifier := ""
		body := token
		if strings.HasPrefix(body, "+") || strings.HasPrefix(body, "-") {
			modifier = body[:1]
			body = body[1:]
		}
		field := ""
		if colon := strings.Index(body, ":"); colon >= 0 {
			field = body[:colon]
			body = body[colon+1:]
		}
		if body == "" {
			kept = append(kept, token)
			continue
		}

		// Terms are indexed lowercased by the standard analyzer.
		wq := query.NewWildcardQuery(strings.ToLower(body))
		if field != "" {
			wq.SetField(field)
		}
		if modifier == "-" {
			wildcards = append(wildcards, query.NewBooleanQuery(nil, nil, []query.Query{wq}))
			continue
		}
		wildcards = append(wildcards, wq)
	}

	return strings.Join(kept, " "), wildcards
}

// requireAllTerms rewrites a parsed query string so bare terms are all
// required (AND) instead of bleve's default "should" (OR) semantics, and
// multi-token matches (e.g. route:/api/v1/login) require every token.
// Explicit +required/-excluded modifiers keep their meaning.
func requireAllTerms(q query.Query) query.Query {
	switch qq := q.(type) {
	case *query.BooleanQuery:
		if disj, ok := qq.Should.(*query.DisjunctionQuery); ok {
			terms := make([]query.Query, 0, len(disj.Disjuncts))
			for _, d := range disj.Disjuncts {
				terms = append(terms, requireAllTerms(d))
			}
			if conj, ok := qq.Must.(*query.ConjunctionQuery); ok {
				conj.Conjuncts = append(conj.Conjuncts, terms...)
			} else if qq.Must == nil {
				qq.Must = query.NewConjunctionQuery(terms)
			}
			qq.Should = nil
		}
		if conj, ok := qq.Must.(*query.ConjunctionQuery); ok {
			for i, c := range conj.Conjuncts {
				conj.Conjuncts[i] = requireAllTerms(c)
			}
		}
		return qq
	case *query.MatchQuery:
		qq.Operator = query.MatchQueryOperatorAnd
		return qq
	default:
		return q
	}
}
