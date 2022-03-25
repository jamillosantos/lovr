package cmd

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"

	"go.uber.org/zap"

	"github.com/jamillosantos/lovr/internal/logctx"
	"github.com/jamillosantos/lovr/internal/service"
)

func runFetcher(ctx context.Context, entriesFetcher *service.EntriesReader, processorsList []service.EntryProcessor) {
	err := entriesFetcher.Start(ctx, processorsList...)
	switch {
	case errors.Is(err, context.Canceled):
		return
	case errors.Is(err, io.EOF):
		fmt.Println("EOF")
		return
	case err != nil:
		reportFatalError(err)
	}
}

func reportFatalError(err error) {
	fmt.Println("### ERROR:", err.Error())
	os.Exit(1)
}

func logHandler(ctx context.Context, err error) error {
	if showParseErrorsArg {
		logctx.Error(ctx, "error reading entries", zap.Error(err))
	}
	return nil // Informs the service that the error can be ignored and the process can continue.
}
