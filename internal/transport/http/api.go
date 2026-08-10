package http

import (
	"context"
	"io/fs"
	"sync"

	fiberws "github.com/gofiber/contrib/v3/websocket"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/static"

	"github.com/jamillosantos/lovr/internal/service/entryreader"
	"github.com/jamillosantos/lovr/internal/transport/http/websocket"
)

type EntryReader interface {
	Search(ctx context.Context, req entryreader.SearchRequest) (entryreader.SearchResponse, error)
}

type API struct {
	bindAddr string
	wc       *sync.WaitGroup
	reader   EntryReader
	uiFS     fs.FS
	baseCtx  context.Context
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
		AppName: "logviewer",
	})

	go func() {
		<-ctx.Done()
		_ = app.Shutdown()
	}()

	api.baseCtx = ctx
	api.setupHandlers(app)

	return app.Listen(api.bindAddr, fiber.ListenConfig{
		DisableStartupMessage: true,
	})
}

func (api *API) setupHandlers(app *fiber.App) {
	app.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"*"},
		AllowHeaders: []string{"*"},
	}))

	app.Use("/entries/live", func(c fiber.Ctx) error {
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

	if api.uiFS != nil {
		app.Get("/*", static.New("", static.Config{
			FS:         api.uiFS,
			IndexNames: []string{"index.html"},
		}))
	}
}

func (api *API) HandleWebsocket(conn *fiberws.Conn) {
	ctx := api.baseCtx
	if ctx == nil {
		ctx = context.Background()
	}
	wsconn := websocket.NewConnection(conn, api.reader)
	wsconn.Handle(ctx) // Blocks
}
