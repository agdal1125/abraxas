package store_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"cloud.google.com/go/firestore"
	httpapi "github.com/agdal1125/abraxas/server/internal/http"
	"github.com/agdal1125/abraxas/server/internal/play"
	"github.com/agdal1125/abraxas/server/internal/store"
)

func TestFirestoreEmulatorHTTPCompletionRetry(t *testing.T) {
	if os.Getenv("FIRESTORE_EMULATOR_HOST") == "" {
		t.Skip("Firestore emulator unavailable")
	}
	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "demo-abraxas")
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	engine, err := play.Load("../../../content", "fixture-version")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../../../content/quests/fixtures/moka-errand.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Initial play.Snapshot `json:"initial"`
		Success []struct {
			Commands []play.Command `json:"commands"`
		} `json:"success"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	const id = "11111111-1111-4111-8111-111111111111"
	fixture.Initial.PlayID = id
	uid := fmt.Sprintf("test-%d", time.Now().UnixNano())
	// The verifier identifies this isolated test user.
	auth := emulatorUser(uid)
	s := store.NewFirestore(client)
	if _, _, err = s.Create(ctx, uid, "create", play.NewDoc(fixture.Initial)); err != nil {
		t.Fatal(err)
	}
	router := httpapi.NewPlayRouter(nil, httpapi.PlayConfig{Store: s, Engine: engine, Auth: auth, AllowMissingAppCheck: true})
	request := func(key string, revision int, cmd play.Command) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]any{"expectedRevision": revision, "command": cmd})
		req := httptest.NewRequest("POST", "/v1/plays/"+id+"/commands", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer test")
		req.Header.Set("Idempotency-Key", key)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	commands := fixture.Success[0].Commands
	for i, cmd := range commands {
		key := fmt.Sprintf("00000000-0000-4000-8000-%012d", i+1)
		first := request(key, i, cmd)
		if first.Code != 200 {
			t.Fatalf("command %d: %d %s", i, first.Code, first.Body)
		}
		if i == len(commands)-1 {
			retry := request(key, i, cmd)
			if retry.Code != 200 || retry.Body.String() != first.Body.String() {
				t.Fatalf("retry: %d %s", retry.Code, retry.Body)
			}
			duplicate := request("00000000-0000-4000-8000-999999999999", 0, cmd)
			if duplicate.Code != 200 || duplicate.Body.String() != first.Body.String() {
				t.Fatalf("duplicate: %d %s", duplicate.Code, duplicate.Body)
			}
		}
	}
	doc, err := s.Get(ctx, uid, id)
	if err != nil || doc.Snapshot.Revision != int64(len(commands)) || len(doc.CompletedErrands) != 1 || !doc.Events["moka-errand-completed"] || len(doc.Receipts) != len(commands) {
		t.Fatalf("completion: %+v %v", doc, err)
	}
}

type emulatorUser string

func (u emulatorUser) VerifyIDToken(context.Context, string) (string, error) { return string(u), nil }
