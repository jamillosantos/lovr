package parser

import (
	"github.com/jamillosantos/logviewer/internal/domain"
)

type Parser interface {
	Next() (domain.LogEntry, error)
}
