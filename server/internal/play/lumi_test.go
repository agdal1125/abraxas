package play

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/agdal1125/abraxas/server/internal/scoring"
)

func TestResidentFixtures(t *testing.T) {
	engine, err := Load("../../../content", "fixture-version")
	if err != nil {
		t.Fatal(err)
	}
	for _, npc := range []string{"lumi", "echo", "or"} {
		raw, err := os.ReadFile("../../../content/quests/fixtures/" + npc + "-errand.json")
		if err != nil {
			t.Fatal(err)
		}
		var f struct {
			Initial     Snapshot `json:"initial"`
			CompletedAt string   `json:"completedAt"`
			Success     []struct {
				Name     string    `json:"name"`
				Commands []Command `json:"commands"`
			} `json:"success"`
			Rejections []struct {
				Name    string  `json:"name"`
				After   int     `json:"after"`
				Command Command `json:"command"`
			} `json:"rejections"`
		}
		if err := json.Unmarshal(raw, &f); err != nil {
			t.Fatal(err)
		}
		for _, scenario := range f.Success {
			t.Run(npc+"/"+scenario.Name, func(t *testing.T) {
				doc := NewDoc(f.Initial)
				for i, cmd := range scenario.Commands {
					if _, err := engine.Apply(&doc, cmd, f.CompletedAt); err != nil {
						t.Fatalf("command %d %+v: %v", i, cmd, err)
					}
				}
				if !doc.Events[npc+"-errand-completed"] || len(doc.CompletedErrands) != 1 || doc.CompletedErrands[0] != npc || doc.Snapshot.EpisodeEnd == nil || doc.Snapshot.EpisodeEnd.NPCID != npc || doc.Snapshot.Segment != "interlude_1" {
					t.Fatalf("completion: %+v", doc)
				}
				progress, err := engine.data.Progress(scoring.Input{PlayID: doc.Snapshot.PlayID, Log: doc.Snapshot.Answers})
				if err != nil {
					t.Fatal(err)
				}
				want := min(progress.NPCs[npc].Affinity+8, 100) / 20
				if doc.Snapshot.EpisodeEnd.Hearts != want {
					t.Fatalf("completion reward: got %d want %d", doc.Snapshot.EpisodeEnd.Hearts, want)
				}
			})
		}
		for _, scenario := range f.Rejections {
			t.Run(npc+"/reject/"+scenario.Name, func(t *testing.T) {
				doc := NewDoc(f.Initial)
				for _, cmd := range f.Success[0].Commands[:scenario.After] {
					if _, err := engine.Apply(&doc, cmd, f.CompletedAt); err != nil {
						t.Fatal(err)
					}
				}
				before, _ := json.Marshal(doc)
				if _, err := engine.Apply(&doc, scenario.Command, f.CompletedAt); err == nil {
					t.Fatal("invalid command accepted")
				}
				after, _ := json.Marshal(doc)
				if string(before) != string(after) {
					t.Fatal("rejection mutated doc")
				}
			})
		}
	}
}

func TestResidentRejectsCarryingOtherObject(t *testing.T) {
	e, err := Load("../../../content", "fixture-version")
	if err != nil {
		t.Fatal(err)
	}
	for _, owner := range []string{"moka", "lumi", "echo", "or"} {
		for _, npc := range []string{"moka", "lumi", "echo", "or"} {
			if owner == npc {
				continue
			}
			t.Run(owner+"/"+npc, func(t *testing.T) {
				s := NewSnapshot("play", "fixture-version")
				s.Segment = "hub"
				switch owner {
				case "moka":
					s.Moka.Basket = "player"
				case "lumi":
					s.Lumi.Objects["notice"] = "player"
				case "echo":
					s.Echo.Objects["book"] = "player"
				case "or":
					s.Or.Objects["bucket"] = "player"
				}
				d := NewDoc(s)
				before, _ := json.Marshal(d)
				if _, err := e.Apply(&d, Command{Kind: "open_episode", NPCID: npc}, "2026-11-02T00:00:00Z"); err == nil {
					t.Fatal("carrying other resident object accepted")
				}
				after, _ := json.Marshal(d)
				if string(before) != string(after) {
					t.Fatal("rejection mutated state")
				}
			})
		}
	}
}

func TestResidentRestAndCorruptPlacements(t *testing.T) {
	e, err := Load("../../../content", "fixture-version")
	if err != nil {
		t.Fatal(err)
	}
	for _, npc := range []string{"lumi", "echo", "or"} {
		t.Run(npc, func(t *testing.T) {
			raw, err := os.ReadFile("../../../content/quests/fixtures/" + npc + "-errand.json")
			if err != nil {
				t.Fatal(err)
			}
			var f struct {
				Initial     Snapshot `json:"initial"`
				CompletedAt string   `json:"completedAt"`
				Success     []struct {
					Commands []Command `json:"commands"`
				} `json:"success"`
			}
			if err := json.Unmarshal(raw, &f); err != nil {
				t.Fatal(err)
			}
			d := NewDoc(f.Initial)
			held := func() map[string]string {
				return map[string]*ResidentState{"lumi": &d.Snapshot.Lumi, "echo": &d.Snapshot.Echo, "or": &d.Snapshot.Or}[npc].Objects
			}
			stopped := false
			for _, c := range f.Success[0].Commands {
				if c.Kind == "complete" {
					break
				}
				if _, err := e.Apply(&d, c, f.CompletedAt); err != nil {
					t.Fatal(err)
				}
				// The first step that leaves an object in hand: a choice or action now hands it over, not a pickup.
				if !stopped && carrying(held()) {
					stopped = true
					rest := npc + "-rest"
					if _, err := e.Apply(&d, Command{Kind: "set_down", TargetID: rest}, f.CompletedAt); err != nil {
						t.Fatal(err)
					}
					before, _ := json.Marshal(d)
					if _, err := e.Apply(&d, Command{Kind: "finish_segment"}, f.CompletedAt); err == nil {
						t.Fatal("rest bypass accepted")
					}
					after, _ := json.Marshal(d)
					if string(before) != string(after) {
						t.Fatal("rejection mutated state")
					}
					if _, err := e.Apply(&d, Command{Kind: "pickup", TargetID: rest}, f.CompletedAt); err != nil {
						t.Fatal(err)
					}
				}
			}
			if !stopped {
				t.Fatal("fixture never carries an object")
			}
			var state *ResidentState
			switch npc {
			case "lumi":
				state = &d.Snapshot.Lumi
			case "echo":
				state = &d.Snapshot.Echo
			case "or":
				state = &d.Snapshot.Or
			}
			for slot := range state.Placements {
				state.Placements[slot] = "invalid"
				break
			}
			before, _ := json.Marshal(d)
			last := f.Success[0].Commands[len(f.Success[0].Commands)-1]
			if _, err := e.Apply(&d, last, f.CompletedAt); err == nil {
				t.Fatal("corrupt puzzle completed")
			}
			after, _ := json.Marshal(d)
			if string(before) != string(after) {
				t.Fatal("rejection mutated state")
			}
		})
	}
}
