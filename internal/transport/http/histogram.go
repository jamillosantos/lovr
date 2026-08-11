package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"

	"github.com/jamillosantos/lovr/internal/service/entryreader"
	"github.com/jamillosantos/lovr/internal/transport/http/models"
)

func (api *API) EntriesHistogram(fctx fiber.Ctx) error {
	ctx := fctx.Context()

	req := entryreader.HistogramRequest{
		Query:   fctx.Query("q", ""),
		GroupBy: fctx.Query("groupBy", ""),
	}
	if qrySince := fctx.Query("since", ""); qrySince != "" {
		s, err := time.Parse(time.RFC3339, qrySince)
		if err != nil {
			return badRequest(fctx, "since must be RFC3339")
		}
		req.Since = s
	}
	if qryUntil := fctx.Query("until", ""); qryUntil != "" {
		u, err := time.Parse(time.RFC3339, qryUntil)
		if err != nil {
			return badRequest(fctx, "until must be RFC3339")
		}
		req.Until = u
	}
	if qryBuckets := fctx.Query("buckets", ""); qryBuckets != "" {
		b, err := strconv.Atoi(qryBuckets)
		if err != nil {
			return badRequest(fctx, "buckets must be an integer")
		}
		req.Buckets = b
	}

	res, err := api.reader.Histogram(ctx, req)
	if err != nil {
		return err
	}
	return fctx.JSON(models.MapHistogramResponse(res))
}

func badRequest(fctx fiber.Ctx, message string) error {
	return fctx.Status(http.StatusBadRequest).JSON(fiber.Map{"error": message})
}
