package websocket

import "time"

type searchQuery struct {
	Since time.Time `json:"since"`
	Until time.Time `json:"until"`
	Query string    `json:"q"`
}
