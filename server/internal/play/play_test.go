package play

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

func TestMokaFixtures(t *testing.T) {
	engine, err := Load("../../../content", "fixture-version")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../../../content/quests/fixtures/moka-errand.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Initial     Snapshot `json:"initial"`
		CompletedAt string   `json:"completedAt"`
		Success     []struct {
			Name     string    `json:"name"`
			Commands []Command `json:"commands"`
			Expected struct {
				Phase             string   `json:"phase"`
				Basket            string   `json:"basket"`
				AnswerIDs         []string `json:"answerIds"`
				PlacementCount    int      `json:"placementCount"`
				CompletedEpisodes []string `json:"completedEpisodes"`
			} `json:"expected"`
		} `json:"success"`
		Rejections []struct {
			Name    string  `json:"name"`
			After   int     `json:"after"`
			Command Command `json:"command"`
		} `json:"rejections"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, scenario := range fixture.Success {
		t.Run(scenario.Name, func(t *testing.T) {
			doc := NewDoc(fixture.Initial)
			for _, cmd := range scenario.Commands {
				if _, err := engine.Apply(&doc, cmd, fixture.CompletedAt); err != nil {
					t.Fatalf("%+v: %v", cmd, err)
				}
			}
			ids := []string{}
			for _, a := range doc.Snapshot.Answers {
				ids = append(ids, a.ID)
			}
			if doc.Snapshot.Moka.Phase != scenario.Expected.Phase || doc.Snapshot.Moka.Basket != scenario.Expected.Basket || len(doc.Snapshot.Moka.Placements) != scenario.Expected.PlacementCount || !reflect.DeepEqual(ids, scenario.Expected.AnswerIDs) || !reflect.DeepEqual(doc.Snapshot.CompletedEpisodes, scenario.Expected.CompletedEpisodes) {
				t.Fatalf("unexpected state: %+v", doc.Snapshot)
			}
		})
	}
	for _, scenario := range fixture.Rejections {
		t.Run(scenario.Name, func(t *testing.T) {
			doc := NewDoc(fixture.Initial)
			for _, cmd := range fixture.Success[0].Commands[:scenario.After] {
				if _, err := engine.Apply(&doc, cmd, fixture.CompletedAt); err != nil {
					t.Fatal(err)
				}
			}
			before, _ := json.Marshal(doc)
			if _, err := engine.Apply(&doc, scenario.Command, fixture.CompletedAt); err == nil {
				t.Fatal("invalid command accepted")
			}
			after, _ := json.Marshal(doc)
			if string(before) != string(after) {
				t.Fatal("rejected command changed state")
			}
		})
	}
}

func TestFullExistingFlow(t *testing.T) {
	engine, err := Load("../../../content", "fixture-version")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../../../content/quests/fixtures/moka-errand.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		CompletedAt string `json:"completedAt"`
		Success     []struct {
			Commands []Command `json:"commands"`
		} `json:"success"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	doc := NewDoc(NewSnapshot("play", "fixture-version"))
	apply := func(c Command) {
		t.Helper()
		if _, err := engine.Apply(&doc, c, fixture.CompletedAt); err != nil {
			t.Fatalf("%s %+v: %v", doc.Snapshot.Segment, c, err)
		}
	}
	finish := func() {
		t.Helper()
		for _, item := range engine.segmentItems(doc.Snapshot.Segment) {
			apply(Command{Kind: "choice", ItemID: item.ID, Pick: "a"})
		}
		apply(Command{Kind: "finish_segment"})
	}
	finish()
	for _, npc := range []string{"lumi", "moka", "echo", "or"} {
		if npc == "moka" {
			for _, cmd := range fixture.Success[0].Commands {
				apply(cmd)
			}
		} else {
			apply(Command{Kind: "open_episode", NPCID: npc})
			finish()
		}
		if doc.Snapshot.Segment != "festival" {
			finish()
		}
	}
	finish()
	finish()
	if doc.Snapshot.Segment != "result" || len(doc.Snapshot.Answers) != 42 || len(doc.CompletedErrands) != 1 {
		t.Fatalf("unexpected result: %+v", doc)
	}
}
