package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterResetsEachWindowAndSeparatesUIDs(t *testing.T) {
	limiter := newUIDRateLimiter(1)
	current := time.Date(2026, 11, 7, 12, 0, 10, 0, time.UTC)
	limiter.now = func() time.Time { return current }

	if !limiter.allow("alice") || limiter.allow("alice") {
		t.Fatal("alice should get exactly one request in a window")
	}
	if !limiter.allow("bob") {
		t.Fatal("bob should not share alice's count")
	}
	current = current.Add(time.Minute)
	if !limiter.allow("alice") {
		t.Fatal("a new window should reset the count")
	}
}

func TestPlayRouterRejectsRequestsOverTheLimit(t *testing.T) {
	router := NewPlayRouter(nil, PlayConfig{Auth: developmentVerifier{}, AllowMissingAppCheck: true, RequestsPerMinute: 1})
	get := func(token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/v1/plays/current", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}

	if res := get("dev-alice"); res.Code == http.StatusTooManyRequests {
		t.Fatal("first request was limited")
	}
	res := get("dev-alice")
	if res.Code != http.StatusTooManyRequests || res.Header().Get("Retry-After") != "60" {
		t.Fatalf("over limit: status %d, Retry-After %q", res.Code, res.Header().Get("Retry-After"))
	}
	if res := get("dev-bob"); res.Code == http.StatusTooManyRequests {
		t.Fatal("another uid was limited")
	}
}
