// Display-only progress ("memory fragments n/12"). Never feeds scoring or the server.
export const MAX_FRAGMENTS = 12;
const EPISODE_FRAGMENTS = 2;
const MAX_EPISODES = 4;

export type FragmentGroups = { prologue: readonly string[]; festival: readonly string[]; tiebreakers: readonly string[] };

const allAnswered = (ids: readonly string[], answered: ReadonlySet<string>): boolean => ids.length > 0 && ids.every(id => answered.has(id));

// Which option was picked is deliberately ignored: fragments are never graded by choice.
export function fragmentCount(answeredIds: readonly string[], completedEpisodes: readonly string[], groups: FragmentGroups): number {
  const answered = new Set(answeredIds);
  const episodes = Math.min(new Set(completedEpisodes).size, MAX_EPISODES);
  return (allAnswered(groups.prologue, answered) ? 1 : 0) + episodes * EPISODE_FRAGMENTS + (allAnswered(groups.festival, answered) ? 2 : 0) + (allAnswered(groups.tiebreakers, answered) ? 1 : 0);
}
