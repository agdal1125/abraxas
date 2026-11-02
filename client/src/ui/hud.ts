import "./hud.css";

export function objectiveKey(segment: string, stage: string): "hub" | "character" | "quest" | "return" | "interlude" | "festival" | "gate" {
  if (segment.startsWith("ep_")) return stage === "quest" ? "quest" : stage === "return" ? "return" : "character";
  if (segment.startsWith("interlude_")) return "interlude";
  if (segment === "festival" || segment === "gate") return segment;
  return "hub";
}
