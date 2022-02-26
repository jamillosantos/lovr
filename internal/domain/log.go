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

func (l Level) String() string {
	return string(l)
}
