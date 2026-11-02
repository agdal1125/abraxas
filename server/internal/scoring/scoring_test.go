package scoring

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestGolden(t *testing.T) {
	fsys := os.DirFS("../../../content/scoring")
	data, err := Load(fsys)
	if err != nil {
		t.Fatal(err)
	}
	paths, err := filepath.Glob("../../../content/scoring/golden/*.json")
	if err != nil || len(paths) == 0 {
		t.Fatal("missing golden cases", err)
	}
	for _, path := range paths {
		t.Run(filepath.Base(path), func(t *testing.T) {
			raw, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			var example struct {
				Input
				Expect Result `json:"expect"`
			}
			if err = json.Unmarshal(raw, &example); err != nil {
				t.Fatal(err)
			}
			got, err := data.Score(example.Input)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, example.Expect) {
				t.Fatalf("got %+v, want %+v", got, example.Expect)
			}
		})
	}
	if _, err := data.Score(Input{}); err == nil {
		t.Error("missing answers accepted")
	}
	raw, err := os.ReadFile(paths[0])
	if err != nil {
		t.Fatal(err)
	}
	var input Input
	if err := json.Unmarshal(raw, &input); err != nil {
		t.Fatal(err)
	}
	input.Log = append(input.Log, input.Log[0])
	if _, err := data.Score(input); err == nil {
		t.Error("duplicate answer accepted")
	}
}

func TestProgress(t *testing.T) {
	data, err := Load(os.DirFS("../../../content/scoring"))
	if err != nil {
		t.Fatal(err)
	}
	input := Input{PlayID: "test", Log: []Answer{{ID: "moka_01", Pick: "a"}, {ID: "moka_03", Pick: "a"}}}
	before, err := data.Progress(input)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before.Reactions, map[string]string{"moka_01": "thinking", "moka_03": "empathy"}) {
		t.Fatalf("reactions: %v", before.Reactions)
	}
	input.CompletedErrands = []string{"moka", "moka"}
	after, err := data.Progress(input)
	if err != nil {
		t.Fatal(err)
	}
	if after.NPCs["moka"].Affinity != before.NPCs["moka"].Affinity+8 || !reflect.DeepEqual(after.NPCs["moka"].S, before.NPCs["moka"].S) {
		t.Fatal("completion reward changed answer calculation or was applied more than once")
	}
	if _, err := data.Score(input); err == nil {
		t.Error("partial final result accepted")
	}
	data.Rules.AffinityStart = 99
	after, err = data.Progress(Input{CompletedErrands: []string{"moka"}})
	if err != nil || after.NPCs["moka"].Affinity != 100 {
		t.Fatal("completion reward did not clamp", err)
	}
	if _, err := data.Progress(Input{CompletedErrands: []string{"invalid"}}); err == nil {
		t.Error("unknown completion accepted")
	}
	for i := range data.NPCs {
		if data.NPCs[i].ID == "moka" {
			data.NPCs[i].Start["D"] = 0
		}
	}
	zero, err := data.Progress(Input{PlayID: "test", Log: []Answer{{ID: "moka_01", Pick: "a"}}})
	if err != nil || zero.Reactions["moka_01"] != "thinking" {
		t.Fatal("zero expectation", zero, err)
	}
	for i := range data.NPCs {
		if data.NPCs[i].ID == "moka" {
			data.NPCs[i].Start["D"] = -30
		}
	}
	ordered := []Answer{{ID: "moka_01", Pick: "a"}, {ID: "moka_03", Pick: "b"}, {ID: "moka_05", Pick: "a"}}
	forward, err := data.Progress(Input{PlayID: "test", Log: ordered})
	if err != nil {
		t.Fatal(err)
	}
	reverse, err := data.Progress(Input{PlayID: "test", Log: []Answer{ordered[2], ordered[1], ordered[0]}})
	if err != nil {
		t.Fatal(err)
	}
	if forward.Reactions["moka_05"] != "empathy" || reverse.Reactions["moka_05"] != "thinking" {
		t.Fatal("answer order ignored")
	}
}

func TestCompletionPreservesPersonality(t *testing.T) {
	data, err := Load(os.DirFS("../../../content/scoring"))
	if err != nil {
		t.Fatal(err)
	}
	paths, err := filepath.Glob("../../../content/scoring/golden/*.json")
	if err != nil || len(paths) == 0 {
		t.Fatal("missing golden cases", err)
	}
	raw, err := os.ReadFile(paths[0])
	if err != nil {
		t.Fatal(err)
	}
	var input Input
	if err := json.Unmarshal(raw, &input); err != nil {
		t.Fatal(err)
	}
	for mask := 0; mask < 64; mask++ {
		for i := range input.Log {
			for n := 1; n <= 6; n++ {
				if input.Log[i].ID == fmt.Sprintf("moka_%02d", n) {
					input.Log[i].Pick = "b"
					if mask&(1<<(n-1)) != 0 {
						input.Log[i].Pick = "a"
					}
				}
			}
		}
		input.CompletedErrands = nil
		base, err := data.Score(input)
		if err != nil {
			t.Fatal(err)
		}
		input.CompletedErrands = []string{"moka"}
		completed, err := data.Score(input)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(base.S, completed.S) || base.Type != completed.Type || base.Modifier != completed.Modifier || completed.NPCs["moka"].Affinity != min(base.NPCs["moka"].Affinity+8, 100) {
			t.Fatalf("completion changed result for mask %d", mask)
		}
	}
}
