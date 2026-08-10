package entryreader

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search/query"

	"github.com/jamillosantos/lovr/internal/service/processors"
)

const (
	DefaultHistogramBuckets = 60
	MaxHistogramBuckets     = 200
	MaxHistogramGroups      = 6
)

type HistogramRequest struct {
	Query   string
	Since   time.Time
	Until   time.Time
	Buckets int
	// GroupBy splits the counts by the values of this field; empty counts
	// everything into a single "all" group.
	GroupBy string
}

type HistogramBucket struct {
	Start  time.Time
	Counts map[string]int
}

type HistogramResponse struct {
	Start    time.Time
	End      time.Time
	BucketMs int64
	// Groups in display order (severity for levels, count otherwise).
	Groups  []string
	Buckets []HistogramBucket
}

var levelOrder = []string{"debug", "info", "warning", "error", "fatal", "panic"}

// Histogram counts matching entries into time buckets, optionally split by
// the values of a field. bleve has no sub-aggregations, so the counts come
// from one date-range facet search per group.
func (r *Reader) Histogram(ctx context.Context, req HistogramRequest) (HistogramResponse, error) {
	buckets := req.Buckets
	if buckets <= 0 {
		buckets = DefaultHistogramBuckets
	} else if buckets > MaxHistogramBuckets {
		buckets = MaxHistogramBuckets
	}

	var userQuery query.Query
	if req.Query != "" {
		parsed, err := buildQuery(req.Query)
		if err != nil {
			return HistogramResponse{}, err
		}
		userQuery = parsed
	}

	start, end, err := r.histogramWindow(ctx, req, userQuery)
	if err != nil {
		return HistogramResponse{}, err
	}
	if !start.Before(end) {
		return HistogramResponse{Start: start, End: end, Groups: []string{}, Buckets: []HistogramBucket{}}, nil
	}

	groups, err := r.histogramGroups(ctx, req.GroupBy, userQuery, start, end)
	if err != nil {
		return HistogramResponse{}, err
	}

	bucketDur := end.Sub(start) / time.Duration(buckets)
	if bucketDur <= 0 {
		bucketDur = time.Millisecond
	}

	result := HistogramResponse{
		Start:    start,
		End:      end,
		BucketMs: bucketDur.Milliseconds(),
		Groups:   groups,
		Buckets:  make([]HistogramBucket, buckets),
	}
	for i := range result.Buckets {
		result.Buckets[i] = HistogramBucket{
			Start:  start.Add(time.Duration(i) * bucketDur),
			Counts: make(map[string]int, len(groups)),
		}
	}

	for _, group := range groups {
		q := r.histogramGroupQuery(req.GroupBy, group, userQuery, start, end)

		sr := bleve.NewSearchRequestOptions(q, 0, 0, false)
		facet := bleve.NewFacetRequest(processors.FieldTimestamp, buckets)
		for i := 0; i < buckets; i++ {
			bucketStart := start.Add(time.Duration(i) * bucketDur)
			bucketEnd := bucketStart.Add(bucketDur)
			if i == buckets-1 {
				// Cover the window end (facet ranges are [start, end)).
				bucketEnd = end.Add(time.Millisecond)
			}
			facet.AddDateTimeRange(strconv.Itoa(i), bucketStart, bucketEnd)
		}
		sr.AddFacet("histogram", facet)

		res, err := r.index.SearchInContext(ctx, sr)
		if err != nil {
			return HistogramResponse{}, fmt.Errorf("error computing histogram: %w", err)
		}
		if f, ok := res.Facets["histogram"]; ok {
			for _, dr := range f.DateRanges {
				idx, err := strconv.Atoi(dr.Name)
				if err != nil || idx < 0 || idx >= len(result.Buckets) {
					continue
				}
				result.Buckets[idx].Counts[group] = dr.Count
			}
		}
	}

	return result, nil
}

