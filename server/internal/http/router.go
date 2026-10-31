package httpapi

import (
	"log/slog"
	"net/http"
)

type healthResponse struct {
	Status string `json:"status"`
}

// NewRouter constructs the HTTP handler with standard middleware and routes.
func NewRouter(logger *slog.Logger) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealthz)

	var handler http.Handler = mux
	handler = MaxBodyBytesMiddleware(DefaultMaxBodyBytes)(handler)
	handler = TimeoutMiddleware(DefaultRequestTimeout)(handler)
	handler = RecoverMiddleware(logger)(handler)
	handler = RequestLogMiddleware(logger)(handler)

	return handler
}

func handleHealthz(w http.ResponseWriter, _ *http.Request) {
	WriteJSON(w, http.StatusOK, healthResponse{Status: "ok"})
}
