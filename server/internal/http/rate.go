package httpapi

import (
	"sync"
	"time"
)

// DefaultRequestsPerMinute leaves ample room for a fast player and the scripted E2E run.
const DefaultRequestsPerMinute = 300

// uidRateLimiter counts requests per uid in fixed one-minute windows. Counts are per
// instance, so the effective limit scales with the Cloud Run instance count.
type uidRateLimiter struct {
	limit  int
	now    func() time.Time
	mu     sync.Mutex
	window time.Time
	counts map[string]int
}

func newUIDRateLimiter(limit int) *uidRateLimiter {
	if limit <= 0 {
		limit = DefaultRequestsPerMinute
	}
	return &uidRateLimiter{limit: limit, now: time.Now, counts: map[string]int{}}
}

func (l *uidRateLimiter) allow(uid string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if window := l.now().Truncate(time.Minute); !window.Equal(l.window) {
		l.window = window
		clear(l.counts)
	}
	l.counts[uid]++
	return l.counts[uid] <= l.limit
}
