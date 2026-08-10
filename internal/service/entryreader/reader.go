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
		parsed, err := buildQuery(req.Query)
		if err != nil {
			return SearchResponse{}, err
		}
		if parsed != nil {
			qs = append(qs, parsed)
		}
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

// buildQuery turns the user query into a bleve query with this grammar:
//
//	expr  := and (OR and)*
//	and   := unit+          (implicit AND between units)
//	unit  := '(' expr ')' | term
//
// The uppercase OR keyword separates alternatives, parentheses group for
// precedence, and both are ignored inside double quotes.
func buildQuery(q string) (query.Query, error) {
	p := &queryParser{tokens: tokenizeQuery(q)}
	built, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	if p.pos < len(p.tokens) {
		return nil, fmt.Errorf("invalid query: unexpected %q", p.tokens[p.pos])
	}
	return built, nil
}

// tokenizeQuery splits the query into words, "(" and ")" tokens, keeping
// quoted sections intact.
func tokenizeQuery(q string) []string {
	tokens := make([]string, 0, 8)
	var tok strings.Builder
	flush := func() {
		if tok.Len() > 0 {
			tokens = append(tokens, tok.String())
			tok.Reset()
		}
	}
	inQuotes := false
	for _, r := range q {
		switch {
		case r == '"':
			inQuotes = !inQuotes
			tok.WriteRune(r)
		case !inQuotes && (r == ' ' || r == '\t'):
			flush()
		case !inQuotes && (r == '(' || r == ')'):
			flush()
			tokens = append(tokens, string(r))
		default:
			tok.WriteRune(r)
		}
	}
	flush()
	return tokens
}

type queryParser struct {
	tokens []string
	pos    int
}

func (p *queryParser) peek() (string, bool) {
	if p.pos >= len(p.tokens) {
		return "", false
	}
	return p.tokens[p.pos], true
}

func (p *queryParser) parseExpr() (query.Query, error) {
	parts := make([]query.Query, 0, 2)
	for {
		part, err := p.parseAnd()
		if err != nil {
			return nil, err
		}
		if part != nil {
			parts = append(parts, part)
		}
		if tok, ok := p.peek(); !ok || tok != "OR" {
			break
		}
		p.pos++
	}
	switch len(parts) {
	case 0:
		return nil, nil
	case 1:
		return parts[0], nil
	default:
		return query.NewDisjunctionQuery(parts), nil
	}
}

func (p *queryParser) parseAnd() (query.Query, error) {
	units := make([]query.Query, 0, 2)
	words := make([]string, 0, 4)

	flushWords := func() error {
		if len(words) == 0 {
			return nil
		}
		built, err := buildGroup(strings.Join(words, " "))
		if err != nil {
			return err
		}
		if built != nil {
			units = append(units, built)
		}
		words = words[:0]
		return nil
	}

	for {
		tok, ok := p.peek()
		if !ok || tok == "OR" || tok == ")" {
			break
		}
		if tok == "(" {
			if err := flushWords(); err != nil {
				return nil, err
			}
			p.pos++
			sub, err := p.parseExpr()
			if err != nil {
				return nil, err
			}
			if closing, ok := p.peek(); !ok || closing != ")" {
				return nil, fmt.Errorf("invalid query: missing closing parenthesis")
			}
			p.pos++
			if sub != nil {
				units = append(units, sub)
			}
			continue
		}
		words = append(words, tok)
		p.pos++
	}
	if err := flushWords(); err != nil {
		return nil, err
	}

	switch len(units) {
	case 0:
		return nil, nil
	case 1:
		return units[0], nil
	default:
		return query.NewConjunctionQuery(units), nil
	}
}

// buildGroup builds one AND group: wildcard tokens plus the query string
// parser output with all terms required.
func buildGroup(group string) (query.Query, error) {
	qs := make([]query.Query, 0, 2)
	rest, wildcards := extractWildcards(group)
	if rest != "" {
		parsed, err := query.NewQueryStringQuery(rest).Parse()
		if err != nil {
			return nil, fmt.Errorf("invalid query: %w", err)
		}
		qs = append(qs, requireAllTerms(parsed))
	}
	qs = append(qs, wildcards...)
	switch len(qs) {
	case 0:
		return nil, nil
	case 1:
		return qs[0], nil
	default:
		return query.NewConjunctionQuery(qs), nil
	}
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
