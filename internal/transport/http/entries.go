package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/jamillosantos/lovr/internal/service/entryreader"
	"github.com/jamillosantos/lovr/internal/transport/http/models"
)

func (api *API) EntriesSearch(fctx *fiber.Ctx) error {
	ctx := fctx.UserContext()

	var since, until time.Time
	var pageSize int

	qrySince := fctx.Query("since", "")
	if qrySince != "" {
		s, err := time.Parse(time.RFC3339, qrySince)
		if err != nil {
			return fctx.Status(http.StatusInternalServerError).JSON(err)
		}
		since = s
	}
	qryUntil := fctx.Query("until", "")
	if qryUntil != "" {
		s, err := time.Parse(time.RFC3339, qryUntil)
		if err != nil {
			return fctx.Status(http.StatusInternalServerError).JSON(err)
		}
		until = s
	}
	qryPageSize := fctx.Query("pageSize", "")
	if qryPageSize != "" {
		p, err := strconv.Atoi(qryPageSize)
		if err != nil {
			return fctx.Status(http.StatusInternalServerError).JSON(err)
		}
		pageSize = p
	}
	query := fctx.Query("q", "")

	searchResponse, err := api.reader.Search(ctx, entryreader.SearchRequest{
		Since:    since,
		Until:    until,
		Query:    query,
		PageSize: pageSize,
	})
	if err != nil {
		return err
	}
	return fctx.JSON(models.MapSearchResponse(searchResponse))
}