// histogramWindow resolves the chart bounds: the requested range, or the
// matching data's own extent.
func (r *Reader) histogramWindow(ctx context.Context, req HistogramRequest, userQuery query.Query) (time.Time, time.Time, error) {
	start, end := req.Since, req.Until
	if !start.IsZero() && !end.IsZero() {
		return start, end, nil
	}

	bound := func(ascending bool) (time.Time, error) {
		var q query.Query = bleve.NewMatchAllQuery()
		if userQuery != nil {
			q = userQuery
		}
		sr := bleve.NewSearchRequestOptions(q, 1, 0, false)
		order := "-" + processors.FieldTimestamp
		if ascending {
			order = processors.FieldTimestamp
		}
		sr.SortBy([]string{order})
		sr.Fields = []string{processors.FieldTimestampNanos}
		res, err := r.index.SearchInContext(ctx, sr)
		if err != nil {
			return time.Time{}, err
		}
		if len(res.Hits) == 0 {
			return time.Time{}, nil
		}
		if s, ok := res.Hits[0].Fields[processors.FieldTimestampNanos].(string); ok {
			if nanos, err := strconv.ParseInt(s, 10, 64); err == nil {
				return time.Unix(0, nanos).UTC(), nil
			}
		}
		return time.Time{}, nil
	}

	if start.IsZero() {
		first, err := bound(true)
		if err != nil {
			return start, end, fmt.Errorf("error resolving window start: %w", err)
		}
		start = first
	}
	if end.IsZero() {
		last, err := bound(false)
		if err != nil {
			return start, end, fmt.Errorf("error resolving window end: %w", err)
		}
		if !last.IsZero() {
			// Include the newest entry in the last bucket.
			last = last.Add(time.Millisecond)
		}
		end = last
	}
	return start, end, nil
}

// histogramGroups picks the group values: the top terms of the field within
// the window, ordered by severity for levels and by count otherwise.
func (r *Reader) histogramGroups(ctx context.Context, groupBy string, userQuery query.Query, start, end time.Time) ([]string, error) {
	if groupBy == "" {
		return []string{"all"}, nil
	}

	q := r.histogramGroupQuery("", "", userQuery, start, end)
	sr := bleve.NewSearchRequestOptions(q, 0, 0, false)
	sr.AddFacet("groups", bleve.NewFacetRequest(groupBy, MaxHistogramGroups))
	res, err := r.index.SearchInContext(ctx, sr)
	if err != nil {
		return nil, fmt.Errorf("error listing groups: %w", err)
	}

	groups := make([]string, 0, MaxHistogramGroups)
	if f, ok := res.Facets["groups"]; ok && f.Terms != nil {
		for _, term := range f.Terms.Terms() {
			if printableTerm(term.Term) {
				groups = append(groups, term.Term)
			}
		}
	}

	if groupBy == processors.FieldLevel {
		rank := make(map[string]int, len(levelOrder))
		for i, l := range levelOrder {
			rank[l] = i
		}
		sort.SliceStable(groups, func(i, j int) bool {
			ri, iok := rank[groups[i]]
			rj, jok := rank[groups[j]]
			if iok && jok {
				return ri < rj
			}
			return iok
		})
	}
	return groups, nil
}

// histogramGroupQuery combines the user query, the window and (optionally)
// one group term.
func (r *Reader) histogramGroupQuery(groupBy, group string, userQuery query.Query, start, end time.Time) query.Query {
	qs := make([]query.Query, 0, 3)
	inclusive := true
	dr := bleve.NewDateRangeInclusiveQuery(start, end, &inclusive, &inclusive)
	dr.SetField(processors.FieldTimestamp)
	qs = append(qs, dr)
	if userQuery != nil {
		qs = append(qs, userQuery)
	}
	if groupBy != "" && group != "" && group != "all" {
		tq := bleve.NewTermQuery(group)
		tq.SetField(groupBy)
		qs = append(qs, tq)
	}
	if len(qs) == 1 {
		return qs[0]
	}
	return bleve.NewConjunctionQuery(qs...)
}
