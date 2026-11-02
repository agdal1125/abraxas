package play

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/agdal1125/abraxas/server/internal/scoring"
)

var ErrTransition = errors.New("invalid_transition")

type MokaState struct {
	Phase       string            `json:"phase"`
	Basket      string            `json:"basket"`
	Placements  map[string]string `json:"placements"`
	CompletedAt *string           `json:"completedAt"`
}
type EpisodeEnd struct {
	NPCID  string `json:"npcId"`
	Hearts int    `json:"hearts"`
}
type Snapshot struct {
	PlayID            string           `json:"playId"`
	ContentVersion    string           `json:"contentVersion"`
	Revision          int64            `json:"revision"`
	Segment           string           `json:"segment"`
	CompletedEpisodes []string         `json:"completedEpisodes"`
	Answers           []scoring.Answer `json:"answers"`
	Moka              MokaState        `json:"moka"`
	EpisodeEnd        *EpisodeEnd      `json:"episodeEnd,omitempty"`
}
type Command struct {
	Kind     string `json:"kind"`
	NPCID    string `json:"npcId,omitempty"`
	ItemID   string `json:"itemId,omitempty"`
	Pick     string `json:"pick,omitempty"`
	TargetID string `json:"targetId,omitempty"`
	BreadID  string `json:"breadId,omitempty"`
	SlotID   string `json:"slotId,omitempty"`
}
type Receipt struct {
	Key             string  `json:"key"`
	AppliedRevision int64   `json:"appliedRevision"`
	Reaction        *string `json:"reaction"`
}
type StoredReceipt struct {
	Fingerprint string
	Receipt     Receipt
	Command     Command
}
type Doc struct {
	Snapshot         Snapshot
	CompletedErrands []string
	Events           map[string]bool
	Receipts         map[string]StoredReceipt
}

func NewDoc(snapshot Snapshot) Doc {
	// Copy fixture data as well as runtime snapshots before mutation.
	raw, _ := json.Marshal(snapshot)
	_ = json.Unmarshal(raw, &snapshot)
	return Doc{Snapshot: snapshot, Events: map[string]bool{}, Receipts: map[string]StoredReceipt{}}
}
func NewSnapshot(id, version string) Snapshot {
	return Snapshot{PlayID: id, ContentVersion: version, Segment: "prologue", CompletedEpisodes: []string{}, Answers: []scoring.Answer{}, Moka: MokaState{Phase: "locked", Basket: "source", Placements: map[string]string{}}}
}

type item struct {
	ID      string `json:"id"`
	Segment string `json:"segment"`
}
type quest struct {
	Items  []string          `json:"items"`
	Bread  map[string]string `json:"bread"`
	Slots  map[string]string `json:"slots"`
	Phases map[string]struct {
		TargetsByPick map[string]string `json:"targetsByPick"`
	} `json:"phases"`
}
type Engine struct {
	Version string
	data    scoring.Data
	items   []item
	gates   []item
	quest   quest
}

