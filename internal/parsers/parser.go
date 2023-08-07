package parsers

import (
	"github.com/jamillosantos/lovr/internal/domain"
)

type Parser interface {
	Next() (domain.Entry, error)
}
