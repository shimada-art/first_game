import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type AnimationSpeed = "full" | "fast" | "instant";

/** Multiplier applied to every fx.tsx timing/CSS animation-duration. */
export const ANIMATION_SPEED_MULTIPLIER: Record<AnimationSpeed, number> = {
  full: 1,
  fast: 0.5,
  instant: 0,
};

interface SettingsState {
  animationSpeed: AnimationSpeed;
  setAnimationSpeed: (speed: AnimationSpeed) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

const SPEED_STORAGE_KEY = "souk.animationSpeed";
const SOUND_STORAGE_KEY = "souk.soundEnabled";

function readStoredSpeed(): AnimationSpeed {
  try {
    const v = localStorage.getItem(SPEED_STORAGE_KEY);
    return v === "full" || v === "fast" || v === "instant" ? v : "full";
  } catch {
    return "full";
  }
}

function readStoredSound(): boolean {
  try {
    const v = localStorage.getItem(SOUND_STORAGE_KEY);
    return v !== "off";
  } catch {
    return true;
  }
}

const SettingsContext = createContext<SettingsState | null>(null);

/**
 * Purely a client-side presentation preference — never touches the
 * server-authoritative game engine or any broadcast state. Persisted to
 * localStorage so it survives reloads/reconnects, matching the pattern
 * used for the auth token (see api/client.ts).
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [animationSpeed, setAnimationSpeedState] = useState<AnimationSpeed>(readStoredSpeed);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(readStoredSound);

  const setAnimationSpeed = useCallback((speed: AnimationSpeed) => {
    setAnimationSpeedState(speed);
    try {
      localStorage.setItem(SPEED_STORAGE_KEY, speed);
    } catch {
      // Storage unavailable (private mode, etc.) — preference just won't persist across reloads.
    }
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      // Storage unavailable — preference just won't persist across reloads.
    }
  }, []);

  const value = useMemo(
    () => ({ animationSpeed, setAnimationSpeed, soundEnabled, setSoundEnabled }),
    [animationSpeed, setAnimationSpeed, soundEnabled, setSoundEnabled],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside a SettingsProvider");
  return ctx;
}

/** The current animation-speed multiplier (1 = full, 0.5 = fast, 0 = instant). */
export function useAnimationSpeedMultiplier(): number {
  return ANIMATION_SPEED_MULTIPLIER[useSettings().animationSpeed];
}

export function useAnimationSpeed(): AnimationSpeed {
  return useSettings().animationSpeed;
}

export function useSetAnimationSpeed(): (speed: AnimationSpeed) => void {
  return useSettings().setAnimationSpeed;
}

export function useSoundEnabled(): boolean {
  return useSettings().soundEnabled;
}

export function useSetSoundEnabled(): (enabled: boolean) => void {
  return useSettings().setSoundEnabled;
}
