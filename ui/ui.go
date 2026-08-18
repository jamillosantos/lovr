// Package ui holds the web interface. The TypeScript/React sources live in
// this directory and are built with bun into dist/, which is embedded into
// the binary:
//
//	go generate ./ui
//	go build .
package ui

import (
	"embed"
	"io/fs"
)

//go:generate bun install
//go:generate bun run build

//go:embed all:dist
var dist embed.FS

// FS returns the built UI assets, or nil when dist/ had no built assets at
// compile time (e.g. a build straight from a fresh checkout without running
// the bun build first).
func FS() fs.FS {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		return nil
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return nil
	}
	return sub
}
