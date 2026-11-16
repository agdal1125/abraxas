export function validName(value: string): string | null {
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) return null;
  const name = value.trim();
  return Array.from(name).length <= 12 ? name : null;
}

type OpeningActions = {
  prelude: () => Promise<void>;
  scene: (scene: "entrance") => void;
  mode: (mode: "lead" | "follow" | "sit") => void;
  knot: (knot: string) => Promise<void>;
  name: () => Promise<void>;
  question: (id: string) => Promise<void>;
  questions: () => Promise<void>;
};

export async function openingSequence(actions: OpeningActions, fresh: boolean): Promise<void> {
  if (fresh) {
    await actions.prelude();
    actions.scene("entrance");
    actions.mode("lead");
    await actions.knot("demi_follow");
    actions.mode("follow");
    await actions.knot("postman_intro");
    actions.mode("sit");
    await actions.question("prologue_01");
    actions.mode("follow");
    await actions.knot("postman_name");
    await actions.name();
    await actions.knot("postman_named");
  } else actions.scene("entrance");
  actions.mode("sit");
  await actions.questions();
  actions.mode("follow");
  await actions.knot("prologue_outro");
}
