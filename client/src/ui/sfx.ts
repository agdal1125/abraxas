// Minigame sound effects, synthesized with Web Audio: no files to load or license.
// Only minigames call these; measured choices stay silent so sound never nudges an answer.
const KEY = "abraxas-sound";
const VOLUME = .22;
let context: AudioContext | null = null;

export function soundOn(): boolean { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } }
export function setSound(on: boolean): void { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* Sound follows the in-memory default. */ } }

function audio(): AudioContext | null {
  if (!soundOn() || typeof AudioContext === "undefined") return null;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume().catch(() => {});
  return context;
}
// Browsers only start audio after a gesture; ribbon playback runs on timers, so the context is opened on the first touch.
if (typeof window !== "undefined") window.addEventListener("pointerdown", () => { audio(); }, { capture: true, once: true });

function tone(frequency: number, { at = 0, length = .3, type = "triangle" as OscillatorType, gain = 1, slideTo }: { at?: number; length?: number; type?: OscillatorType; gain?: number; slideTo?: number } = {}): void {
  const ctx = audio(); if (!ctx) return;
  const start = ctx.currentTime + at, osc = ctx.createOscillator(), amp = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(frequency, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + length);
  amp.gain.setValueAtTime(0, start); amp.gain.linearRampToValueAtTime(VOLUME * gain, start + .008); amp.gain.exponentialRampToValueAtTime(.0001, start + length);
  osc.connect(amp).connect(ctx.destination); osc.start(start); osc.stop(start + length + .02);
}
function noise(center: number, { at = 0, length = .06, gain = 1, q = 4 }: { at?: number; length?: number; gain?: number; q?: number } = {}): void {
  const ctx = audio(); if (!ctx) return;
  const start = ctx.currentTime + at, size = Math.ceil(ctx.sampleRate * length), buffer = ctx.createBuffer(1, size, ctx.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
  const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
  source.buffer = buffer; filter.type = "bandpass"; filter.frequency.value = center; filter.Q.value = q; amp.gain.value = VOLUME * gain;
  source.connect(filter).connect(amp).connect(ctx.destination); source.start(start);
}

const RIBBON_NOTES = [523.25, 587.33, 659.25, 783.99]; // C5 D5 E5 G5: any order sounds pleasant.
export const sfx = {
  ribbon: (index: number) => tone(RIBBON_NOTES[index] ?? 523.25, { length: .38 }),
  wrong: () => tone(220, { length: .2, type: "square", gain: .35, slideTo: 150 }),
  cleared: () => [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => tone(note, { at: i * .08, length: .4, type: "sine", gain: .8 })),
  ovenTick: () => tone(1760, { length: .05, type: "sine", gain: .25 }),
  ovenDing: () => { tone(1318.5, { length: .9, type: "sine" }); tone(1975.5, { length: .6, type: "sine", gain: .35 }); },
  ovenThud: () => { noise(180, { length: .14, gain: 1.4, q: 1 }); tone(110, { length: .16, type: "sine", gain: .6 }); },
  bookTok: () => { noise(950, { length: .05, gain: 1.2 }); tone(330, { length: .07, type: "sine", gain: .4 }); },
  bookSwap: () => { sfx.bookTok(); noise(780, { at: .09, length: .05, gain: 1.1 }); },
  gearClick: () => noise(2600, { length: .035, gain: .9, q: 8 }),
  gearSet: () => { tone(880, { length: .14, type: "square", gain: .25 }); tone(1320, { at: .04, length: .2, type: "sine", gain: .4 }); },
};