func Load(root, version string) (*Engine, error) {
	if version == "" {
		return nil, errors.New("missing content version")
	}
	data, err := scoring.Load(os.DirFS(filepath.Join(root, "scoring")))
	if err != nil {
		return nil, err
	}
	var rawItems struct {
		Items       []item `json:"items"`
		Tiebreakers []item `json:"tiebreakers"`
	}
	raw, err := os.ReadFile(filepath.Join(root, "scoring", "items.json"))
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(raw, &rawItems); err != nil {
		return nil, err
	}
	var q quest
	raw, err = os.ReadFile(filepath.Join(root, "quests", "moka-errand.json"))
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(raw, &q); err != nil {
		return nil, err
	}
	if len(q.Items) != 6 || len(q.Slots) != 6 || len(q.Bread) != 6 || len(rawItems.Items) == 0 || len(rawItems.Tiebreakers) == 0 {
		return nil, errors.New("incomplete content")
	}
	return &Engine{Version: version, data: data, items: rawItems.Items, gates: rawItems.Tiebreakers, quest: q}, nil
}
func contains(values []string, v string) bool {
	for _, value := range values {
		if value == v {
			return true
		}
	}
	return false
}
func answer(s *Snapshot, id string) string {
	for _, a := range s.Answers {
		if a.ID == id {
			return a.Pick
		}
	}
	return ""
}
func (e *Engine) segmentItems(segment string) []item {
	if segment == "gate" {
		return e.gates
	}
	var out []item
	for _, i := range e.items {
		if i.Segment == segment {
			out = append(out, i)
		}
	}
	return out
}
func (e *Engine) nextItem(s *Snapshot) string {
	for _, i := range e.segmentItems(s.Segment) {
		if answer(s, i.ID) == "" {
			return i.ID
		}
	}
	return ""
}
func (e *Engine) Apply(doc *Doc, cmd Command, completedAt string) (*string, error) {
	// Commit the copy only after every check and score calculation succeeds.
	raw, _ := json.Marshal(doc)
	var next Doc
	if err := json.Unmarshal(raw, &next); err != nil {
		return nil, err
	}
	s := &next.Snapshot
	m := &s.Moka
	if strings.HasPrefix(s.Segment, "ep_moka") || (s.Segment == "hub" && cmd.Kind == "open_episode" && cmd.NPCID == "moka") {
		if err := e.moka(s, cmd, completedAt); err != nil {
			return nil, err
		}
		if m.Phase == "completed" && !next.Events["moka-errand-completed"] {
			next.Events["moka-errand-completed"] = true
			next.CompletedErrands = append(next.CompletedErrands, "moka")
		}
	} else {
		switch cmd.Kind {
		case "open_episode":
			if s.Segment != "hub" || contains(s.CompletedEpisodes, cmd.NPCID) || (cmd.NPCID != "lumi" && cmd.NPCID != "echo" && cmd.NPCID != "or") {
				return nil, ErrTransition
			}
			s.Segment = "ep_" + cmd.NPCID
			s.EpisodeEnd = nil
		case "choice":
			if (cmd.Pick != "a" && cmd.Pick != "b") || e.nextItem(s) == "" || e.nextItem(s) != cmd.ItemID {
				return nil, ErrTransition
			}
			s.Answers = append(s.Answers, scoring.Answer{ID: cmd.ItemID, Pick: cmd.Pick})
		case "finish_segment":
			if len(e.segmentItems(s.Segment)) == 0 || e.nextItem(s) != "" {
				return nil, ErrTransition
			}
			switch {
			case s.Segment == "prologue" || strings.HasPrefix(s.Segment, "interlude_"):
				s.Segment = "hub"
			case strings.HasPrefix(s.Segment, "ep_"):
				s.CompletedEpisodes = append(s.CompletedEpisodes, strings.TrimPrefix(s.Segment, "ep_"))
				if len(s.CompletedEpisodes) < 4 {
					s.Segment = fmt.Sprintf("interlude_%d", len(s.CompletedEpisodes))
				} else {
					s.Segment = "festival"
				}
			case s.Segment == "festival":
				s.Segment = "gate"
			case s.Segment == "gate":
				if _, err := e.data.Score(scoring.Input{PlayID: s.PlayID, Log: s.Answers, CompletedErrands: next.CompletedErrands}); err != nil {
					return nil, err
				}
				s.Segment = "result"
			default:
				return nil, ErrTransition
			}
		default:
			return nil, ErrTransition
		}
	}
	progress, err := e.data.Progress(scoring.Input{PlayID: s.PlayID, Log: s.Answers, CompletedErrands: next.CompletedErrands})
	if err != nil {
		return nil, err
	}
	if cmd.Kind == "complete" && m.Phase == "completed" {
		s.EpisodeEnd = &EpisodeEnd{NPCID: "moka", Hearts: progress.NPCs["moka"].Affinity / 20}
		if len(s.CompletedEpisodes) < 4 {
			s.Segment = fmt.Sprintf("interlude_%d", len(s.CompletedEpisodes))
		} else {
			s.Segment = "festival"
		}
	}
	var reaction *string
	if cmd.Kind == "choice" {
		if value, ok := progress.Reactions[cmd.ItemID]; ok {
			reaction = &value
		}
	}
	*doc = next
	return reaction, nil
}
func (e *Engine) moka(s *Snapshot, c Command, at string) error {
	m := &s.Moka
	phase := m.Phase
	if phase == "locked" && c.Kind == "open_episode" && c.NPCID == "moka" && s.Segment == "hub" && !contains(s.CompletedEpisodes, "moka") {
		m.Phase = "choose_route"
		m.Basket = "source"
		s.Segment = "ep_moka"
		s.EpisodeEnd = nil
		return nil
	}
	choices := map[string]struct {
		index int
		next  string
	}{"choose_route": {0, "pick_up"}, "reservation": {1, "reservation_action"}, "choose_display": {2, "arrange"}, "share": {3, "share_action"}, "order": {4, "order_action"}, "feedback": {5, "report"}}
	if rule, ok := choices[phase]; ok && c.Kind == "choice" && c.ItemID == e.quest.Items[rule.index] && (c.Pick == "a" || c.Pick == "b") && answer(s, c.ItemID) == "" {
		s.Answers = append(s.Answers, scoring.Answer{ID: c.ItemID, Pick: c.Pick})
		m.Phase = rule.next
		return nil
	}
	switch {
	case phase == "pick_up" && c.Kind == "pickup" && c.TargetID == "moka-basket-source" && m.Basket == "source":
		m.Basket = "player"
		m.Phase = "deliver"
	case phase == "deliver" && c.Kind == "set_down" && c.TargetID == "moka-rest" && m.Basket == "player":
		m.Basket = "moka-rest"
	case phase == "deliver" && c.Kind == "pickup" && c.TargetID == "moka-rest" && m.Basket == "moka-rest":
		m.Basket = "player"
	case phase == "deliver" && c.Kind == "deliver" && c.TargetID == "moka-workshop-dropoff" && m.Basket == "player":
		m.Basket = "delivered"
		m.Phase = "reservation"
	case (phase == "reservation_action" || phase == "share_action" || phase == "order_action") && c.Kind == "act":
		index, next := 1, "choose_display"
		if phase == "share_action" {
			index, next = 3, "order"
		}
		if phase == "order_action" {
			index, next = 4, "return"
		}
		pick := answer(s, e.quest.Items[index])
		if pick == "" || e.quest.Phases[phase].TargetsByPick[pick] != c.TargetID {
			return ErrTransition
		}
		m.Phase = next
	case phase == "arrange" && c.Kind == "place":
		bread, bok := e.quest.Bread[c.BreadID]
		slot, sok := e.quest.Slots[c.SlotID]
		if !bok || !sok || bread != slot || m.Placements[c.SlotID] != "" {
			return ErrTransition
		}
		for _, used := range m.Placements {
			if used == c.BreadID {
				return ErrTransition
			}
		}
		m.Placements[c.SlotID] = c.BreadID
		if len(m.Placements) == len(e.quest.Slots) {
			m.Phase = "share"
		}
	case phase == "arrange" && c.Kind == "auto_arrange":
		var slots, breads []string
		for id := range e.quest.Slots {
			slots = append(slots, id)
		}
		for id := range e.quest.Bread {
			breads = append(breads, id)
		}
		sort.Strings(slots)
		sort.Strings(breads)
		for _, slot := range slots {
			if m.Placements[slot] != "" {
				continue
			}
			for _, bread := range breads {
				used := false
				for _, v := range m.Placements {
					if v == bread {
						used = true
					}
				}
				if !used && e.quest.Bread[bread] == e.quest.Slots[slot] {
					m.Placements[slot] = bread
					break
				}
			}
			if m.Placements[slot] == "" {
				return ErrTransition
			}
		}
		m.Phase = "share"
	case phase == "return" && c.Kind == "talk" && c.TargetID == "B":
		m.Phase = "feedback"
	case phase == "report" && c.Kind == "complete" && c.TargetID == "B" && at != "" && m.Basket == "delivered" && !contains(s.CompletedEpisodes, "moka") && len(m.Placements) == len(e.quest.Slots):
		used := map[string]bool{}
		for slot, bread := range m.Placements {
			shape, ok := e.quest.Slots[slot]
			b, bok := e.quest.Bread[bread]
			if !ok || !bok || shape != b || used[bread] {
				return ErrTransition
			}
			used[bread] = true
		}
		var ids []string
		for _, a := range s.Answers {
			if strings.HasPrefix(a.ID, "moka_") {
				ids = append(ids, a.ID)
			}
		}
		if len(ids) != len(e.quest.Items) {
			return ErrTransition
		}
		for i, id := range ids {
			if id != e.quest.Items[i] {
				return ErrTransition
			}
		}
		m.Phase = "completed"
		m.CompletedAt = &at
		s.CompletedEpisodes = append(s.CompletedEpisodes, "moka")
	default:
		return ErrTransition
	}
	return nil
}
