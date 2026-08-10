package http

import (
	"net/http"
	"strconv"

	"github.com/gofiber/fiber/v3"

	"github.com/jamillosantos/lovr/internal/transport/http/models"
)

func (api *API) EntriesFields(fctx fiber.Ctx) error {
	ctx := fctx.Context()

	fields, err := api.reader.Fields(ctx)
	if err != nil {
		return err
	}
	return fctx.JSON(models.FieldsResponse{Fields: fields})
}

func (api *API) EntriesFieldValues(fctx fiber.Ctx) error {
	ctx := fctx.Context()

	limit := 0
	if qryLimit := fctx.Query("limit", ""); qryLimit != "" {
		l, err := strconv.Atoi(qryLimit)
		if err != nil {
			return fctx.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": "limit must be an integer",
			})
		}
		limit = l
	}

	values, err := api.reader.FieldValues(
		ctx,
		fctx.Params("field"),
		fctx.Query("prefix", ""),
		limit,
	)
	if err != nil {
		return err
	}
	return fctx.JSON(models.MapFieldValuesResponse(values))
}
