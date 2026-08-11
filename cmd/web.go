package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"

	"github.com/blevesearch/bleve/v2"
	"github.com/spf13/cobra"

	"github.com/jamillosantos/lovr/internal/parsers"
	_ "github.com/jamillosantos/lovr/internal/parsers/json"
	"github.com/jamillosantos/lovr/internal/service"
	"github.com/jamillosantos/lovr/internal/service/entryreader"
	"github.com/jamillosantos/lovr/internal/service/processors"
	transporthttp "github.com/jamillosantos/lovr/internal/transport/http"
	"github.com/jamillosantos/lovr/ui"
)

var (
	bindAddrArg = "127.0.0.1:8080"
)

// webCmd represents the web command
var webCmd = &cobra.Command{
	Use:   "web",
	Short: "Start a webserver/webpage to view/search the log entries",
	Long: `This command starts a webserver and a webpage where you will be able to view and
search for log entries on a modern UI.`,
	Run: func(cmd *cobra.Command, args []string) {
		ctx := context.Background()

		index, err := bleve.NewMemOnly(processors.NewIndexMapping())
		if err != nil {
			reportFatalError(fmt.Errorf("error opening index: %w", err))
		}
		defer func() {
			_ = index.Close()
		}()

		sourceReader, releaseSource, err := service.GetSource(sourceArg)
		if err != nil {
			reportFatalError(fmt.Errorf("could not initialize source: %w", err))
		}
		defer releaseSource()

		ctx, cancelFunc := signal.NotifyContext(ctx, os.Interrupt)
		defer cancelFunc()

		parser, err := parsers.New(parserArg, sourceReader)
		if err != nil {
			reportFatalError(err)
		}

		indexer := processors.NewIndexer(index)

		processorsList := make([]service.EntryProcessor, 0)
		if filterArg != "" {
			matcher, err := entryreader.NewMatcher(filterArg)
			if err != nil {
				reportFatalError(err)
			}
			defer func() {
				_ = matcher.Close()
			}()
			processorsList = append(processorsList, processors.NewFilter(matcher))
		}
		processorsList = append(processorsList, processors.NewStdout(), indexer)

		var wc sync.WaitGroup

		entriesFetcher := service.NewEntriesReader(parser, logHandler)
		wc.Add(1)
		go func() {
			defer wc.Done()
			runFetcher(ctx, entriesFetcher, processorsList)
		}()

		entryReader := entryreader.NewReader(index)

		opts := []transporthttp.Option{
			transporthttp.WithBindAddr(bindAddrArg),
			transporthttp.WithWC(&wc),
		}
		if uiFS := ui.FS(); uiFS != nil {
			opts = append(opts, transporthttp.WithUI(uiFS))
		} else {
			fmt.Fprintln(os.Stderr, "warning: UI assets were not embedded in this build; serving the API only. Build with `make build` to include the UI.")
		}

		serviceAPI := transporthttp.New(entryReader, opts...)
		if err := serviceAPI.Start(ctx); err != nil {
			reportFatalError(err)
		}

		cancelFunc() // Close all goroutines
		wc.Wait()
	},
}

func init() {
	rootCmd.AddCommand(webCmd)

	webCmd.Flags().StringVarP(&bindAddrArg, "bindaddr", "b", bindAddrArg, "Bind address. Default: 127.0.0.1:8080")
}
