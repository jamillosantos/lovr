package domain

type Level string

const (
	LevelDebug   Level = "debug"
	LevelError   Level = "error"
	LevelInfo    Level = "info"
	LevelWarning Level = "warning"
	LevelFatal   Level = "fatal"
	LevelPanic   Level = "panic"
)

var (
	levelMap = map[Level]string{
		LevelDebug:   "Debug",
		LevelError:   "Error",
		LevelInfo:    "Info",
		LevelWarning: "Warning",
		LevelFatal:   "Fatal",
		LevelPanic:   "Panic",
	}
)

func (l Level) String() string {
	return levelMap[l]
}
