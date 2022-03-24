package http

import (
	"context"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	fiberws "github.com/gofiber/websocket/v2"

	"github.com/jamillosantos/logviewer/internal/service/entryreader"
	"github.com/jamillosantos/logviewer/internal/transport/http/websocket"
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
	defer api.wc.Done()

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

	api.setupHandlers(app)

	return app.Listen(api.bindAddr)
}

func (api *API) setupHandlers(app *fiber.App) {
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "*",
		AllowHeaders: "*",
	}))

	app.Use("/entries/live", func(c *fiber.Ctx) error {
		// IsWebSocketUpgrade returns true if the client
		// requested upgrade to the WebSocket protocol.
		if fiberws.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/entries/search", api.EntriesSearch)
	app.Get("/entries/live", fiberws.New(api.HandleWebsocket))
}

func (api *API) HandleWebsocket(conn *fiberws.Conn) {
	ctx := context.Background()
	wsconn := websocket.NewConnection(conn, api.reader)
	wsconn.Handle(ctx) // Blocks
}
