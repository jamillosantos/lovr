package processors

import (
	"bufio"
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/fatih/color"
	"github.com/iancoleman/orderedmap"

	"github.com/jamillosantos/lovr/internal/domain"
)

type Stdout struct {
}

func NewStdout() *Stdout {
	return &Stdout{}
}

func (s *Stdout) Process(_ context.Context, entry *domain.Entry) error {
	logEntry := mapToLogEntry(entry)
	data := []domain.LogField{
		{
			Key:   labelLevel,
			Value: s.formatLevel(logEntry.Level)},
		{
			Key:   labelMessage,
			Value: logEntry.Message},
		{
			Key:   labelTimestamp,
			Value: logEntry.Timestamp.Format("2006-01-02 15:04:05.999999999 Z07:00"),
		},
	}
	s.printTable("", data, withColumnWidth(10), withLabelDecorator(labelDecorator))

	dataFields := toDataFields(logEntry.Fields)
	s.printTable("      ", dataFields, withLabelAlignment(labelAlignmentLeft), withTree())

	data = []domain.LogField{}
	if logEntry.Caller != "" {
		data = append(data, domain.LogField{Key: labelCaller, Value: logEntry.Caller})
	}
	hasStacktrace := logEntry.Stacktrace != ""
	if hasStacktrace {
		data = append(data, domain.LogField{Key: labelStacktrace, Value: ""})
	}
	s.printTable("", data, withColumnWidth(10), withLabelDecorator(labelDecorator))
	if hasStacktrace {
		s.printString("    ", s.formatStacktrace(logEntry.Stacktrace))
	}
	fmt.Println("----------------------------------------")
	return nil
}

func toDataFields(m orderedmap.OrderedMap) []domain.LogField {
	fieldKeys := m.Keys()
	dataFields := make([]domain.LogField, 0, len(fieldKeys))
	for _, fieldKey := range fieldKeys {
		v, _ := m.Get(fieldKey)
		dataFields = append(dataFields, domain.LogField{
			Key:   fieldKey,
			Value: v,
		})
	}
	return dataFields
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
		var dataFields []domain.LogField
		switch vv := f.Value.(type) {
		case []domain.LogField:
			dataFields = vv
			break
		case orderedmap.OrderedMap:
			dataFields = toDataFields(vv)
			break
		default:
			fmt.Print(d("%s%s", prefix+p, opts.LabelDecorator("%"+string(opts.labelAlignment)+strconv.Itoa(opts.ColumnWidth)+"s", f.Key)))
			fmt.Printf(": %v\n", f.Value)
			continue
		}
		fmt.Print(d("%s%s", prefix+p, opts.LabelDecorator("%s", f.Key)))
		fmt.Print(":\n")
		p = colorTree("│   ")
		if i == len(table)-1 {
			p = "    "
		}
		s.printTable(prefix+p, dataFields, o...)
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

func mapToLogEntry(inputData *orderedmap.OrderedMap) domain.LogEntry {
	var (
		ts         time.Time
		msg        string
		level      domain.Level
		caller     string
		stacktrace string
	)
	if m, key, ok := getTS(inputData); ok {
		ts = parseTS(m)
		inputData.Delete(key)
	}
	if s, key, ok := getString(inputData, "msg"); ok {
		msg = s
		inputData.Delete(key)
	}
	if s, key, ok := getString(inputData, "level"); ok {
		level = domain.Level(s)
		inputData.Delete(key)
	}
	if s, key, ok := getString(inputData, "caller"); ok {
		caller = s
		inputData.Delete(key)
	}
	if s, key, ok := getString(inputData, "stacktrace"); ok {
		stacktrace = s
		inputData.Delete(key)
	}

	return domain.LogEntry{
		Timestamp:  ts,
		Level:      level,
		Message:    msg,
		Fields:     *inputData,
		Caller:     caller,
		Stacktrace: stacktrace,
	}

}

func parseTS(m interface{}) time.Time {
	switch m := m.(type) {
	case string:
		return parseTSString(m)
	case float64:
		seconds := int64(m) // throw away the
		nseconds := int64((m - float64(seconds)) * float64(time.Second))
		return time.Unix(seconds, nseconds)
	default:
		return time.Time{}
	}
}

var tsFormats = []string{time.Layout, time.ANSIC, time.UnixDate, time.RubyDate, time.RFC822, time.RFC822Z, time.RFC850,
	time.RFC1123, time.RFC1123Z, time.RFC3339, time.RFC3339Nano, time.Stamp, time.StampMilli, time.StampMicro,
	time.StampNano}

func parseTSString(m string) time.Time {
	for _, f := range tsFormats {
		if t, err := time.Parse(f, m); err == nil {
			return t
		}
	}
	return time.Time{}
}

var timestampKeys = []string{"timestamp", "@timestamp", "ts", "time", "date", "datetime"}

func getTS(data *orderedmap.OrderedMap) (interface{}, string, bool) {
	for _, k := range timestampKeys {
		if v, ok := data.Get(k); ok {
			return v, k, true
		}
	}
	return nil, "", false
}

func getString(m *orderedmap.OrderedMap, s ...string) (string, string, bool) {
	for _, k := range s {
		if m, ok := m.Get(k); ok {
			if s, ok := m.(string); ok {
				return s, k, true
			}
		}
	}
	return "", "", false
}
