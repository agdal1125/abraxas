package play

import "github.com/agdal1125/abraxas/server/internal/scoring"

type Confession struct {
	NPCID   string `json:"npcId"`
	Reason  string `json:"reason"`
	Outcome string `json:"outcome"`
}
type EndingResult struct {
	Type     string            `json:"type"`
	Modifier string            `json:"modifier"`
	NPCTypes map[string]string `json:"npcTypes"`
}

func (e *Engine) ending(doc *Doc, cmd Command) error {
	s := &doc.Snapshot
	if !contains([]string{"lumi", "moka", "echo", "or"}, cmd.NPCID) {
		return ErrTransition
	}
	if cmd.Kind == "festival_companion" {
		if s.Segment != "festival" || e.nextItem(s) != "" || s.FestivalCompanion != nil || doc.Events["festival-companion-selected"] {
			return ErrTransition
		}
		s.FestivalCompanion = &cmd.NPCID
		if doc.Events == nil {
			doc.Events = map[string]bool{}
		}
		doc.Events["festival-companion-selected"] = true
		return nil
	}
	if s.Segment != "confession" || s.FestivalCompanion == nil || s.Confession != nil || s.Result != nil || !contains([]string{"similar", "drawn", "both", "unsure"}, cmd.Reason) {
		return ErrTransition
	}
	result, err := e.data.Score(scoring.Input{PlayID: s.PlayID, Log: s.Answers, CompletedErrands: doc.CompletedErrands})
	if err != nil {
		return err
	}
	companion := result.NPCs[*s.FestivalCompanion]
	companion.Affinity = min(e.data.Rules.AffinityMax, max(e.data.Rules.AffinityMin, companion.Affinity+e.data.Rules.FestivalAffinityGain))
	result.NPCs[*s.FestivalCompanion] = companion
	outcome := "waiting"
	if result.NPCs[cmd.NPCID].Affinity >= e.data.Rules.ConfessionThreshold {
		outcome = "accepted"
	}
	ending := &EndingResult{Type: result.Type, Modifier: result.Modifier, NPCTypes: map[string]string{}}
	for id, npc := range result.NPCs {
		typ := ""
		for i, axis := range []string{"A", "B", "C", "D"} {
			letters := []string{"OI", "HL", "VK", "GC"}[i]
			if npc.S[axis] >= 0 {
				typ += letters[:1]
			} else {
				typ += letters[1:]
			}
		}
		ending.NPCTypes[id] = typ
	}
	s.Confession = &Confession{NPCID: cmd.NPCID, Reason: cmd.Reason, Outcome: outcome}
	s.Result = ending
	if doc.FirstResult == nil {
		doc.FirstResult = ending
	}
	s.Segment = "result"
	return nil
}
