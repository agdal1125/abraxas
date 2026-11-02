package play

func (e *Engine) lumi(s *Snapshot, c Command, at string) error {
	st, q := &s.Lumi, e.residents["lumi"]
	if !residentReady(s, "lumi", st) {
		return ErrTransition
	}
	p := st.Phase
	if p == "locked" && c.Kind == "open_episode" && c.NPCID == "lumi" && s.Segment == "hub" && !contains(s.CompletedEpisodes, "lumi") {
		st.Phase = "choose_01"
		s.Segment = "ep_lumi"
		s.EpisodeEnd = nil
		return nil
	}
	choices := map[string][2]string{"choose_01": {"lumi_01", "table"}, "choose_02": {"lumi_02", "card"}, "choose_03": {"lumi_03", "notice_pickup"}, "choose_04": {"lumi_04", "material_pickup"}, "choose_05": {"lumi_05", "welcome"}, "choose_06": {"lumi_06", "score_pickup"}}
	if rule, ok := choices[p]; ok && residentChoice(s, st, c, rule[0], rule[1]) {
		return nil
	}
	objects := map[string]string{"notice_pickup": "notice", "notice_first": "notice", "notice_second": "notice", "notice_return": "notice", "material_pickup": "material", "material_delivery": "material", "score_pickup": "score", "score_delivery": "score"}
	object := objects[p]
	if residentRest(st, c, "lumi", object) {
		return nil
	}
	branches := map[string]string{"table": "lumi_01", "card": "lumi_02", "notice_pickup": "lumi_03", "notice_first": "lumi_03", "notice_second": "lumi_03", "material_pickup": "lumi_04", "welcome": "lumi_05", "score_pickup": "lumi_06"}
	selected := func(kind string) bool { return residentTarget(s, q, st, c, kind, branches[p]) }
	switch {
	case (p == "notice_pickup" || p == "material_pickup" || p == "score_pickup") && selected("pickup") && st.Objects[object] == "source" && !carrying(st.Objects):
		st.Objects[object] = "player"
		st.Phase = map[string]string{"notice_pickup": "notice_first", "material_pickup": "material_delivery", "score_pickup": "score_delivery"}[p]
	case (p == "notice_first" || p == "notice_second") && st.Objects["notice"] == "player" && ((answer(s, "lumi_03") == "a" && selected("talk")) || (answer(s, "lumi_03") == "b" && selected("act"))):
		st.Phase = map[string]string{"notice_first": "notice_second", "notice_second": "notice_return"}[p]
	case (p == "notice_return" || p == "material_delivery" || p == "score_delivery") && st.Objects[object] == "player" && selected("deliver"):
		st.Objects[object] = "delivered"
		st.Phase = map[string]string{"notice_return": "stagekeeper", "material_delivery": "arrange", "score_delivery": "report"}[p]
	case (p == "table" || p == "card" || p == "welcome") && selected("act"):
		st.Phase = map[string]string{"table": "choose_02", "card": "choose_03", "welcome": "return"}[p]
	case (p == "stagekeeper" || p == "return") && selected("talk"):
		st.Phase = map[string]string{"stagekeeper": "choose_04", "return": "choose_06"}[p]
	case p == "arrange":
		return residentPuzzle(st, c, q, "choose_05")
	case p == "report" && st.Objects["notice"] == "delivered" && st.Objects["material"] == "delivered" && st.Objects["score"] == "delivered":
		return residentComplete(s, st, c, q, "lumi", "A", at)
	default:
		return ErrTransition
	}
	return nil
}
