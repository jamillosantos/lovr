package service

import (
	"io"
	"os"
)

func GetSource(source string) (io.Reader, func(), error) {
	if source == "-" {
		return os.Stdin, func() {}, nil
	}

	f, err := os.Open(source)
	if err != nil {
		return nil, nil, err
	}
	return f, func() {
		_ = f.Close()
	}, nil
}
