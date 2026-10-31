package scoring

import (
	"encoding/json"
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
