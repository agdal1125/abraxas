package store

import (
	"context"
	"encoding/json"
	"errors"
	"sync"

	"github.com/agdal1125/abraxas/server/internal/play"
)

var ErrNotFound = errors.New("play_not_found")
var ErrConflict = errors.New("revision_conflict")
var ErrReplay = errors.New("replay_not_ready")

// Store implementations must run callbacks inside the same transaction as the
// play, receipts and events. Callbacks may be retried and must have no side effects.
type Store interface {
	Create(context.Context, string, string, play.Doc) (play.Doc, bool, error)
	Current(context.Context, string) (play.Doc, error)
	Get(context.Context, string, string) (play.Doc, error)
	Update(context.Context, string, string, func(*play.Doc) error) (play.Doc, error)
}
type Memory struct {
	mu      sync.Mutex
	docs    map[string]map[string]play.Doc
	current map[string]string
	creates map[string]map[string]string
}

func NewMemory() *Memory {
	return &Memory{docs: map[string]map[string]play.Doc{}, current: map[string]string{}, creates: map[string]map[string]string{}}
}
func copyDoc(d play.Doc) play.Doc {
	raw, _ := json.Marshal(d)
	var c play.Doc
	_ = json.Unmarshal(raw, &c)
	return c
}
func (m *Memory) Create(ctx context.Context, uid, key string, doc play.Doc) (play.Doc, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return play.Doc{}, false, err
	}
	if id := m.current[uid]; id != "" {
		d := m.docs[uid][id]
		if d.Snapshot.Segment == "result" && m.creates[uid][key] == "" {
			return play.Doc{}, false, ErrReplay
		}
		m.creates[uid][key] = id
		return copyDoc(d), false, nil
	}
	if m.docs[uid] == nil {
		m.docs[uid] = map[string]play.Doc{}
	}
	if m.creates[uid] == nil {
		m.creates[uid] = map[string]string{}
	}
	m.docs[uid][doc.Snapshot.PlayID] = copyDoc(doc)
	m.current[uid] = doc.Snapshot.PlayID
	m.creates[uid][key] = doc.Snapshot.PlayID
	return copyDoc(doc), true, nil
}
func (m *Memory) Current(ctx context.Context, uid string) (play.Doc, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return play.Doc{}, err
	}
	id := m.current[uid]
	if id == "" {
		return play.Doc{}, ErrNotFound
	}
	return copyDoc(m.docs[uid][id]), nil
}
func (m *Memory) Get(ctx context.Context, uid, id string) (play.Doc, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return play.Doc{}, err
	}
	d, ok := m.docs[uid][id]
	if !ok {
		return play.Doc{}, ErrNotFound
	}
	return copyDoc(d), nil
}
func (m *Memory) Update(ctx context.Context, uid, id string, fn func(*play.Doc) error) (play.Doc, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return play.Doc{}, err
	}
	d, ok := m.docs[uid][id]
	if !ok {
		return play.Doc{}, ErrNotFound
	}
	d = copyDoc(d)
	if err := fn(&d); err != nil {
		return play.Doc{}, err
	}
	if err := ctx.Err(); err != nil {
		return play.Doc{}, err
	}
	m.docs[uid][id] = copyDoc(d)
	return copyDoc(d), nil
}
