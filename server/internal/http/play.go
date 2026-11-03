package httpapi

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/agdal1125/abraxas/server/internal/play"
	"github.com/agdal1125/abraxas/server/internal/store"
)

type AppCheckVerifier interface {
	VerifyAppCheck(context.Context, string) error
}
type developmentVerifier struct{}

func (developmentVerifier) VerifyIDToken(_ context.Context, token string) (string, error) {
	uid, ok := strings.CutPrefix(token, "dev-")
	if !ok || !idPattern.MatchString(uid) {
		return "", errors.New("invalid development token")
	}
	return uid, nil
}
func DevelopmentVerifier(enabled bool, addr string) (TokenVerifier, error) {
	if !enabled {
		return nil, nil
	}
	host, _, err := net.SplitHostPort(addr)
	if err != nil || (host != "localhost" && host != "127.0.0.1") {
		return nil, errors.New("development auth requires loopback")
	}
	return developmentVerifier{}, nil
}

type PlayConfig struct {
	Store                store.Store
	Engine               *play.Engine
	Auth                 TokenVerifier
	AppCheck             AppCheckVerifier
	AllowMissingAppCheck bool
}

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
var idPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

func NewPlayRouter(logger *slog.Logger, c PlayConfig) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealthz)
	h := &playHandler{c}
	protect := func(next http.HandlerFunc) http.Handler {
		api := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if c.AppCheck == nil {
				if !c.AllowMissingAppCheck {
					WriteError(w, 403, "app_check_failed")
					return
				}
			} else if err := c.AppCheck.VerifyAppCheck(r.Context(), r.Header.Get("X-Firebase-AppCheck")); err != nil {
				WriteError(w, 403, "app_check_failed")
				return
			}
			next.ServeHTTP(w, r)
		})
		auth := AuthMiddleware(c.Auth)(api)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { auth.ServeHTTP(&authResponse{ResponseWriter: w}, r) })
	}
	mux.Handle("POST /v1/plays", protect(h.create))
	mux.Handle("GET /v1/plays/current", protect(h.current))
	mux.Handle("GET /v1/plays/{playId}", protect(h.get))
	mux.Handle("POST /v1/plays/{playId}/commands", protect(h.command))
	var handler http.Handler = mux
	handler = RecoverMiddleware(logger)(handler)
	handler = RequestLogMiddleware(logger)(handler)
	handler = MaxBodyBytesMiddleware(DefaultMaxBodyBytes)(handler)
	handler = TimeoutMiddleware(DefaultRequestTimeout)(handler)
	return handler
}

type authResponse struct {
	http.ResponseWriter
	unauthorized bool
}

func (w *authResponse) WriteHeader(code int) {
	w.unauthorized = code == http.StatusUnauthorized
	w.ResponseWriter.WriteHeader(code)
}
func (w *authResponse) Write(b []byte) (int, error) {
	if w.unauthorized {
		_, err := w.ResponseWriter.Write([]byte("{\"error\":\"unauthenticated\"}\n"))
		return len(b), err
	}
	return w.ResponseWriter.Write(b)
}

type playHandler struct{ config PlayConfig }

