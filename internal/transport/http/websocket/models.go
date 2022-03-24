package websocket

import "time"

type searchQuery struct {
	Since time.Time `json:"since"`
	Query string    `json:"q"`
}
