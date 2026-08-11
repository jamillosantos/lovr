package cmd

import (
	"fmt"
	"runtime"
	"runtime/debug"

	"github.com/spf13/cobra"

	"github.com/jamillosantos/lovr/ui"
)

// Overridden at release time via -ldflags (see .goreleaser.yaml). Non-release
// builds fall back to the VCS information stamped by the Go toolchain.
var (
	version = "dev"
	commit  = ""
	date    = ""
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version and build information",
	Run: func(cmd *cobra.Command, args []string) {
		fromVCS := commit == ""
		dirty := false
		if info, ok := debug.ReadBuildInfo(); ok {
			for _, s := range info.Settings {
				switch s.Key {
				case "vcs.revision":
					if fromVCS {
						commit = s.Value
					}
				case "vcs.time":
					if date == "" {
						date = s.Value
					}
				case "vcs.modified":
					dirty = s.Value == "true"
				}
			}
		}
		if commit == "" {
			commit = "unknown"
		} else if fromVCS && dirty {
			commit += " (dirty)"
		}
		if date == "" {
			date = "unknown"
		}
		webUI := "not embedded"
		if ui.FS() != nil {
			webUI = "embedded"
		}

		fmt.Printf("lovr %s\n", version)
		fmt.Printf("  commit:   %s\n", commit)
		fmt.Printf("  built:    %s\n", date)
		fmt.Printf("  go:       %s\n", runtime.Version())
		fmt.Printf("  platform: %s/%s\n", runtime.GOOS, runtime.GOARCH)
		fmt.Printf("  web ui:   %s\n", webUI)
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
	rootCmd.Version = version
}
