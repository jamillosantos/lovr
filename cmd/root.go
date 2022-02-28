package cmd

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"

	"github.com/blugelabs/bluge"
	"github.com/spf13/cobra"

	"github.com/jamillosantos/logviewer/internal/parser/json"
	"github.com/jamillosantos/logviewer/internal/service"
	"github.com/jamillosantos/logviewer/internal/service/processors"
)

var source = "-"

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

		config := bluge.InMemoryOnlyConfig()
		blugeWriter, err := bluge.OpenWriter(config)
		if err != nil {
			log.Fatalf("error opening bluge writer: %v", err)
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
		// processorsList = append(processorsList, processors.NewBluger(blugeWriter))

		entriesFetcher := service.NewEntriesReader(parser)
		func() { // This should be a go routine.
			err := entriesFetcher.Start(ctx, processorsList...)
			switch {
			case errors.Is(err, context.Canceled):
				return
			case err != nil:
				reportFatalError(err)
			}
		}()
	},
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
