/*
Copyright © 2022 NAME HERE <EMAIL ADDRESS>

*/
package cmd

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"sync"

	"github.com/blugelabs/bluge"
	"github.com/spf13/cobra"

	"github.com/jamillosantos/lovr/internal/filters"
	"github.com/jamillosantos/lovr/internal/parsers"
	_ "github.com/jamillosantos/lovr/internal/parsers/json"
	"github.com/jamillosantos/lovr/internal/service"
	"github.com/jamillosantos/lovr/internal/service/entryreader"
	"github.com/jamillosantos/lovr/internal/service/processors"
	"github.com/jamillosantos/lovr/internal/transport/http"
)

var (
	bindAddrArg = "127.0.0.1:8080"
)

// webCmd represents the web command
var webCmd = &cobra.Command{
	Use:   "web",
	Short: "A brief description of your command",
	Long: `A longer description that spans multiple lines and likely contains examples
and usage of using your command. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
	Run: func(cmd *cobra.Command, args []string) {
		ctx := context.Background()

		blugeConfig := bluge.InMemoryOnlyConfig()

		blugeWriter, err := bluge.OpenWriter(blugeConfig)
		if err != nil {
			log.Fatalf("error opening bluge writer: %w", err)
		}
		defer func() {
			_ = blugeWriter.Close()
		}()

		sourceReader, releaseSource, err := service.GetSource(sourceArg)
		if err != nil {
			reportFatalError(fmt.Errorf("could not initialize source: %w", err))
		}
		defer releaseSource()

		ctx, cancelFunc := signal.NotifyContext(ctx, os.Interrupt)
		defer cancelFunc()

		if filtersArg != "none" {
			for _, f := range strings.Split(filtersArg, ",") {
				sourceReader = filters.New(f, sourceReader)
			}
		}

		parser, err := parsers.New(parserArg, sourceReader)
		if err != nil {
			reportFatalError(err)
		}

		blugerProcessor := processors.NewBluger(blugeWriter)

		processorsList := make([]service.EntryProcessor, 0)
		processorsList = append(processorsList, processors.NewStdout())
		processorsList = append(processorsList, blugerProcessor)

		var wc sync.WaitGroup

		entriesFetcher := service.NewEntriesReader(parser, logHandler)
		wc.Add(1)
		go func() {
			defer wc.Done()
			runFetcher(ctx, entriesFetcher, processorsList)
		}()

		entryReader := entryreader.NewReader(blugeWriter, blugerProcessor)

		serviceAPI := http.New(entryReader, http.WithBindAddr(bindAddrArg), http.WithWC(&wc))
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
