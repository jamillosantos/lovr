package processors

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jamillosantos/logviewer/internal/domain"
)

type Stdout struct {
}

func NewStdout() *Stdout {
	return &Stdout{}
}

func (s *Stdout) Process(ctx context.Context, entry domain.LogEntry) error {
	// TODO: To format it properly
	data, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(data))
	return nil
}
