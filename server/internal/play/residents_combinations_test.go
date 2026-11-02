package play

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/agdal1125/abraxas/server/internal/scoring"
)

func TestResidentCombinationsPreserveScoring(t *testing.T) {
	engine, err := Load("../../../content", "fixture-version")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../../../content/scoring/golden/first.json")
	if err != nil {
		t.Fatal(err)
	}
	var golden scoring.Input
	if err := json.Unmarshal(raw, &golden); err != nil {
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
			if len(f.Success) != 2 {
				t.Fatal("expected manual a and automatic b fixtures")
			}
			var chunks [2][][]Command
			var pieces []Command
			for path, scenario := range f.Success {
				for _, cmd := range scenario.Commands {
					if cmd.Kind == "open_episode" {
						continue
					}
					if cmd.Kind == "choice" {
						chunks[path] = append(chunks[path], nil)
					}
					if len(chunks[path]) == 0 {
						t.Fatal("action before first choice")
					}
					last := len(chunks[path]) - 1
					chunks[path][last] = append(chunks[path][last], cmd)
					if path == 0 && cmd.Kind == "place_piece" {
						pieces = append(pieces, cmd)
					}
				}
				if len(chunks[path]) != 6 {
					t.Fatalf("fixture %d has %d choices", path, len(chunks[path]))
				}
				for i, chunk := range chunks[path] {
					wantPick := []string{"a", "b"}[path]
					if chunk[0].ItemID != fmt.Sprintf("%s_%02d", npc, i+1) || chunk[0].Pick != wantPick {
						t.Fatalf("unexpected fixture choice: %+v", chunk[0])
					}
				}
			}
			if len(pieces) == 0 {
				t.Fatal("missing manual puzzle pieces")
			}
			for mask := 0; mask < 64; mask++ {
				t.Run(fmt.Sprintf("%02d", mask), func(t *testing.T) {
					var wantAnswers []scoring.Answer
					for i := 0; i < 6; i++ {
						pick := "a"
						if mask&(1<<i) != 0 {
							pick = "b"
						}
						wantAnswers = append(wantAnswers, scoring.Answer{ID: fmt.Sprintf("%s_%02d", npc, i+1), Pick: pick})
					}
					var baselineProgress scoring.ProgressResult
					var baselineScore scoring.Result
					for mode := 0; mode < 3; mode++ {
						doc := NewDoc(f.Initial)
						apply := func(c Command) {
							t.Helper()
							if _, err := engine.Apply(&doc, c, f.CompletedAt); err != nil {
								t.Fatalf("mode %d command %+v: %v", mode, c, err)
							}
						}
						apply(Command{Kind: "open_episode", NPCID: npc})
						rests, puzzle := 0, 0
						for i := 0; i < 6; i++ {
							path := (mask >> i) & 1
							for _, command := range chunks[path][i] {
								commands := []Command{command}
								if command.Kind == "place_piece" {
									if mode == 1 {
										if puzzle > 0 {
											continue
										}
										commands = []Command{{Kind: "auto_arrange"}}
									}
									puzzle++
								}
								if command.Kind == "auto_arrange" {
									puzzle++
									if mode != 1 {
										commands = pieces
									}
								}
								for _, c := range commands {
									apply(c)
									if mode == 2 {
										var objects map[string]string
										switch npc {
										case "lumi":
											objects = doc.Snapshot.Lumi.Objects
										case "echo":
											objects = doc.Snapshot.Echo.Objects
										case "or":
											objects = doc.Snapshot.Or.Objects
										}
										for _, location := range objects {
											if location == "player" {
												apply(Command{Kind: "set_down", TargetID: npc + "-rest"})
												apply(Command{Kind: "pickup", TargetID: npc + "-rest"})
												rests++
												break
											}
										}
									}
								}
							}
						}
						if puzzle == 0 || (mode == 2 && rests == 0) {
							t.Fatalf("mode %d did not exercise puzzle or rest", mode)
						}
						if !reflect.DeepEqual(doc.Snapshot.Answers, wantAnswers) || !reflect.DeepEqual(doc.CompletedErrands, []string{npc}) || !reflect.DeepEqual(doc.Snapshot.CompletedEpisodes, []string{npc}) || !reflect.DeepEqual(doc.Events, map[string]bool{npc + "-errand-completed": true}) {
							t.Fatalf("mode %d wrong completion or answers: %+v", mode, doc)
						}
						input := scoring.Input{PlayID: doc.Snapshot.PlayID, Log: doc.Snapshot.Answers, CompletedErrands: doc.CompletedErrands}
						progress, err := engine.data.Progress(input)
						if err != nil {
							t.Fatal(err)
						}
						input.CompletedErrands = nil
						without, err := engine.data.Progress(input)
						if err != nil {
							t.Fatal(err)
						}
						for id, base := range without.NPCs {
							want := base.Affinity
							if id == npc {
								want = min(want+8, 100)
							}
							got := progress.NPCs[id]
							if got.Affinity != want || !reflect.DeepEqual(got.S, base.S) {
								t.Fatalf("mode %d reward for %s: got %+v, want affinity %d and scores %+v", mode, id, got, want, base.S)
							}
						}
						if !reflect.DeepEqual(progress.Reactions, without.Reactions) {
							t.Fatal("completion changed reactions")
						}
						input.CompletedErrands = doc.CompletedErrands
						input.Log = append([]scoring.Answer{}, doc.Snapshot.Answers...)
						for _, a := range golden.Log {
							if !strings.HasPrefix(a.ID, npc+"_") {
								input.Log = append(input.Log, a)
							}
						}
						result, err := engine.data.Score(input)
						if err != nil {
							t.Fatal(err)
						}
						if mode == 0 {
							baselineProgress, baselineScore = progress, result
						} else if !reflect.DeepEqual(progress, baselineProgress) || !reflect.DeepEqual(result, baselineScore) {
							t.Fatalf("mode %d changed progress or score", mode)
						}
					}
				})
			}
		})
	}
}
