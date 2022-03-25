package filters

import "io"

type Filter interface {
	io.Reader
}
