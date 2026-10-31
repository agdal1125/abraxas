package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

// DefaultMaxBodyBytes is the default limit for incoming HTTP request bodies (64KB).
const DefaultMaxBodyBytes int64 = 64 * 1024

type errorResponse struct {
	Error string `json:"error"`
}

// WriteJSON serializes v as JSON and writes it with the given HTTP status code.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(true)
	if err := enc.Encode(v); err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"internal server error"}` + "\n"))
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(buf.Bytes())
}

// WriteError writes a JSON error payload with an external-safe message.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, errorResponse{Error: message})
}

// DecodeJSON reads and validates a single JSON object from r.Body into dst.
// It rejects unknown fields, bodies exceeding DefaultMaxBodyBytes (413), and malformed payloads (400).
// On error, it writes the corresponding JSON error response to w and returns the error.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	if r.Body == nil {
		err := errors.New("empty request body")
		WriteError(w, http.StatusBadRequest, "invalid request body")
		return err
	}

	r.Body = http.MaxBytesReader(w, r.Body, DefaultMaxBodyBytes)

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			WriteError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return err
		}
		WriteError(w, http.StatusBadRequest, "invalid request body")
		return err
	}

	// Ensure there is no trailing data after the first JSON value.
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			WriteError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return err
		}
		WriteError(w, http.StatusBadRequest, "invalid request body")
		if err == nil {
			return errors.New("request body must contain a single JSON value")
		}
		return err
	}

	return nil
}
