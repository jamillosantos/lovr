/*
Copyright © 2022 NAME HERE <EMAIL ADDRESS>
*/
package cmd

import (
	"github.com/spf13/cobra"

	_ "github.com/jamillosantos/lovr/internal/parsers/json"
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
		/*
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

			// if filtersArg != "none" {
			// 	for _, f := range strings.Split(filtersArg, ",") {
			// 		sourceReader = filters.New(f, sourceReader)
			// 	}
			// }

				parser, err := parsers.New(parserArg, sourceReader)
				if err != nil {
					reportFatalError(err)
				}

						blugerProcessor := processors.NewBluger(blugeWriter)

						processorsList := make([]service.EntryProcessor, 0)
						if filterArg != "" {
							filterprocessor, err := processors.NewFilter(filterArg)
							if err != nil {
								reportFatalError(err)
							}
							processorsList = append(processorsList, filterprocessor)
						}
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
		*/
	},
}

func init() {
	rootCmd.AddCommand(webCmd)

	webCmd.Flags().StringVarP(&bindAddrArg, "bindaddr", "b", bindAddrArg, "Bind address. Default: 127.0.0.1:8080")
}
