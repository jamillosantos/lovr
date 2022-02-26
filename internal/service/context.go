package service

import (
	"context"
	"time"
)

type contextDetached struct {
	context.Context
}

func DetachContext(ctx context.Context) context.Context {
	return &contextDetached{ctx}
}

func (c *contextDetached) Deadline() (deadline time.Time, ok bool) {
	return time.Time{}, false
}
