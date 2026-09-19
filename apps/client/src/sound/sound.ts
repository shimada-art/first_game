/**
 * Sound-hook architecture: every cue here is wired in fx.tsx at exactly
 * the same real-event trigger points that drive the visual fx (coin
 * deltas, raid reveals, whisper reveals, round transitions, victory) —
 * never a decorative-only trigger. Playback is synthesized with the Web
 * Audio API rather than external asset files, since there's no bundled
 * (or reliably generatable) sample library for this project; every cue
 * is a short, deliberately simple tone motif built from oscillators, so
 * the architecture is genuinely sound-producing today rather than a
 * silent stub waiting on assets that may never arrive.
 */
export type SoundCue =
  | "coinGain"
  | "coinLoss"
  | "raidSuccess"
  | "raidBlocked"
  | "raidCancel"
  | "whisperCaught"
  | "whisperVerified"
  | "bribeAccepted"
  | "roundBegin"
  | "reckoning"
  | "victory"
  | "reaction";

type OscType = "sine" | "triangle" | "square" | "sawtooth";

interface Note {
  /** Seconds from the cue's start. */
  at: number;
  freq: number;
  duration: number;
  type?: OscType;
  gain?: number;
}

const CUE_NOTES: Record<SoundCue, Note[]> = {
  coinGain: [
    { at: 0, freq: 660, duration: 0.09, type: "triangle" },
    { at: 0.07, freq: 990, duration: 0.14, type: "triangle" },
  ],
  coinLoss: [{ at: 0, freq: 220, duration: 0.16, type: "sawtooth", gain: 0.18 }],
  raidSuccess: [
    { at: 0, freq: 140, duration: 0.12, type: "square", gain: 0.2 },
    { at: 0.03, freq: 830, duration: 0.16, type: "triangle" },
  ],
  raidBlocked: [
    { at: 0, freq: 520, duration: 0.08, type: "square", gain: 0.16 },
    { at: 0.09, freq: 390, duration: 0.1, type: "square", gain: 0.16 },
  ],
  raidCancel: [{ at: 0, freq: 300, duration: 0.2, type: "sine", gain: 0.14 }],
  whisperCaught: [
    { at: 0, freq: 700, duration: 0.06, type: "sawtooth", gain: 0.16 },
    { at: 0.07, freq: 260, duration: 0.18, type: "sawtooth", gain: 0.16 },
  ],
  whisperVerified: [{ at: 0, freq: 880, duration: 0.14, type: "sine" }],
  bribeAccepted: [
    { at: 0, freq: 550, duration: 0.08, type: "triangle" },
    { at: 0.08, freq: 770, duration: 0.12, type: "triangle" },
  ],
  roundBegin: [
    { at: 0, freq: 392, duration: 0.14, type: "sine", gain: 0.14 },
    { at: 0.13, freq: 523, duration: 0.18, type: "sine", gain: 0.14 },
  ],
  reckoning: [
    { at: 0, freq: 440, duration: 0.1, type: "triangle", gain: 0.14 },
    { at: 0.1, freq: 660, duration: 0.16, type: "triangle", gain: 0.14 },
  ],
  victory: [
    { at: 0, freq: 523, duration: 0.14, type: "triangle" },
    { at: 0.12, freq: 659, duration: 0.14, type: "triangle" },
    { at: 0.24, freq: 784, duration: 0.28, type: "triangle" },
  ],
  reaction: [{ at: 0, freq: 500, duration: 0.05, type: "sine", gain: 0.12 }],
};

let ctx: AudioContext | null = null;
let unlocked = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** Browsers suspend a freshly created AudioContext until a real user gesture resumes it. */
function unlockOnFirstGesture(): void {
  if (unlocked || typeof document === "undefined") return;
  unlocked = true;
  const resume = () => {
    getContext()?.resume().catch(() => undefined);
    document.removeEventListener("pointerdown", resume);
    document.removeEventListener("keydown", resume);
  };
  document.addEventListener("pointerdown", resume, { once: true });
  document.addEventListener("keydown", resume, { once: true });
}

if (typeof document !== "undefined") unlockOnFirstGesture();

export function playSound(cue: SoundCue): void {
  const audio = getContext();
  if (!audio || audio.state === "suspended") return;

  for (const note of CUE_NOTES[cue]) {
    const osc = audio.createOscillator();
    const gainNode = audio.createGain();
    osc.type = note.type ?? "sine";
    osc.frequency.value = note.freq;

    const start = audio.currentTime + note.at;
    const peak = note.gain ?? 0.15;
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(peak, start + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);

    osc.connect(gainNode);
    gainNode.connect(audio.destination);
    osc.start(start);
    osc.stop(start + note.duration + 0.02);
  }
}
