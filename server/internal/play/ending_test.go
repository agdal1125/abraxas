package play

import (
	"encoding/json"
	"github.com/agdal1125/abraxas/server/internal/scoring"
	"testing"
)

func TestEndingCommands(t *testing.T) {
	e, err := Load("../../../content", "v")
	if err != nil {
		t.Fatal(err)
	}
	d := NewDoc(NewSnapshot("play", "v"))
	d.Snapshot.Segment = "festival"
	for _, item := range e.items {
		d.Snapshot.Answers = append(d.Snapshot.Answers, scoring.Answer{ID: item.ID, Pick: "a"})
	}
	if _, err := e.Apply(&d, Command{Kind: "finish_segment"}, ""); err == nil {
		t.Fatal("festival finished without companion")
	}
	if _, err := e.Apply(&d, Command{Kind: "festival_companion", NPCID: "lumi"}, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := e.Apply(&d, Command{Kind: "finish_segment"}, ""); err != nil {
		t.Fatal(err)
	}
	for _, item := range e.gates {
		d.Snapshot.Answers = append(d.Snapshot.Answers, scoring.Answer{ID: item.ID, Pick: "a"})
	}
	if _, err := e.Apply(&d, Command{Kind: "finish_segment"}, ""); err != nil || d.Snapshot.Segment != "confession" {
		t.Fatalf("gate: %v, %s", err, d.Snapshot.Segment)
	}
	if _, err := e.Apply(&d, Command{Kind: "confess", NPCID: "moka", Reason: "both"}, ""); err != nil {
		t.Fatal(err)
	}
	if d.Snapshot.Segment != "result" || d.Snapshot.Result == nil || d.FirstResult == nil {
		t.Fatal("result not saved")
	}
}

func TestEndingThresholdAndCompanion(t *testing.T) {
	for _, tc := range []struct {
		start                int
		target, reason, want string
	}{
		{49, "lumi", "similar", "waiting"}, {50, "lumi", "drawn", "accepted"},
		{60, "moka", "unsure", "accepted"}, {99, "lumi", "both", "accepted"},
	} {
		e, err := Load("../../../content", "v")
		if err != nil {
			t.Fatal(err)
		}
		e.data.Rules.AffinityStart = tc.start
		e.data.Rules.AffinityGain = 0
		d := NewDoc(NewSnapshot("play", "v"))
		d.Snapshot.Segment = "confession"
		companion := "lumi"
		d.Snapshot.FestivalCompanion = &companion
		for _, item := range append(e.items, e.gates...) {
			d.Snapshot.Answers = append(d.Snapshot.Answers, scoring.Answer{ID: item.ID, Pick: "a"})
		}
		if _, err := e.Apply(&d, Command{Kind: "confess", NPCID: tc.target, Reason: tc.reason}, ""); err != nil {
			t.Fatal(err)
		}
		if d.Snapshot.Confession.Outcome != tc.want {
			t.Fatalf("%+v: %s", tc, d.Snapshot.Confession.Outcome)
		}
		before, _ := json.Marshal(d)
		if _, err := e.Apply(&d, Command{Kind: "confess", NPCID: tc.target, Reason: tc.reason}, ""); err == nil {
			t.Fatal("duplicate accepted")
		}
		after, _ := json.Marshal(d)
		if string(before) != string(after) {
			t.Fatal("duplicate changed state")
		}
	}
}
