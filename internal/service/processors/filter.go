package processors

import (
	"context"
	"errors"
	"unsafe"

	"github.com/antonmedv/expr"
	"github.com/antonmedv/expr/vm"

	"github.com/jamillosantos/lovr/internal/domain"
	"github.com/jamillosantos/lovr/internal/service"
)

var (
	ErrFilterExpressionMustReturnBoolean = errors.New("filter expression must return boolean")
)

type Filter struct {
	filter string
	expr   *vm.Program
}

func NewFilter(filter string) (*Filter, error) {
	e, err := expr.Compile(filter)
	if err != nil {
		return nil, err
	}

	return &Filter{
		filter: filter,
		expr:   e,
	}, nil
}

type orderedMap struct {
	keys       []string
	values     map[string]interface{}
	escapeHTML bool
}

func (f *Filter) Process(_ context.Context, entry *domain.Entry) error {
	x := (*orderedMap)(unsafe.Pointer(entry)) // dirty trick to access the map keys without rebunding the `map[string]interface{}`.
	output, err := expr.Run(f.expr, x.values)
	if err != nil {
		return err
	}
	result, ok := output.(bool)
	if !ok {
		return ErrFilterExpressionMustReturnBoolean
	}
	if !result {
		return service.ErrSkipEntry
	}
	return nil
}
