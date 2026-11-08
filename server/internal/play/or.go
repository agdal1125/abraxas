package play

func (e *Engine) or(s *Snapshot, c Command, at string) error {
	st, q := &s.Or, e.residents["or"]
	if !residentReady(s, "or", st) {
		return ErrTransition
	}
	p := st.Phase
	if p == "locked" && c.Kind == "open_episode" && c.NPCID == "or" && s.Segment == "hub" && !contains(s.CompletedEpisodes, "or") {
		st.Phase = "choose_01"
		s.Segment = "ep_or"
		s.EpisodeEnd = nil
		return nil
	}
	choices := map[string][2]string{"choose_01": {"or_01", "fire"}, "choose_02": {"or_02", "find_sand"}, "choose_03": {"or_03", "weight"}, "choose_04": {"or_04", "review"}, "choose_05": {"or_05", "hook"}, "choose_06": {"or_06", "finish"}}
	if rule, ok := choices[p]; ok && residentChoice(s, st, c, rule[0], rule[1]) {
		carryOnChoice(st, map[string]string{"choose_02": "bucket"}[p])
		return nil
	}
	objects := map[string]string{"find_sand": "bucket", "sand": "bucket", "sand_delivery": "bucket", "finish": "bell", "bell_delivery": "bell"}
	object := objects[p]
	if residentRest(st, c, "or", object) {
		return nil
	}
	branches := map[string]string{"fire": "or_01", "find_sand": "or_02", "weight": "or_03", "review": "or_04", "hook": "or_05", "finish": "or_06"}
	selected := func(kind string) bool { return residentTarget(s, q, st, c, kind, branches[p]) }
	switch {
	case p == "find_sand" && st.Objects["bucket"] == "player" && answer(s, "or_02") == "a" && selected("act"):
		st.Phase = "sand"
	case p == "find_sand" && st.Objects["bucket"] == "player" && answer(s, "or_02") == "b" && selected("talk"):
		st.Phase = "sand"
	case p == "sand" && st.Objects["bucket"] == "player" && selected("act"):
		st.Phase = "sand_delivery"
	case p == "sand_delivery" && st.Objects["bucket"] == "player" && selected("deliver"):
		st.Objects["bucket"] = "delivered"
		st.Phase = "gears"
	case (p == "fire" || p == "weight" || p == "review" || p == "lantern_link" || p == "hook") && selected("act"):
		st.Phase = map[string]string{"fire": "choose_02", "weight": "assistant", "review": "lantern_link", "lantern_link": "choose_05", "hook": "choose_06"}[p]
	case p == "assistant" && selected("talk"):
		st.Phase = "choose_04"
	case p == "finish" && answer(s, "or_06") == "a" && selected("act"):
		st.Phase = "report"
	case p == "finish" && answer(s, "or_06") == "b" && selected("pickup") && st.Objects["bell"] == "source" && !carrying(st.Objects):
		st.Objects["bell"] = "player"
		st.Phase = "bell_delivery"
	case p == "bell_delivery" && st.Objects["bell"] == "player" && selected("deliver"):
		st.Objects["bell"] = "delivered"
		st.Phase = "report"
	case p == "gears":
		return residentPuzzle(st, c, q, "choose_03")
	case p == "report" && st.Objects["bucket"] == "delivered" && ((answer(s, "or_06") == "a" && st.Objects["bell"] == "source") || (answer(s, "or_06") == "b" && st.Objects["bell"] == "delivered")):
		return residentComplete(s, st, c, q, "or", "D", at)
	default:
		return ErrTransition
	}
	return nil
}
