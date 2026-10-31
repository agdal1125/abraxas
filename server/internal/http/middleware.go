package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"
)

// DefaultRequestTimeout is the default per-request context timeout.
const DefaultRequestTimeout = 10 * time.Second

type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func wrapStatusRecorder(w http.ResponseWriter) *statusRecorder {
	if rec, ok := w.(*statusRecorder); ok {
		return rec
	}
	return &statusRecorder{
		ResponseWriter: w,
		status:         http.StatusOK,
	}
}

func (r *statusRecorder) WriteHeader(code int) {
	if !r.wroteHeader {
		r.status = code
		r.wroteHeader = true
		r.ResponseWriter.WriteHeader(code)
	}
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if !r.wroteHeader {
		r.WriteHeader(http.StatusOK)
	}
	return r.ResponseWriter.Write(b)
}

func (r *statusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}

// RecoverMiddleware recovers from panics in downstream handlers, logs internal details,
// and returns a generic 500 JSON response to the client.
func RecoverMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rec := wrapStatusRecorder(w)
			defer func() {
				if p := recover(); p != nil {
					logger.ErrorContext(r.Context(), "panic recovered",
						slog.String("method", r.Method),
						slog.String("path", r.URL.Path),
						slog.Any("panic", p),
					)
					if !rec.wroteHeader {
						WriteError(rec, http.StatusInternalServerError, "internal server error")
					}
				}
			}()
			next.ServeHTTP(rec, r)
		})
	}
}

// RequestLogMiddleware logs only the HTTP method, URL path, status code, and duration.
// Query strings, headers, request bodies, and tokens are never logged.
func RequestLogMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := wrapStatusRecorder(w)

			next.ServeHTTP(rec, r)

			logger.InfoContext(r.Context(), "http request",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rec.status),
				slog.Duration("duration", time.Since(start)),
			)
		})
	}
}

// TimeoutMiddleware attaches a deadline to the request context.
func TimeoutMiddleware(timeout time.Duration) func(http.Handler) http.Handler {
	if timeout <= 0 {
		timeout = DefaultRequestTimeout
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// MaxBodyBytesMiddleware limits the size of incoming request bodies using http.MaxBytesReader.
func MaxBodyBytesMiddleware(maxBytes int64) func(http.Handler) http.Handler {
	if maxBytes <= 0 {
		maxBytes = DefaultMaxBodyBytes
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			}
			next.ServeHTTP(w, r)
		})
	}
}
