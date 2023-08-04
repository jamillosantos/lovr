package processors

import (
	"bufio"
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/fatih/color"

	"github.com/jamillosantos/lovr/internal/domain"
)

type Stdout struct {
}

func NewStdout() *Stdout {
	return &Stdout{}
}

func (s *Stdout) prefix(n int) string {
	return strings.Repeat("  ", n)
}

var (
	labelDecorator   = color.New(color.FgHiWhite, color.Bold).Sprintf
	timeAgoDecorator = color.New(color.Italic).Sprintf
)

var (
	labelTimestamp  = "Timestamp"
	labelLevel      = "Level"
	labelMessage    = "Message"
	labelFields     = "Fields"
	labelCaller     = "Caller"
	labelStacktrace = "Stacktrace"
)

type formatDecorator func(format string, args ...interface{}) string

type labelAlignment string

const (
	labelAlignmentLeft  = "-"
	labelAlignmentRight = ""
)

type formatOpts struct {
	ColumnWidth    int
	LabelDecorator formatDecorator
	labelAlignment labelAlignment
	tree           bool
}

type formatOption func(o *formatOpts)

func defaultFormatOpts() formatOpts {
	return formatOpts{
		ColumnWidth:    0,
		LabelDecorator: fmt.Sprintf,
		tree:           false,
	}
}

func withColumnWidth(width int) formatOption {
	return func(o *formatOpts) {
		o.ColumnWidth = width
	}
}

func withLabelDecorator(decorator formatDecorator) formatOption {
	return func(o *formatOpts) {
		o.LabelDecorator = decorator
	}
}

func withLabelAlignment(alignment labelAlignment) formatOption {
	return func(o *formatOpts) {
		o.labelAlignment = alignment
	}
}

func (s *Stdout) printTable(prefix string, table []domain.LogField, o ...formatOption) (opts formatOpts) {
	opts = defaultFormatOpts()
	for _, option := range o {
		option(&opts)
	}
	if opts.ColumnWidth == 0 {
		for _, f := range table {
			if opts.ColumnWidth < len(f.Key) {
				opts.ColumnWidth = len(f.Key)
			}
		}
	}
	for i, f := range table {
		p := ""
		if opts.tree {
			p = colorTree("├─ ")
			if i == len(table)-1 {
				p = colorTree("└─ ")
			}
		}
		d := fmt.Sprintf
		if f.Key == "error" {
			d = levelMapping[domain.LevelError]
		}
		if vv, ok := f.Value.([]domain.LogField); ok {
			fmt.Print(d("%s%s", prefix+p, opts.LabelDecorator("%s", f.Key)))
			fmt.Print(":\n")
			p := colorTree("│   ")
			if i == len(table)-1 {
				p = "    "
			}
			s.printTable(prefix+p, vv, o...)
			continue
		}
		fmt.Print(d("%s%s", prefix+p, opts.LabelDecorator("%"+string(opts.labelAlignment)+strconv.Itoa(opts.ColumnWidth)+"s", f.Key)))
		fmt.Printf(": %v\n", f.Value)
	}
	return
}

func (s *Stdout) printString(prefix string, str string) {
	scanner := bufio.NewScanner(strings.NewReader(str))
	for scanner.Scan() {
		line := scanner.Text()
		fmt.Printf("%s%s\n", prefix, line)
	}
}

func (s *Stdout) prepareFields(inputFields []domain.LogField) []domain.LogField {
	fields := make([]domain.LogField, 0)
	for _, f := range inputFields {
		k, v := f.Key, f.Value
		fields = append(fields, domain.LogField{
			Key:   k,
			Value: fmt.Sprint(v),
		})
	}
	return fields
}

func (s *Stdout) Process(ctx context.Context, entry domain.LogEntry) error {
	// dataFields := s.prepareFields(entry.Fields)
	dataFields := entry.Fields
	data := []domain.LogField{
		{
			Key:   labelLevel,
			Value: s.formatLevel(entry.Level)},
		{
			Key:   labelMessage,
			Value: entry.Message},
		{
			Key:   labelTimestamp,
			Value: entry.Timestamp.Format("2006-01-02 15:04:05.999999999 Z07:00"),
		},
	}
	if len(dataFields) > 0 {
		data = append(data, domain.LogField{Key: labelFields, Value: ""})
	}
	s.printTable("", data, withColumnWidth(10), withLabelDecorator(labelDecorator))

	s.printTable("      ", dataFields, withLabelAlignment(labelAlignmentLeft), withTree())

	data = []domain.LogField{}
	if entry.Caller != "" {
		data = append(data, domain.LogField{Key: labelCaller, Value: entry.Caller})
	}
	hasStacktrace := entry.Stacktrace != ""
	if hasStacktrace {
		data = append(data, domain.LogField{Key: labelStacktrace, Value: ""})
	}
	s.printTable("", data, withColumnWidth(10), withLabelDecorator(labelDecorator))
	if hasStacktrace {
		s.printString("    ", s.formatStacktrace(entry.Stacktrace))
	}
	fmt.Println("----------------------------------------")
	return nil
}

func withTree() formatOption {
	return func(o *formatOpts) {
		o.tree = true
	}
}

var (
	levelMapping = map[domain.Level]formatDecorator{
		domain.LevelDebug:   color.New(color.Bold, color.FgHiBlue).Sprintf,
		domain.LevelError:   color.New(color.Bold, color.FgHiRed).Sprintf,
		domain.LevelInfo:    color.New(color.Bold, color.FgHiCyan).Sprintf,
		domain.LevelWarning: color.New(color.Bold, color.FgHiYellow).Sprintf,
		domain.LevelFatal:   color.New(color.Bold, color.BgHiRed, color.FgHiWhite).Sprintf,
		domain.LevelPanic:   color.New(color.Bold, color.BgHiRed, color.FgHiWhite).Sprintf,
	}

	colorTree = color.New(color.FgHiBlack).Sprint
)

func (s *Stdout) formatLevel(level domain.Level) string {
	m, ok := levelMapping[level]
	if !ok {
		return level.String()
	}
	return m(level.String())
}

func (s *Stdout) formatStacktrace(stacktrace string) string {
	// TODO Create a method for highlighting the stack trace.
	return stacktrace
}
