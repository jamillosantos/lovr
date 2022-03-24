package logctx

import (
	"context"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type contextLoggerKey string

var (
	loggerContextKey contextLoggerKey = "zapcontextinstance"
)

var (
	defaultLogger *zap.Logger
)

func init() {
	cfg := zap.NewDevelopmentConfig()
	cfg.DisableStacktrace = true
	cfg.Encoding = "console"
	l, err := cfg.Build(zap.ErrorOutput(zapcore.Lock(os.Stderr)))
	if err != nil {
		panic(err)
	}
	defaultLogger = l
}

func InitLogger(logger *zap.Logger) {
	defaultLogger = logger
}

func (s contextLoggerKey) String() string {
	return string(s)
}

func From(ctx context.Context) *zap.Logger {
	v := ctx.Value(loggerContextKey)
	if v != nil {
		if logger, ok := v.(*zap.Logger); ok {
			return logger
		}
	}
	return defaultLogger
}

func With(ctx context.Context, logger *zap.Logger) context.Context {
	return context.WithValue(ctx, loggerContextKey, logger)
}

func Error(ctx context.Context, msg string, fields ...zap.Field) {
	From(ctx).Error(msg, fields...)
}

func Warn(ctx context.Context, msg string, fields ...zap.Field) {
	From(ctx).Warn(msg, fields...)
}

func Info(ctx context.Context, msg string, fields ...zap.Field) {
	From(ctx).Info(msg, fields...)
}
