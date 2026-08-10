package entryreader

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

	index "github.com/blevesearch/bleve_index_api"

	"github.com/jamillosantos/lovr/internal/service/processors"
)

// internalFields are index-only fields that are not meaningful search targets.
var internalFields = map[string]struct{}{
	"_all":                         {},
	"_id":                          {},
	processors.FieldTimestampNanos: {},
}

// Fields returns the names of the fields available for searching, sorted
// alphabetically.
func (r *Reader) Fields(_ context.Context) ([]string, error) {
	fields, err := r.index.Fields()
	if err != nil {
		return nil, fmt.Errorf("error listing fields: %w", err)
	}

	result := make([]string, 0, len(fields))
	for _, f := range fields {
		if _, internal := internalFields[f]; internal {
			continue
		}
		result = append(result, f)
	}
	sort.Strings(result)
	return result, nil
}

type FieldValue struct {
	Value string
	Count uint64
}

const (
	DefaultValuesLimit = 20
	MaxValuesLimit     = 100
)

// FieldValues returns the indexed terms of a field, optionally filtered by
// prefix, with the number of entries containing each term. Terms come from
// the search index, so they are the analyzed (lowercased/tokenized) forms
// that fielded queries actually match. Fields indexed in binary form
// (timestamps, numerics) yield no printable terms and return an empty list.
func (r *Reader) FieldValues(_ context.Context, field, prefix string, limit int) ([]FieldValue, error) {
	if limit <= 0 {
		limit = DefaultValuesLimit
	} else if limit > MaxValuesLimit {
		limit = MaxValuesLimit
	}

	prefix = strings.ToLower(prefix)
	var dict index.FieldDict
	var err error
	if prefix == "" {
		// FieldDictPrefix with an empty prefix yields no terms on the
		// in-memory store; fall back to the full dictionary.
		dict, err = r.index.FieldDict(field)
	} else {
		dict, err = r.index.FieldDictPrefix(field, []byte(prefix))
	}
	if err != nil {
		return nil, fmt.Errorf("error iterating field terms: %w", err)
	}
	defer func() {
		_ = dict.Close()
	}()

	values := make([]FieldValue, 0, limit)
	entry, err := dict.Next()
	for err == nil && entry != nil && len(values) < limit {
		if printableTerm(entry.Term) {
			values = append(values, FieldValue{Value: entry.Term, Count: entry.Count})
		}
		entry, err = dict.Next()
	}
	if err != nil {
		return nil, fmt.Errorf("error iterating field terms: %w", err)
	}
	return values, nil
}

// printableTerm filters out binary terms: timestamps and numerics are indexed
// prefix-coded, which includes control bytes or matches the prefix-coded
// shape exactly.
func printableTerm(term string) bool {
	if term == "" || !utf8.ValidString(term) || isPrefixCodedNumeric(term) {
		return false
	}
	return !strings.ContainsFunc(term, func(r rune) bool {
		return r < 0x20 || r == 0x7f
	})
}

// isPrefixCodedNumeric reports whether term looks like a prefix-coded int64:
// first byte 0x20+shift, followed by exactly ceil((64-shift)/7) bytes of
// 7-bit payload. Some of these are printable-ASCII by chance and would
// otherwise pass the control-byte filter.
func isPrefixCodedNumeric(term string) bool {
	shift := int(term[0]) - 0x20
	if shift < 0 || shift > 63 {
		return false
	}
	payload := (64 - shift + 6) / 7
	if len(term) != 1+payload {
		return false
	}
	for _, b := range []byte(term[1:]) {
		if b >= 0x80 {
			return false
		}
	}
	return true
}
