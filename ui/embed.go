//go:build ui

package ui

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var dist embed.FS

func init() {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		panic(err)
	}
	uiFS = sub
}
