package api

import "sync"

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
