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

	raw, err := io.ReadAll(r.Body)
	if err != nil {
		var max *http.MaxBytesError
		if errors.As(err, &max) {
			WriteError(w, http.StatusRequestEntityTooLarge, "request_too_large")
		} else {
			WriteError(w, http.StatusBadRequest, "invalid_request")
		}
		return err
	}
	check := json.NewDecoder(bytes.NewReader(raw))
	if err := checkObject(check); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid_request")
		return err
	}
	if _, err := check.Token(); err != io.EOF {
		WriteError(w, http.StatusBadRequest, "invalid_request")
		return errors.New("trailing JSON")
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			WriteError(w, http.StatusRequestEntityTooLarge, "request_too_large")
			return err
		}
		WriteError(w, http.StatusBadRequest, "invalid_request")
		return err
	}

	// Ensure there is no trailing data after the first JSON value.
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			WriteError(w, http.StatusRequestEntityTooLarge, "request_too_large")
			return err
		}
		WriteError(w, http.StatusBadRequest, "invalid_request")
		if err == nil {
			return errors.New("request body must contain a single JSON value")
		}
		return err
	}

	return nil
}

func checkObject(dec *json.Decoder) error {
	token, err := dec.Token()
	if err != nil {
		return err
	}
	if token != json.Delim('{') {
		return errors.New("object required")
	}
	return checkFields(dec)
}
func checkFields(dec *json.Decoder) error {
	seen := map[string]bool{}
	for dec.More() {
		token, err := dec.Token()
		if err != nil {
			return err
		}
		key, ok := token.(string)
		if !ok || seen[key] {
			return errors.New("duplicate or invalid key")
		}
		seen[key] = true
		if err := checkValue(dec); err != nil {
			return err
		}
	}
	token, err := dec.Token()
	if err != nil {
		return err
	}
	if token != json.Delim('}') {
		return errors.New("invalid object")
	}
	return nil
}
func checkValue(dec *json.Decoder) error {
	token, err := dec.Token()
	if err != nil {
		return err
	}
	switch token {
	case json.Delim('{'):
		return checkFields(dec)
	case json.Delim('['):
		for dec.More() {
			if err := checkValue(dec); err != nil {
				return err
			}
		}
		_, err = dec.Token()
		return err
	}
	return nil
}
