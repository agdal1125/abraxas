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
type ResidentState struct {
	Phase       string            `json:"phase"`
	Objects     map[string]string `json:"objects"`
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
	Lumi              ResidentState    `json:"lumi"`
	Echo              ResidentState    `json:"echo"`
	Or                ResidentState    `json:"or"`
	EpisodeEnd        *EpisodeEnd      `json:"episodeEnd,omitempty"`
}
type Command struct {
	Kind     string `json:"kind"`
	NPCID    string `json:"npcId,omitempty"`
	ItemID   string `json:"itemId,omitempty"`
	Pick     string `json:"pick,omitempty"`
	TargetID string `json:"targetId,omitempty"`
	BreadID  string `json:"breadId,omitempty"`
	PieceID  string `json:"pieceId,omitempty"`
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
	return Snapshot{PlayID: id, ContentVersion: version, Segment: "prologue", CompletedEpisodes: []string{}, Answers: []scoring.Answer{}, Moka: MokaState{Phase: "locked", Basket: "source", Placements: map[string]string{}}, Lumi: initialResident("notice", "material", "score"), Echo: initialResident("book", "record", "notebook", "legend"), Or: initialResident("bucket", "bell")}
}

func initialResident(objects ...string) ResidentState {
	s := ResidentState{Phase: "locked", Objects: map[string]string{}, Placements: map[string]string{}}
	for _, object := range objects {
		s.Objects[object] = "source"
	}
	return s
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
type residentQuest struct {
	Items  []string            `json:"items"`
	Pieces map[string]string   `json:"pieces"`
	Slots  map[string]string   `json:"slots"`
	Phases map[string][]string `json:"phases"`
}
type Engine struct {
	Version   string
	data      scoring.Data
	items     []item
	gates     []item
	quest     quest
	residents map[string]residentQuest
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
	residents := map[string]residentQuest{}
	for _, npc := range []string{"lumi", "echo", "or"} {
		raw, err := os.ReadFile(filepath.Join(root, "quests", npc+"-errand.json"))
		if err != nil {
			return nil, err
		}
		var resident residentQuest
		if err := json.Unmarshal(raw, &resident); err != nil {
			return nil, err
		}
		count := 6
		if npc == "or" {
			count = 3
		}
		if len(resident.Items) != 6 || len(resident.Slots) != count || len(resident.Pieces) != count || len(resident.Phases) == 0 {
			return nil, errors.New("incomplete content")
		}
		residents[npc] = resident
	}
	return &Engine{Version: version, data: data, items: rawItems.Items, gates: rawItems.Tiebreakers, quest: q, residents: residents}, nil
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
func carrying(objects map[string]string) bool {
	for _, location := range objects {
		if location == "player" {
			return true
		}
	}
	return false
}
func residentReady(s *Snapshot, npc string, state *ResidentState) bool {
	if state.Objects == nil || state.Placements == nil {
		return false
	}
	count := 0
	for _, loc := range state.Objects {
		if loc == "player" {
			count++
		}
	}
	if count > 1 {
		return false
	}
	return (npc == "moka" || s.Moka.Basket != "player") && (npc == "lumi" || !carrying(s.Lumi.Objects)) && (npc == "echo" || !carrying(s.Echo.Objects)) && (npc == "or" || !carrying(s.Or.Objects))
}
func residentTarget(s *Snapshot, q residentQuest, state *ResidentState, c Command, kind, branch string) bool {
	if c.Kind != kind {
		return false
	}
	for _, loc := range state.Objects {
		if strings.HasSuffix(loc, "-rest") {
			return false
		}
	}
	targets := q.Phases[state.Phase]
	if branch != "" {
		pick := answer(s, branch)
		index := 0
		if pick == "b" {
			index = 1
		} else if pick != "a" {
			return false
		}
		return index < len(targets) && c.TargetID == targets[index]
	}
	return contains(targets, c.TargetID)
}
func residentRest(state *ResidentState, c Command, npc, object string) bool {
	if object == "" || c.TargetID != npc+"-rest" {
		return false
	}
	if c.Kind == "set_down" && state.Objects[object] == "player" {
		state.Objects[object] = c.TargetID
		return true
	}
	if c.Kind == "pickup" && state.Objects[object] == c.TargetID && !carrying(state.Objects) {
		state.Objects[object] = "player"
		return true
	}
	return false
}
func residentChoice(s *Snapshot, state *ResidentState, c Command, id, next string) bool {
	if c.Kind != "choice" || c.ItemID != id || (c.Pick != "a" && c.Pick != "b") || answer(s, id) != "" {
		return false
	}
	s.Answers = append(s.Answers, scoring.Answer{ID: id, Pick: c.Pick})
	state.Phase = next
	return true
}
func residentPuzzle(state *ResidentState, c Command, q residentQuest, next string) error {
	if c.Kind == "place_piece" {
		piece, ok := q.Pieces[c.PieceID]
		slot, sok := q.Slots[c.SlotID]
		if !ok || !sok || piece != slot || state.Placements[c.SlotID] != "" {
			return ErrTransition
		}
		for _, used := range state.Placements {
			if used == c.PieceID {
				return ErrTransition
			}
		}
		state.Placements[c.SlotID] = c.PieceID
	} else if c.Kind == "auto_arrange" {
		var slots, pieces []string
		for id := range q.Slots {
			slots = append(slots, id)
		}
		for id := range q.Pieces {
			pieces = append(pieces, id)
		}
		sort.Strings(slots)
		sort.Strings(pieces)
		for _, slot := range slots {
			if state.Placements[slot] != "" {
				continue
			}
			for _, piece := range pieces {
				used := false
				for _, v := range state.Placements {
					if v == piece {
						used = true
					}
				}
				if !used && q.Pieces[piece] == q.Slots[slot] {
					state.Placements[slot] = piece
					break
				}
			}
			if state.Placements[slot] == "" {
				return ErrTransition
			}
		}
	} else {
		return ErrTransition
	}
	if len(state.Placements) == len(q.Slots) {
		state.Phase = next
	}
	return nil
}
func residentComplete(s *Snapshot, state *ResidentState, c Command, q residentQuest, npc, target, at string) error {
	if c.Kind != "complete" || c.TargetID != target || at == "" || contains(s.CompletedEpisodes, npc) || len(state.Placements) != len(q.Slots) {
		return ErrTransition
	}
	used := map[string]bool{}
	for slot, piece := range state.Placements {
		a, ok := q.Slots[slot]
		b, bok := q.Pieces[piece]
		if !ok || !bok || a != b || used[piece] {
			return ErrTransition
		}
		used[piece] = true
	}
	var ids []string
	for _, a := range s.Answers {
		if strings.HasPrefix(a.ID, npc+"_") {
			ids = append(ids, a.ID)
		}
	}
	if len(ids) != len(q.Items) {
		return ErrTransition
	}
	for i, id := range ids {
		if id != q.Items[i] {
			return ErrTransition
		}
	}
	state.Phase = "completed"
	state.CompletedAt = &at
	s.CompletedEpisodes = append(s.CompletedEpisodes, npc)
	return nil
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
	npc := strings.TrimPrefix(s.Segment, "ep_")
	if s.Segment == "hub" && cmd.Kind == "open_episode" {
		npc = cmd.NPCID
	}
	completed := ""
	if npc == "moka" && (s.Segment == "ep_moka" || s.Segment == "hub") {
		if carrying(s.Lumi.Objects) || carrying(s.Echo.Objects) || carrying(s.Or.Objects) {
			return nil, ErrTransition
		}
		if err := e.moka(s, cmd, completedAt); err != nil {
			return nil, err
		}
		if m.Phase == "completed" {
			completed = npc
		}
	} else if (npc == "lumi" || npc == "echo" || npc == "or") && (s.Segment == "ep_"+npc || s.Segment == "hub") {
		var err error
		switch npc {
		case "lumi":
			err = e.lumi(s, cmd, completedAt)
		case "echo":
			err = e.echo(s, cmd, completedAt)
		case "or":
			err = e.or(s, cmd, completedAt)
		}
		if err != nil {
			return nil, err
		}
		if cmd.Kind == "complete" {
			completed = npc
		}
	} else {
		switch cmd.Kind {
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
	if completed != "" {
		event := completed + "-errand-completed"
		if next.Events[event] || contains(next.CompletedErrands, completed) {
			return nil, ErrTransition
		}
		next.Events[event] = true
		next.CompletedErrands = append(next.CompletedErrands, completed)
	}
	progress, err := e.data.Progress(scoring.Input{PlayID: s.PlayID, Log: s.Answers, CompletedErrands: next.CompletedErrands})
	if err != nil {
		return nil, err
	}
	if completed != "" {
		s.EpisodeEnd = &EpisodeEnd{NPCID: completed, Hearts: progress.NPCs[completed].Affinity / 20}
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