func newID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:]), nil
}
func (h *playHandler) ready(w http.ResponseWriter) bool {
	if h.config.Store == nil || h.config.Engine == nil {
		WriteError(w, 503, "storage_unavailable")
		return false
	}
	return true
}
func fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		WriteError(w, 404, "play_not_found")
	case errors.Is(err, store.ErrConflict):
		WriteError(w, 409, "revision_conflict")
	case errors.Is(err, store.ErrReplay):
		WriteError(w, 409, "replay_not_ready")
	case errors.Is(err, play.ErrTransition):
		WriteError(w, 422, "invalid_transition")
	case err.Error() == "idempotency_conflict" || err.Error() == "choice_locked" || err.Error() == "content_version_unavailable":
		WriteError(w, 409, err.Error())
	default:
		WriteError(w, 503, "storage_unavailable")
	}
}
func (h *playHandler) send(w http.ResponseWriter, d play.Doc) {
	if d.Snapshot.ContentVersion != h.config.Engine.Version {
		WriteError(w, 409, "content_version_unavailable")
		return
	}
	WriteJSON(w, 200, d.Snapshot)
}
func (h *playHandler) create(w http.ResponseWriter, r *http.Request) {
	if !h.ready(w) {
		return
	}
	key := r.Header.Get("Idempotency-Key")
	if !uuidPattern.MatchString(key) {
		WriteError(w, 400, "invalid_request")
		return
	}
	var body map[string]json.RawMessage
	if DecodeJSON(w, r, &body) != nil {
		return
	}
	if len(body) != 0 {
		WriteError(w, 400, "invalid_request")
		return
	}
	id, err := newID()
	if err != nil {
		fail(w, err)
		return
	}
	uid, _ := UIDFromContext(r.Context())
	d, created, err := h.config.Store.Create(r.Context(), uid, key, play.NewDoc(play.NewSnapshot(id, h.config.Engine.Version)))
	if err != nil {
		fail(w, err)
		return
	}
	if d.Snapshot.ContentVersion != h.config.Engine.Version {
		fail(w, errors.New("content_version_unavailable"))
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	WriteJSON(w, status, d.Snapshot)
}
func (h *playHandler) current(w http.ResponseWriter, r *http.Request) {
	if !h.ready(w) {
		return
	}
	uid, _ := UIDFromContext(r.Context())
	d, err := h.config.Store.Current(r.Context(), uid)
	if err != nil {
		fail(w, err)
		return
	}
	h.send(w, d)
}
func (h *playHandler) get(w http.ResponseWriter, r *http.Request) {
	if !h.ready(w) {
		return
	}
	id := r.PathValue("playId")
	if !uuidPattern.MatchString(id) {
		WriteError(w, 400, "invalid_request")
		return
	}
	uid, _ := UIDFromContext(r.Context())
	d, err := h.config.Store.Get(r.Context(), uid, id)
	if err != nil {
		fail(w, err)
		return
	}
	h.send(w, d)
}

type commandRequest struct {
	ExpectedRevision int64        `json:"expectedRevision"`
	Command          play.Command `json:"command"`
}

func parseCommand(body map[string]json.RawMessage) (commandRequest, error) {
	var out commandRequest
	if len(body) != 2 || body["expectedRevision"] == nil || body["command"] == nil {
		return out, errors.New("fields")
	}
	if err := json.Unmarshal(body["expectedRevision"], &out.ExpectedRevision); err != nil || out.ExpectedRevision < 0 || string(body["expectedRevision"]) == "null" {
		return out, errors.New("revision")
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body["command"], &fields); err != nil || fields == nil {
		return out, errors.New("command")
	}
	var kind string
	if err := json.Unmarshal(fields["kind"], &kind); err != nil {
		return out, err
	}
	required := map[string][]string{"festival_companion": {"npcId"}, "confess": {"npcId", "reason"}, "open_episode": {"npcId"}, "choice": {"itemId", "pick"}, "pickup": {"targetId"}, "set_down": {"targetId"}, "deliver": {"targetId"}, "act": {"targetId"}, "talk": {"targetId"}, "complete": {"targetId"}, "place": {"breadId", "slotId"}, "place_piece": {"pieceId", "slotId"}, "auto_arrange": {}, "finish_segment": {}}
	want, ok := required[kind]
	if !ok || len(fields) != len(want)+1 {
		return out, errors.New("kind")
	}
	for _, key := range want {
		var value string
		raw, ok := fields[key]
		if !ok || string(raw) == "null" || json.Unmarshal(raw, &value) != nil || !idPattern.MatchString(value) {
			return out, errors.New("field")
		}
		if key == "pick" && value != "a" && value != "b" {
			return out, errors.New("pick")
		}
		if key == "reason" && value != "similar" && value != "drawn" && value != "both" && value != "unsure" {
			return out, errors.New("reason")
		}
	}
	if err := json.Unmarshal(body["command"], &out.Command); err != nil {
		return out, err
	}
	return out, nil
}
func (h *playHandler) command(w http.ResponseWriter, r *http.Request) {
	if !h.ready(w) {
		return
	}
	id, key := r.PathValue("playId"), r.Header.Get("Idempotency-Key")
	if !uuidPattern.MatchString(id) || !uuidPattern.MatchString(key) {
		WriteError(w, 400, "invalid_request")
		return
	}
	var body map[string]json.RawMessage
	if DecodeJSON(w, r, &body) != nil {
		return
	}
	req, err := parseCommand(body)
	if err != nil {
		WriteError(w, 400, "invalid_request")
		return
	}
	encoded, _ := json.Marshal(req)
	sum := sha256.Sum256(encoded)
	fingerprint := hex.EncodeToString(sum[:])
	uid, _ := UIDFromContext(r.Context())
	at := time.Now().UTC().Format(time.RFC3339)
	var receipt play.Receipt
	d, err := h.config.Store.Update(r.Context(), uid, id, func(d *play.Doc) error {
		if d.Snapshot.ContentVersion != h.config.Engine.Version {
			return errors.New("content_version_unavailable")
		}
		if old, ok := d.Receipts[key]; ok {
			if old.Fingerprint != fingerprint {
				return errors.New("idempotency_conflict")
			}
			receipt = old.Receipt
			return nil
		}
		duplicate := false
		if req.Command.Kind == "choice" {
			for _, a := range d.Snapshot.Answers {
				if a.ID == req.Command.ItemID {
					if a.Pick != req.Command.Pick {
						return errors.New("choice_locked")
					}
					duplicate = true
				}
			}
		}
		if req.Command.Kind == "complete" {
			npc := map[string]string{"A": "lumi", "B": "moka", "C": "echo", "D": "or"}[req.Command.TargetID]
			if npc != "" && d.Events[npc+"-errand-completed"] {
				duplicate = true
			}
		}
		if req.Command.Kind == "festival_companion" && d.Snapshot.FestivalCompanion != nil && *d.Snapshot.FestivalCompanion == req.Command.NPCID {
			duplicate = true
		}
		if req.Command.Kind == "confess" && d.Snapshot.Confession != nil && d.Snapshot.Confession.NPCID == req.Command.NPCID && d.Snapshot.Confession.Reason == req.Command.Reason {
			duplicate = true
		}
		if duplicate {
			for _, old := range d.Receipts {
				if old.Command == req.Command {
					receipt = old.Receipt
					return nil
				}
			}
			return errors.New("missing original receipt")
		}
		if d.Snapshot.Revision != req.ExpectedRevision {
			return store.ErrConflict
		}
		reaction, err := h.config.Engine.Apply(d, req.Command, at)
		if err != nil {
			return err
		}
		d.Snapshot.Revision++
		receipt = play.Receipt{Key: key, AppliedRevision: d.Snapshot.Revision, Reaction: reaction}
		d.Receipts[key] = play.StoredReceipt{Fingerprint: fingerprint, Receipt: receipt, Command: req.Command}
		return nil
	})
	if err != nil {
		fail(w, err)
		return
	}
	WriteJSON(w, 200, struct {
		Receipt  play.Receipt  `json:"receipt"`
		Snapshot play.Snapshot `json:"snapshot"`
	}{receipt, d.Snapshot})
}
