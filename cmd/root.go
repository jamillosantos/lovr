package cmd

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"sync"

	"github.com/blugelabs/bluge"
	"github.com/spf13/cobra"

	"github.com/jamillosantos/logviewer/internal/parser/json"
	"github.com/jamillosantos/logviewer/internal/service"
	"github.com/jamillosantos/logviewer/internal/service/api"
	"github.com/jamillosantos/logviewer/internal/service/entryreader"
	"github.com/jamillosantos/logviewer/internal/service/processors"
)

var (
	source   = "-"
	web      = true
	bindAddr = "127.0.0.1:8080"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "logviewer",
	Short: "A brief description of your application",
	Long: `A longer description that spans multiple lines and likely contains
examples and usage of using your application. For example:

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

		sourceReader, releaseSource, err := service.GetSource(source)
		if err != nil {
			reportFatalError(fmt.Errorf("could not initialize source: %w", err))
		}
		defer releaseSource()

		ctx, cancelFunc := signal.NotifyContext(ctx, os.Interrupt)
		defer cancelFunc()

		parser, err := json.NewJSONParser(sourceReader)
		if err != nil {
			reportFatalError(err)
		}

		processorsList := make([]service.EntryProcessor, 0)
		processorsList = append(processorsList, processors.NewStdout())
		processorsList = append(processorsList, processors.NewBluger(blugeWriter))

		var wc sync.WaitGroup

		entriesFetcher := service.NewEntriesReader(parser)
		go runFetcher(ctx, &wc, entriesFetcher, processorsList)

		entryReader := entryreader.NewReader(blugeWriter)

		serviceAPI := api.New(entryReader, api.WithBindAddr("127.0.0.1:8080"), api.WithWC(&wc))
		if err := serviceAPI.Start(ctx); err != nil {
			reportFatalError(err)
		}

		cancelFunc() // Close all goroutines
		wc.Wait()
	},
}

func runFetcher(ctx context.Context, wc *sync.WaitGroup, entriesFetcher *service.EntriesReader, processorsList []service.EntryProcessor) {
	defer wc.Done()
	wc.Add(1)
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

func reportError(err error) {
	fmt.Println("### ERROR:", err.Error())
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func init() {
	// rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.logviewer.yaml)")

	rootCmd.Flags().StringVarP(&source, "source", "s", source, "Filename of the log information. Default '-' (stdin).")
}
