// Package ui holds the web interface. The TypeScript/React sources live in
// this directory (built with bun into dist/), and the built assets are
// embedded into the binary when building with the "ui" build tag:
//
//	cd ui && bun install && bun run build
//	go build -tags ui ./lovr
package ui

import "io/fs"

var uiFS fs.FS

// FS returns the built UI assets, or nil when the binary was built without
// the "ui" build tag.
func FS() fs.FS {
	return uiFS
}
