package play

import (
	"encoding/json"
	"os"
	"testing"
)

// The server is the only judge of errand progress: a client that sends a later
// command of a valid run, skipping the steps in between, must be refused and
// must leave the saved state untouched.
func TestErrandCannotSkipAheadOfTheRequiredStep(t *testing.T) {
	engine, err := Load("../../../content", "fixture-version")
	if err != nil {
		t.Fatal(err)
	}
	for _, npc := range []string{"lumi", "moka", "echo", "or"} {
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
		initial := NewSnapshot(f.Initial.PlayID, f.Initial.ContentVersion)
		f.Initial.Lumi, f.Initial.Echo, f.Initial.Or = initial.Lumi, initial.Echo, initial.Or
		commands := f.Success[0].Commands
		replay := func(n int) Doc {
			doc := NewDoc(f.Initial)
			for _, c := range commands[:n] {
				if _, err := engine.Apply(&doc, c, f.CompletedAt); err != nil {
					t.Fatalf("%s: replay %+v: %v", npc, c, err)
				}
			}
			return doc
		}
		for i := 0; i < len(commands)-2; i++ {
			for j := i + 2; j < len(commands); j++ {
				if commands[j] == commands[i] || commands[j] == commands[i+1] {
					continue
				}
				doc := replay(i)
				before, _ := json.Marshal(doc)
				_, err := engine.Apply(&doc, commands[j], f.CompletedAt)
				if err == nil {
					// Puzzle pieces may go in any order, and setting a carried object down on its rest is optional.
					if commands[j].Kind == "place_piece" || commands[j].Kind == "place" || commands[i].Kind == "set_down" {
						continue
					}
					t.Fatalf("%s: command %d %+v accepted while command %d %+v was required", npc, j, commands[j], i, commands[i])
				}
				after, _ := json.Marshal(doc)
				if string(before) != string(after) {
					t.Fatalf("%s: rejected command %d changed the saved state", npc, j)
				}
			}
		}
	}
}
