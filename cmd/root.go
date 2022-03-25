package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"

	"github.com/spf13/cobra"

	"github.com/jamillosantos/lovr/internal/filters"
	"github.com/jamillosantos/lovr/internal/parsers"
	_ "github.com/jamillosantos/lovr/internal/parsers/json"
	"github.com/jamillosantos/lovr/internal/service"
	"github.com/jamillosantos/lovr/internal/service/processors"
)

var (
	parserArg          = "json"
	filtersArg         = "none"
	sourceArg          = "-"
	showParseErrorsArg = false
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "lovr",
	Short: "LOgVieweR is a tool that enable you to view your logs in a human readable way",
	Long: `LOgVieweR is a tool that enable you to view your logs in a human readable way.

Examples:

  Reading from stdin:
  $ yourapplication | lovr

  Reading from a file:
  $ lovr -s /path/to/file.log

  Listening changes form a file:
  $ tail -f /path/to/file.log | lovr

  Reading from a docker-compose container:
  $ docker-compose logs -f --no-log-prefix api | lovr
`,
	Run: func(cmd *cobra.Command, args []string) {
		ctx := context.Background()

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

		processorsList := make([]service.EntryProcessor, 0)
		processorsList = append(processorsList, processors.NewStdout())

		entriesFetcher := service.NewEntriesReader(parser, logHandler)
		runFetcher(ctx, entriesFetcher, processorsList)
	},
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
	rootCmd.PersistentFlags().BoolVar(&showParseErrorsArg, "show-parse-errors", showParseErrorsArg, "Output parse errors to the STDERR")
	rootCmd.PersistentFlags().StringVarP(&sourceArg, "source", "s", sourceArg, "Filename of the log information (use `-` for STDIN).")

	// No filters are available yet
	// rootCmd.PersistentFlags().StringVarP(&filtersArg, "filters", "i", filtersArg, "Comma separated list of filters to transform the source stream (docker).")

	// Only JSON is available now, so it does not make sense let the possibility of configuring it.
	// rootCmd.PersistentFlags().StringVarP(&parserArg, "parser", "p", parserArg, "Parser used to read the log.")
}
