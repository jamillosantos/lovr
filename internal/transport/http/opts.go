package http

import (
	"io/fs"
	"sync"
)

func WithBindAddr(bindAddr string) func(*API) {
	return func(api *API) {
		api.bindAddr = bindAddr
	}
}

func WithWC(wc *sync.WaitGroup) Option {
	return func(api *API) {
		api.wc = wc
	}
}

// WithUI makes the API serve the given filesystem as the web interface.
func WithUI(uiFS fs.FS) Option {
	return func(api *API) {
		api.uiFS = uiFS
	}
}
