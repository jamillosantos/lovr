package api

import (
	"context"
	"sync"

	"github.com/gofiber/fiber/v2"

	"github.com/jamillosantos/logviewer/internal/service/entryreader"
)

type EntryReader interface {
	Search(ctx context.Context, req entryreader.SearchRequest) (entryreader.SearchResponse, error)
}

type API struct {
	bindAddr string
	wc       *sync.WaitGroup
	reader   EntryReader
}

type Option func(*API)

func New(reader *entryreader.Reader, opts ...Option) *API {
	r := &API{
		bindAddr: "127.0.0.1:3000",
		reader:   reader,
	}
	for _, o := range opts {
		o(r)
	}
	return r
}

func (api *API) Start(ctx context.Context) error {
	api.wc.Add(1)
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		AppName:               "logviewer",
	})

	go func() {
		select {
		case <-ctx.Done():
			_ = app.Shutdown()
		}
	}()

	defer api.wc.Done()

	api.setupHandlers(app)

	return app.Listen(api.bindAddr)
}

func (api *API) setupHandlers(app *fiber.App) {
	app.Get("/entries/search", api.EntriesSearch)
}
