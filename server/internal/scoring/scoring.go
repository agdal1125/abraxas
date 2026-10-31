package scoring

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"io/fs"
	"math"
)

type Scores map[string]int
type Answer struct {
	ID   string `json:"id"`
	Pick string `json:"pick"`
}
type Input struct {
	PlayID string   `json:"playId"`
	Log    []Answer `json:"log"`
}
type NPCResult struct {
	S        Scores `json:"s"`
	Affinity int    `json:"affinity"`
}
type Result struct {
	S        Scores               `json:"s"`
	Type     string               `json:"type"`
	Modifier string               `json:"modifier"`
	NPCs     map[string]NPCResult `json:"npcs"`
}
type item struct {
	ID    string `json:"id"`
	Axis  string `json:"axis"`
	NPC   string `json:"npc"`
	Picks map[string]struct {
		W Scores `json:"w"`
	} `json:"picks"`
}
type rules struct {
	ScoreLimit    int `json:"scoreLimit"`
	TieThreshold  int `json:"tieThreshold"`
	NPCStep       int `json:"npcStep"`
	AffinityStart int `json:"affinityStart"`
	AffinityGain  int `json:"affinityGain"`
	AffinityMin   int `json:"affinityMin"`
	AffinityMax   int `json:"affinityMax"`
}
type Data struct {
	Items       []item `json:"items"`
	Tiebreakers []item `json:"tiebreakers"`
	NPCs        []struct {
		ID    string `json:"id"`
		Start Scores `json:"start"`
	} `json:"npcs"`
	Rules rules
}

func Load(fsys fs.FS) (Data, error) {
	var data Data
	for _, name := range []string{"items.json", "npcs.json", "rules.json"} {
		raw, err := fs.ReadFile(fsys, name)
		if err != nil {
			return Data{}, err
		}
		var target any = &data
		if name == "rules.json" {
			target = &data.Rules
		}
		if err := json.Unmarshal(raw, target); err != nil {
			return Data{}, fmt.Errorf("%s: %w", name, err)
		}
	}
	return data, nil
}
func bound(value, lo, hi int) int { return max(lo, min(hi, value)) }
func sign(value int) int {
	if value < 0 {
		return -1
	}
	if value > 0 {
		return 1
	}
	return 0
}
func (data Data) Score(input Input) (Result, error) {
	result := Result{S: Scores{"A": 0, "B": 0, "C": 0, "D": 0, "E": 0}, NPCs: map[string]NPCResult{}}
	r := data.Rules
	for _, npc := range data.NPCs {
		s := Scores{}
		for axis, value := range npc.Start {
			s[axis] = value
		}
		result.NPCs[npc.ID] = NPCResult{S: s, Affinity: r.AffinityStart}
	}
	items := map[string]item{}
	gates := map[string]bool{}
	for _, item := range data.Items {
		items[item.ID] = item
	}
	for _, item := range data.Tiebreakers {
		items[item.ID] = item
		gates[item.ID] = true
	}
	seen := map[string]bool{}
	gateWeights := map[string]int{}
	for _, answer := range input.Log {
		item, ok := items[answer.ID]
		if !ok || seen[answer.ID] {
			return Result{}, fmt.Errorf("unknown or duplicate answer: %s", answer.ID)
		}
		pick, ok := item.Picks[answer.Pick]
		if !ok {
			return Result{}, fmt.Errorf("unknown pick: %s", answer.Pick)
		}
		seen[answer.ID] = true
		if gates[item.ID] {
			gateWeights[item.Axis] = pick.W[item.Axis]
			continue
		}
		for axis, weight := range pick.W {
			result.S[axis] = bound(result.S[axis]+weight, -r.ScoreLimit, r.ScoreLimit)
		}
		if item.NPC != "" {
			npc, ok := result.NPCs[item.NPC]
			if !ok {
				return Result{}, fmt.Errorf("unknown npc: %s", item.NPC)
			}
			current := npc.S[item.Axis]
			expected := sign(current)
			if current == 0 {
				hash := fnv.New32a()
				_, _ = hash.Write([]byte(input.PlayID + ":" + item.ID))
				if hash.Sum32()%2 == 0 {
					expected = 1
				} else {
					expected = -1
				}
			}
			chosen := sign(pick.W[item.Axis])
			npc.S[item.Axis] = bound(current+chosen*r.NPCStep, -r.ScoreLimit, r.ScoreLimit)
			if chosen == expected {
				npc.Affinity = bound(npc.Affinity+r.AffinityGain, r.AffinityMin, r.AffinityMax)
			}
			result.NPCs[item.NPC] = npc
		}
	}
	if len(seen) != len(items) {
		return Result{}, fmt.Errorf("incomplete answers")
	}
	for index, axis := range []string{"A", "B", "C", "D"} {
		weight, ok := gateWeights[axis]
		if !ok {
			return Result{}, fmt.Errorf("missing tiebreaker")
		}
		direction := result.S[axis]
		if math.Abs(float64(direction)) < float64(r.TieThreshold) {
			direction = weight
		}
		letters := []string{"OI", "HL", "VK", "GC"}[index]
		if direction >= 0 {
			result.Type += letters[:1]
		} else {
			result.Type += letters[1:]
		}
		result.S[axis] = bound(result.S[axis]+weight, -r.ScoreLimit, r.ScoreLimit)
	}
	if result.S["E"] >= r.TieThreshold {
		result.Modifier = "today"
	} else if result.S["E"] <= -r.TieThreshold {
		result.Modifier = "tomorrow"
	} else {
		result.Modifier = "between"
	}
	return result, nil
}
