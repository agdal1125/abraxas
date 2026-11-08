package play

func (e *Engine) echo(s *Snapshot, c Command, at string) error {
	st, q := &s.Echo, e.residents["echo"]
	if !residentReady(s, "echo", st) {
		return ErrTransition
	}
	p := st.Phase
	if p == "locked" && c.Kind == "open_episode" && c.NPCID == "echo" && s.Segment == "hub" && !contains(s.CompletedEpisodes, "echo") {
		st.Phase = "choose_01"
		s.Segment = "ep_echo"
		s.EpisodeEnd = nil
		return nil
	}
	choices := map[string][2]string{"choose_01": {"echo_01", "enclose"}, "choose_02": {"echo_02", "search"}, "choose_03": {"echo_03", "notebook_delivery"}, "choose_04": {"echo_04", "arrange"}, "choose_05": {"echo_05", "bookmark"}, "choose_06": {"echo_06", "legend_delivery"}}
	if rule, ok := choices[p]; ok && residentChoice(s, st, c, rule[0], rule[1]) {
		carryOnChoice(st, map[string]string{"choose_03": "notebook", "choose_06": "legend"}[p])
		return nil
	}
	objects := map[string]string{"book_delivery": "book", "record_delivery": "record", "notebook_delivery": "notebook", "legend_delivery": "legend"}
	object := objects[p]
	if residentRest(st, c, "echo", object) {
		return nil
	}
	branches := map[string]string{"enclose": "echo_01", "search": "echo_02", "notebook_delivery": "echo_03", "bookmark": "echo_05", "legend_delivery": "echo_06"}
	selected := func(kind string) bool { return residentTarget(s, q, st, c, kind, branches[p]) }
	switch {
	case (p == "book_delivery" || p == "record_delivery" || p == "notebook_delivery" || p == "legend_delivery") && st.Objects[object] == "player" && selected("deliver"):
		st.Objects[object] = "delivered"
		st.Phase = map[string]string{"book_delivery": "choose_02", "record_delivery": "choose_03", "notebook_delivery": "organizer", "legend_delivery": "report"}[p]
	case (p == "enclose" || p == "search") && selected("act") && !carrying(st.Objects):
		held := map[string]string{"enclose": "book", "search": "record"}[p]
		st.Objects[held] = "player"
		st.Phase = held + "_delivery"
	case (p == "reading" || p == "bookmark") && selected("act"):
		st.Phase = map[string]string{"reading": "choose_05", "bookmark": "choose_06"}[p]
	case p == "organizer" && selected("talk"):
		st.Phase = "choose_04"
	case p == "arrange":
		return residentPuzzle(st, c, q, "reading")
	case p == "report" && st.Objects["book"] == "delivered" && st.Objects["record"] == "delivered" && st.Objects["notebook"] == "delivered" && st.Objects["legend"] == "delivered":
		return residentComplete(s, st, c, q, "echo", "C", at)
	default:
		return ErrTransition
	}
	return nil
}
