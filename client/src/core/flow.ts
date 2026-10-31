export function nextSegment(segment: string, completed: number): string {
  if (segment === "title") return "prologue";
  if (segment === "prologue" || segment.startsWith("interlude_")) return "hub";
  if (segment.startsWith("ep_")) return completed < 4 ? `interlude_${completed}` : "festival";
  if (segment === "festival") return "gate";
  if (segment === "gate") return "result";
  return "title";
}
