package processors

import (
	"bufio"
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/fatih/color"
	"github.com/xeonx/timeago"

	"github.com/jamillosantos/logviewer/internal/domain"
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
}

type formatOption func(o *formatOpts)

func defaultFormatOpts() formatOpts {
	return formatOpts{
		ColumnWidth:    0,
		LabelDecorator: fmt.Sprintf,
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
	for _, f := range table {
		if vv, ok := f.Value.([]domain.LogField); ok {
			s.printTable("    "+prefix, vv, o...)
			continue
		}
		fmt.Printf("%s%s: %s\n", prefix, opts.LabelDecorator("%"+string(opts.labelAlignment)+strconv.Itoa(opts.ColumnWidth)+"s", f.Key), f.Value)
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
		fields = append(inputFields, domain.LogField{
			Key:   k,
			Value: fmt.Sprint(v),
		})
	}
	return fields
}

func (s *Stdout) Process(ctx context.Context, entry domain.LogEntry) error {
	dataFields := s.prepareFields(entry.Fields)
	data := []domain.LogField{
		{labelLevel, s.formatLevel(entry.Level)},
		{labelMessage, entry.Message},
		{labelTimestamp, fmt.Sprintf("%s (%s)", entry.Timestamp.Format(time.RFC3339Nano), timeAgoDecorator(timeago.English.Format(entry.Timestamp)))},
	}
	if len(dataFields) > 0 {
		data = append(data, domain.LogField{Key: labelFields, Value: ""})
	}
	s.printTable("", data, withColumnWidth(10), withLabelDecorator(labelDecorator))

	s.printTable("      ", dataFields, withLabelAlignment(labelAlignmentLeft))

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
	fmt.Println("---")
	fmt.Println("---")
	return nil
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
