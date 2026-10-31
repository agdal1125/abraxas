package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	httpapi "github.com/agdal1125/abraxas/server/internal/http"
)

type fakeVerifier struct {
	tokens map[string]string
}

func (f *fakeVerifier) VerifyIDToken(_ context.Context, token string) (string, error) {
	uid, ok := f.tokens[token]
	if !ok {
		return "", errors.New("invalid token")
	}
	return uid, nil
}

func newSilentLogger() (*slog.Logger, *bytes.Buffer) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	return logger, &buf
}

func TestHealthz(t *testing.T) {
	logger, logBuf := newSilentLogger()
	router := httpapi.NewRouter(logger)

	req := httptest.NewRequest(http.MethodGet, "/healthz?secret=should-not-log", nil)
	req.Header.Set("Authorization", "Bearer top-secret-token")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status 'ok', got %q", body["status"])
	}

	logOutput := logBuf.String()
	if strings.Contains(logOutput, "should-not-log") || strings.Contains(logOutput, "top-secret-token") {
		t.Fatalf("request log leaked sensitive query or token: %s", logOutput)
	}
}

func TestAuthMiddleware(t *testing.T) {
	verifier := &fakeVerifier{
		tokens: map[string]string{
			"valid-token-123": "uid-from-token",
		},
	}

	protected := httpapi.AuthMiddleware(verifier)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid, ok := httpapi.UIDFromContext(r.Context())
		if !ok {
			httpapi.WriteError(w, http.StatusInternalServerError, "missing uid in context")
			return
		}
		httpapi.WriteJSON(w, http.StatusOK, map[string]string{"uid": uid})
	}))

	tests := []struct {
		name       string
		authHeader string
		wantStatus int
		wantUID    string
	}{
		{
			name:       "missing authorization header",
			authHeader: "",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "non-bearer scheme",
			authHeader: "Basic dXNlcjpwYXNz",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "bearer without token",
			authHeader: "Bearer   ",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "bearer with extra spaces in token",
			authHeader: "Bearer token1 token2",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "verification failure",
			authHeader: "Bearer invalid-token",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "verification success",
			authHeader: "Bearer valid-token-123",
			wantStatus: http.StatusOK,
			wantUID:    "uid-from-token",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}
			rec := httptest.NewRecorder()

			protected.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("expected status %d, got %d (body: %s)", tc.wantStatus, rec.Code, rec.Body.String())
			}

			if tc.wantStatus == http.StatusOK {
				var got map[string]string
				if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
					t.Fatalf("failed to decode response: %v", err)
				}
				if got["uid"] != tc.wantUID {
					t.Fatalf("expected uid %q, got %q", tc.wantUID, got["uid"])
				}
			} else {
				var errResp map[string]string
				if err := json.Unmarshal(rec.Body.Bytes(), &errResp); err != nil {
					t.Fatalf("failed to decode error response: %v", err)
				}
				if errResp["error"] == "" {
					t.Fatalf("expected error message in response, got %v", errResp)
				}
			}
		})
	}
}

func TestDecodeJSONAndBodyLimit(t *testing.T) {
	type samplePayload struct {
		Name string `json:"name"`
	}

	handler := httpapi.MaxBodyBytesMiddleware(httpapi.DefaultMaxBodyBytes)(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var p samplePayload
			if err := httpapi.DecodeJSON(w, r, &p); err != nil {
				return
			}
			httpapi.WriteJSON(w, http.StatusOK, p)
		}),
	)

	t.Run("valid payload", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/items", strings.NewReader(`{"name":"abraxas"}`))
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", rec.Code)
		}
	})

	t.Run("unknown field rejected with 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/items", strings.NewReader(`{"name":"abraxas","unknown":123}`))
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400 for unknown field, got %d", rec.Code)
		}
		var errResp map[string]string
		if err := json.Unmarshal(rec.Body.Bytes(), &errResp); err != nil {
			t.Fatalf("failed to decode error response: %v", err)
		}
		if errResp["error"] == "" {
			t.Fatalf("expected non-empty error field, got %v", errResp)
		}
	})

	t.Run("malformed JSON rejected with 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/items", strings.NewReader(`{"name":`))
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400 for malformed JSON, got %d", rec.Code)
		}
	})

	t.Run("body exceeding 64KB rejected with 413", func(t *testing.T) {
		largeValue := strings.Repeat("a", int(httpapi.DefaultMaxBodyBytes)+1024)
		body := `{"name":"` + largeValue + `"}`
		req := httptest.NewRequest(http.MethodPost, "/items", strings.NewReader(body))
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("expected status 413 for >64KB body, got %d (body: %s)", rec.Code, rec.Body.String())
		}
		var errResp map[string]string
		if err := json.Unmarshal(rec.Body.Bytes(), &errResp); err != nil {
			t.Fatalf("failed to decode error response: %v", err)
		}
		if errResp["error"] == "" {
			t.Fatalf("expected non-empty error field, got %v", errResp)
		}
	})
}

func TestRecoverMiddleware(t *testing.T) {
	logger, logBuf := newSilentLogger()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /panic", func(_ http.ResponseWriter, _ *http.Request) {
		panic("sensitive internal stack error")
	})
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		httpapi.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	handler := httpapi.RequestLogMiddleware(logger)(
		httpapi.RecoverMiddleware(logger)(mux),
	)

	srv := httptest.NewServer(handler)
	defer srv.Close()

	// 1. Trigger panic -> 500
	resp, err := http.Get(srv.URL + "/panic")
	if err != nil {
		t.Fatalf("request to /panic failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected status 500 on panic, got %d", resp.StatusCode)
	}

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("failed to read response body: %v", err)
	}
	if strings.Contains(string(rawBody), "sensitive internal stack error") {
		t.Fatalf("internal panic detail leaked to response body: %s", string(rawBody))
	}

	var errResp map[string]string
	if err := json.Unmarshal(rawBody, &errResp); err != nil {
		t.Fatalf("failed to decode 500 JSON response: %v", err)
	}
	if errResp["error"] != "internal server error" {
		t.Fatalf("unexpected error message: %q", errResp["error"])
	}

	// Internal log must contain the panic message.
	if !strings.Contains(logBuf.String(), "sensitive internal stack error") {
		t.Fatalf("expected internal log to record panic detail, got: %s", logBuf.String())
	}

	// 2. Server continues serving subsequent requests normally.
	resp2, err := http.Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatalf("subsequent request to /healthz failed: %v", err)
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200 after panic recovery, got %d", resp2.StatusCode)
	}
}

func TestTimeoutMiddleware(t *testing.T) {
	timeout := 250 * time.Millisecond
	var hasDeadline bool
	var remaining time.Duration

	handler := httpapi.TimeoutMiddleware(timeout)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var deadline time.Time
		deadline, hasDeadline = r.Context().Deadline()
		if hasDeadline {
			remaining = time.Until(deadline)
		}
		httpapi.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}))

	req := httptest.NewRequest(http.MethodGet, "/test-timeout", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if !hasDeadline {
		t.Fatal("expected TimeoutMiddleware to set a context deadline, but none was set")
	}
	if remaining <= 0 || remaining > timeout {
		t.Fatalf("expected remaining time in (0, %v], got %v", timeout, remaining)
	}
}
