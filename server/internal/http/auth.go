package httpapi

import (
	"context"
	"net/http"
	"strings"
)

// TokenVerifier verifies a Firebase ID token and returns the authenticated user's UID.
type TokenVerifier interface {
	VerifyIDToken(ctx context.Context, token string) (uid string, err error)
}

type uidContextKey struct{}

// UIDFromContext retrieves the authenticated UID stored in ctx by AuthMiddleware.
func UIDFromContext(ctx context.Context) (string, bool) {
	uid, ok := ctx.Value(uidContextKey{}).(string)
	if !ok || uid == "" {
		return "", false
	}
	return uid, true
}

// AuthMiddleware parses the Authorization: Bearer <token> header, verifies the token,
// and stores the resulting UID in the request context.
func AuthMiddleware(verifier TokenVerifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if verifier == nil {
				WriteError(w, http.StatusUnauthorized, "unauthorized")
				return
			}

			authHeader := r.Header.Get("Authorization")
			scheme, token, ok := strings.Cut(authHeader, " ")
			if !ok || !strings.EqualFold(scheme, "Bearer") {
				WriteError(w, http.StatusUnauthorized, "unauthorized")
				return
			}

			token = strings.TrimSpace(token)
			if token == "" || strings.ContainsAny(token, " \t\r\n") {
				WriteError(w, http.StatusUnauthorized, "unauthorized")
				return
			}

			uid, err := verifier.VerifyIDToken(r.Context(), token)
			if err != nil || strings.TrimSpace(uid) == "" {
				WriteError(w, http.StatusUnauthorized, "unauthorized")
				return
			}

			ctx := context.WithValue(r.Context(), uidContextKey{}, uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
