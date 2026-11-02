package store

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/agdal1125/abraxas/server/internal/play"
)

func TestFirestoreEmulatorCreateRetry(t *testing.T) {
	if os.Getenv("FIRESTORE_EMULATOR_HOST") == "" {
		t.Skip("Firestore emulator unavailable")
	}
	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "demo-abraxas")
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	s := NewFirestore(client)
	uid := fmt.Sprintf("%s-%d", t.Name(), time.Now().UnixNano())
	doc := play.NewDoc(play.NewSnapshot("play", "version"))
	_, created, err := s.Create(ctx, uid, "key", doc)
	if err != nil || !created {
		t.Fatal(created, err)
	}
	_, created, err = s.Create(ctx, uid, "key", doc)
	if err != nil || created {
		t.Fatal(created, err)
	}
	complete := func(d *play.Doc) error {
		if _, ok := d.Receipts["command"]; ok {
			return nil
		}
		if d.Snapshot.Revision != 0 {
			return ErrConflict
		}
		d.Snapshot.Revision++
		d.Events["moka-errand-completed"] = true
		d.Receipts["command"] = play.StoredReceipt{Receipt: play.Receipt{Key: "command", AppliedRevision: 1}}
		return nil
	}
	if _, err = s.Update(ctx, uid, "play", complete); err != nil {
		t.Fatal(err)
	}
	// Repeat after a successful commit, as if its response was lost.
	retry, err := s.Update(ctx, uid, "play", complete)
	if err != nil || retry.Snapshot.Revision != 1 || !retry.Events["moka-errand-completed"] || len(retry.Receipts) != 1 {
		t.Fatal(retry, err)
	}
	ref := client.Collection("players").Doc(uid).Collection("plays").Doc("play")
	if _, err := ref.Collection("commands").Doc("command").Get(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := ref.Collection("events").Doc("moka-errand-completed").Get(ctx); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.Update(ctx, uid, "play", func(d *play.Doc) error {
				if d.Snapshot.Revision != 1 {
					return ErrConflict
				}
				d.Snapshot.Revision++
				return nil
			})
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	var success, conflicts int
	for err := range results {
		if err == nil {
			success++
		} else if err == ErrConflict {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if success != 1 || conflicts != 1 {
		t.Fatalf("success=%d conflict=%d", success, conflicts)
	}
}
