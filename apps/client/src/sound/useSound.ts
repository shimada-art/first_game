import { useCallback } from "react";
import { useSoundEnabled } from "../settings/SettingsContext.js";
import { playSound, type SoundCue } from "./sound.js";

/** Bridges the pure playSound() synthesizer with the user's mute preference. */
export function usePlaySound(): (cue: SoundCue) => void {
  const enabled = useSoundEnabled();
  return useCallback((cue: SoundCue) => {
    if (enabled) playSound(cue);
  }, [enabled]);
}
