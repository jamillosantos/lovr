package models

import (
	"time"

	"github.com/jamillosantos/lovr/internal/service/entryreader"
)

type HistogramBucket struct {
	Start  time.Time      `json:"start"`
	Counts map[string]int `json:"counts"`
}

type HistogramResponse struct {
	Start    time.Time         `json:"start"`
	End      time.Time         `json:"end"`
	BucketMs int64             `json:"bucketMs"`
	Groups   []string          `json:"groups"`
	Buckets  []HistogramBucket `json:"buckets"`
}

func MapHistogramResponse(res entryreader.HistogramResponse) HistogramResponse {
	buckets := make([]HistogramBucket, len(res.Buckets))
	for i, b := range res.Buckets {
		buckets[i] = HistogramBucket{Start: b.Start, Counts: b.Counts}
	}
	return HistogramResponse{
		Start:    res.Start,
		End:      res.End,
		BucketMs: res.BucketMs,
		Groups:   res.Groups,
		Buckets:  buckets,
	}
}
