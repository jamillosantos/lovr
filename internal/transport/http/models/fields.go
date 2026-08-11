package models

import (
	"github.com/jamillosantos/lovr/internal/service/entryreader"
)

type FieldsResponse struct {
	Fields []string `json:"fields"`
}

type FieldValue struct {
	Value string `json:"value"`
	Count uint64 `json:"count"`
}

type FieldValuesResponse struct {
	Values []FieldValue `json:"values"`
}

func MapFieldValuesResponse(values []entryreader.FieldValue) FieldValuesResponse {
	r := FieldValuesResponse{
		Values: make([]FieldValue, len(values)),
	}
	for i, v := range values {
		r.Values[i] = FieldValue{
			Value: v.Value,
			Count: v.Count,
		}
	}
	return r
}
