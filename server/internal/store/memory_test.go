package store

import (
	"context"
	"sync"
	"testing"

	"github.com/agdal1125/abraxas/server/internal/play"
)

func TestAtomicUpdate(t *testing.T) {
	s := NewMemory()
	ctx := context.Background()
	_, _, err := s.Create(ctx, "owner", "key", play.NewDoc(play.NewSnapshot("id", "version")))
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	var mu sync.Mutex
	success := 0
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.Update(ctx, "owner", "id", func(d *play.Doc) error {
				if d.Snapshot.Revision != 0 {
					return ErrConflict
				}
				d.Snapshot.Revision++
				return nil
			})
			if err == nil {
				mu.Lock()
				success++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if success != 1 {
		t.Fatalf("successful updates: %d", success)
	}
	if _, err = s.Get(ctx, "other", "id"); err != ErrNotFound {
		t.Fatalf("other owner: %v", err)
	}
}

func TestCreateRetryAfterCompletion(t *testing.T) {
	ctx := context.Background()
	s := NewMemory()
	doc := play.NewDoc(play.NewSnapshot("id", "version"))
	if _, _, err := s.Create(ctx, "owner", "first", doc); err != nil {
		t.Fatal(err)
	}
	if _, created, err := s.Create(ctx, "owner", "second", doc); err != nil || created {
		t.Fatal(created, err)
	}
	if _, err := s.Update(ctx, "owner", "id", func(d *play.Doc) error { d.Snapshot.Segment = "result"; return nil }); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.Create(ctx, "owner", "second", doc); err != nil {
		t.Fatalf("retry: %v", err)
	}
	if _, _, err := s.Create(ctx, "owner", "new", doc); err != ErrReplay {
		t.Fatalf("new replay: %v", err)
	}
}
