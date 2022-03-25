package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"

	"github.com/spf13/cobra"

	"github.com/jamillosantos/logviewer/internal/filters"
	"github.com/jamillosantos/logviewer/internal/parsers"
	_ "github.com/jamillosantos/logviewer/internal/parsers/json"
	"github.com/jamillosantos/logviewer/internal/service"
	"github.com/jamillosantos/logviewer/internal/service/processors"
)

var (
	parserArg          = "json"
	filtersArg         = "none"
	sourceArg          = "-"
	showParseErrorsArg = false
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
	rootCmd.PersistentFlags().StringVarP(&filtersArg, "filters", "i", filtersArg, "Comma separated list of filters to transform the source stream (docker). Default: none")
	rootCmd.PersistentFlags().StringVarP(&parserArg, "parser", "p", parserArg, "Parser used to read the log (Only `json` supported for now). Default: json.")
	rootCmd.PersistentFlags().StringVarP(&sourceArg, "source", "s", sourceArg, "Filename of the log information. Default '-' (stdin).")
}
