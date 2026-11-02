package httpapi_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	httpapi "github.com/agdal1125/abraxas/server/internal/http"
	"github.com/agdal1125/abraxas/server/internal/play"
	"github.com/agdal1125/abraxas/server/internal/store"
)

func TestDevelopmentAuthRequiresLoopback(t *testing.T) {
	for _, addr := range []string{":8080", "0.0.0.0:8080", "[::1]:8080", "example.com:8080"} {
		if _, err := httpapi.DevelopmentVerifier(true, addr); err == nil {
			t.Fatalf("allowed %s", addr)
		}
	}
	for _, addr := range []string{"127.0.0.1:8080", "localhost:8080"} {
		v, err := httpapi.DevelopmentVerifier(true, addr)
		if err != nil {
			t.Fatal(err)
		}
		uid, err := v.VerifyIDToken(context.Background(), "dev-alice")
		if err != nil || uid != "alice" {
			t.Fatal(uid, err)
		}
		if _, err = v.VerifyIDToken(context.Background(), "dev-"); err == nil {
			t.Fatal("empty uid accepted")
		}
	}
	if v, err := httpapi.DevelopmentVerifier(false, ":8080"); err != nil || v != nil {
		t.Fatal(v, err)
	}
}

func TestPlayRequestLogUsesRoutePattern(t *testing.T) {
	logger, logs := newSilentLogger()
	router := httpapi.NewPlayRouter(logger, httpapi.PlayConfig{})
	req := httptest.NewRequest("POST", "/v1/plays/private-play-id/commands?token=secret-query", nil)
	req.Header.Set("Authorization", "Bearer secret-token")
	router.ServeHTTP(httptest.NewRecorder(), req)
	log := logs.String()
	if !strings.Contains(log, `"route":"POST /v1/plays/{playId}/commands"`) || strings.Contains(log, "private-play-id") || strings.Contains(log, "secret-") {
		t.Fatalf("unsafe or missing route: %s", log)
	}
}

func TestMokaTransportAndConcurrency(t *testing.T) {
	const id = "11111111-1111-4111-8111-111111111111"
	engine, err := play.Load("../../../content", "fixture-version")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../../../content/quests/fixtures/moka-errand.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Initial     play.Snapshot `json:"initial"`
		CompletedAt string        `json:"completedAt"`
		Success     []struct {
			Commands []play.Command `json:"commands"`
		} `json:"success"`
	}
	if err = json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	fixture.Initial.PlayID = id
	mem := store.NewMemory()
	if _, _, err = mem.Create(context.Background(), "one", "create", play.NewDoc(fixture.Initial)); err != nil {
		t.Fatal(err)
	}
	logger, logs := newSilentLogger()
	router := httpapi.NewPlayRouter(logger, httpapi.PlayConfig{Store: mem, Engine: engine, Auth: &fakeVerifier{tokens: map[string]string{"one": "one", "two": "two"}}, AllowMissingAppCheck: true})
	request := func(key, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/v1/plays/"+id+"/commands", strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer one")
		req.Header.Set("Idempotency-Key", key)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	key := func(i int) string { return fmt.Sprintf("00000000-0000-4000-8000-%012d", i) }
	for i, cmd := range fixture.Success[0].Commands {
		body, _ := json.Marshal(map[string]any{"expectedRevision": i, "command": cmd})
		got := request(key(i+1), string(body))
		if got.Code != 200 {
			t.Fatalf("%d: %d %s", i, got.Code, got.Body)
		}
	}
	d, err := mem.Get(context.Background(), "one", id)
	if err != nil {
		t.Fatal(err)
	}
	if d.Snapshot.Revision != int64(len(fixture.Success[0].Commands)) || len(d.CompletedErrands) != 1 || !d.Events["moka-errand-completed"] {
		t.Fatalf("completion: %+v", d)
	}
	before, _ := json.Marshal(d)
	duplicate := request(key(90), `{"expectedRevision":0,"command":{"kind":"complete","targetId":"B"}}`)
	if duplicate.Code != 200 {
		t.Fatal(duplicate.Code, duplicate.Body)
	}
	same := request(key(91), `{"expectedRevision":0,"command":{"kind":"choice","itemId":"moka_01","pick":"a"}}`)
	if same.Code != 200 {
		t.Fatal(same.Code, same.Body)
	}
	locked := request(key(92), `{"expectedRevision":0,"command":{"kind":"choice","itemId":"moka_01","pick":"b"}}`)
	if locked.Code != 409 || !strings.Contains(locked.Body.String(), "choice_locked") {
		t.Fatal(locked.Code, locked.Body)
	}
	after, _ := mem.Get(context.Background(), "one", id)
	rawAfter, _ := json.Marshal(after)
	if string(before) != string(rawAfter) {
		t.Fatal("duplicate changed saved state")
	}
	if strings.Contains(logs.String(), id) {
		t.Fatal("play ID leaked into request log")
	}

	concurrent := store.NewMemory()
	doc := play.NewDoc(fixture.Initial)
	for _, cmd := range fixture.Success[0].Commands[:3] {
		if _, err := engine.Apply(&doc, cmd, fixture.CompletedAt); err != nil {
			t.Fatal(err)
		}
	}
	if _, _, err := concurrent.Create(context.Background(), "one", "create", doc); err != nil {
		t.Fatal(err)
	}
	router = httpapi.NewPlayRouter(logger, httpapi.PlayConfig{Store: concurrent, Engine: engine, Auth: &fakeVerifier{tokens: map[string]string{"one": "one"}}, AllowMissingAppCheck: true})
	commands := []string{`{"expectedRevision":0,"command":{"kind":"set_down","targetId":"moka-rest"}}`, `{"expectedRevision":0,"command":{"kind":"deliver","targetId":"moka-workshop-dropoff"}}`}
	results := make([]int, 2)
	var wg sync.WaitGroup
	for i := range commands {
		wg.Add(1)
		go func(i int) { defer wg.Done(); results[i] = request(key(i+100), commands[i]).Code }(i)
	}
	wg.Wait()
	if !((results[0] == 200 && results[1] == 409) || (results[0] == 409 && results[1] == 200)) {
		t.Fatalf("concurrent results %v", results)
	}
	otherEngine, err := play.Load("../../../content", "other-version")
	if err != nil {
		t.Fatal(err)
	}
	router = httpapi.NewPlayRouter(logger, httpapi.PlayConfig{Store: concurrent, Engine: otherEngine, Auth: &fakeVerifier{tokens: map[string]string{"one": "one"}}, AllowMissingAppCheck: true})
	mismatch := request(key(200), commands[0])
	if mismatch.Code != 409 || !strings.Contains(mismatch.Body.String(), "content_version_unavailable") {
		t.Fatal(mismatch.Code, mismatch.Body)
	}
}

