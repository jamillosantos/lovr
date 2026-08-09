package http

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAPI_setupHandlers(t *testing.T) {
	api := New(nil)
	app := fiber.New()
	api.setupHandlers(app)

	req := httptest.NewRequest("GET", "/entries/live", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusUpgradeRequired, resp.StatusCode)

	req = httptest.NewRequest("OPTIONS", "/entries/search", nil)
	req.Header.Set("Origin", "http://example.com")
	req.Header.Set("Access-Control-Request-Method", "GET")
	resp, err = app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, "*", resp.Header.Get("Access-Control-Allow-Origin"))
}