func TestPlayHTTP(t *testing.T) {
	engine, err := play.Load("../../../content", "test-version")
	if err != nil {
		t.Fatal(err)
	}
	router := httpapi.NewPlayRouter(nil, httpapi.PlayConfig{Store: store.NewMemory(), Engine: engine, Auth: &fakeVerifier{tokens: map[string]string{"one": "one", "two": "two"}}, AllowMissingAppCheck: true})
	request := func(method, path, token, key, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		if key != "" {
			req.Header.Set("Idempotency-Key", key)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	key := "00000000-0000-4000-8000-000000000001"
	created := request("POST", "/v1/plays", "one", key, "{}")
	if created.Code != http.StatusCreated {
		t.Fatal(created.Code, created.Body)
	}
	var snap play.Snapshot
	if err := json.Unmarshal(created.Body.Bytes(), &snap); err != nil {
		t.Fatal(err)
	}
	path := "/v1/plays/" + snap.PlayID
	if got := request("GET", path, "two", "", ""); got.Code != 404 {
		t.Fatal(got.Code, got.Body)
	}
	command := `{"expectedRevision":0,"command":{"kind":"choice","itemId":"prologue_01","pick":"a"}}`
	first := request("POST", path+"/commands", "one", key, command)
	if first.Code != 200 {
		t.Fatal(first.Code, first.Body)
	}
	retry := request("POST", path+"/commands", "one", key, command)
	if retry.Code != 200 || retry.Body.String() != first.Body.String() {
		t.Fatal(retry.Code, retry.Body)
	}
	conflict := request("POST", path+"/commands", "one", key, strings.Replace(command, `"a"`, `"b"`, 1))
	if conflict.Code != 409 || !strings.Contains(conflict.Body.String(), "idempotency_conflict") {
		t.Fatal(conflict.Code, conflict.Body)
	}
	bad := request("POST", path+"/commands", "one", "00000000-0000-4000-8000-000000000002", `{"expectedRevision":0,"expectedRevision":0,"command":{"kind":"finish_segment"}}`)
	if bad.Code != 400 {
		t.Fatal(bad.Code, bad.Body)
	}
	for _, body := range []string{`{"expectedRevision":0,"command":{"kind":"finish_segment"},"uid":"two"}`, `{"expectedRevision":null,"command":{"kind":"finish_segment"}}`, `{"expectedRevision":1.5,"command":{"kind":"finish_segment"}}`, `{"expectedRevision":0,"command":{"kind":"finish_segment","targetId":"B"}}`, `{"expectedRevision":0,"command":{"kind":"choice","itemId":null,"pick":"a"}}`} {
		got := request("POST", path+"/commands", "one", "00000000-0000-4000-8000-000000000002", body)
		if got.Code != 400 {
			t.Fatalf("%s: %d %s", body, got.Code, got.Body)
		}
	}
	missing := request("GET", path, "invalid", "", "")
	if missing.Code != 401 || !strings.Contains(missing.Body.String(), "unauthenticated") {
		t.Fatal(missing.Code, missing.Body)
	}
	blocked := httpapi.NewPlayRouter(nil, httpapi.PlayConfig{Store: store.NewMemory(), Engine: engine, Auth: &fakeVerifier{tokens: map[string]string{"one": "one"}}})
	req := httptest.NewRequest("GET", "/v1/plays/current", nil)
	req.Header.Set("Authorization", "Bearer one")
	rec := httptest.NewRecorder()
	blocked.ServeHTTP(rec, req)
	if rec.Code != 403 || !strings.Contains(rec.Body.String(), "app_check_failed") {
		t.Fatal(rec.Code, rec.Body)
	}
}
