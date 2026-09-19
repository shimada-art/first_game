import { useState } from "react";
import { Card, colors, fonts } from "@souk/ui";
import {
  useAnimationSpeed,
  useSetAnimationSpeed,
  useSetSoundEnabled,
  useSoundEnabled,
  type AnimationSpeed,
} from "../settings/SettingsContext.js";

const SPEED_LABEL: Record<AnimationSpeed, string> = {
  full: "Full",
  fast: "Fast",
  instant: "Instant",
};

const SPEED_OPTIONS: AnimationSpeed[] = ["full", "fast", "instant"];

/** A small gear button in TopBar that opens this popover — client-only presentation preferences, never sent to the server or read by the engine. */
export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const animationSpeed = useAnimationSpeed();
  const setAnimationSpeed = useSetAnimationSpeed();
  const soundEnabled = useSoundEnabled();
  const setSoundEnabled = useSetSoundEnabled();

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={open}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: `1px solid ${colors.brass}`,
          background: open ? colors.brass : "transparent",
          color: open ? colors.nightVeil : colors.paper,
          cursor: "pointer",
          fontSize: "1.05rem",
          lineHeight: 1,
        }}
      >
        ⚙
      </button>

      {open && (
        <>
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
          />
          <div style={{ position: "absolute", right: 0, top: "44px", zIndex: 999, width: "220px" }}>
            <Card style={{ padding: "14px 16px" }}>
              <h4
                style={{
                  margin: "0 0 10px",
                  fontFamily: fonts.headingLatin,
                  fontSize: "0.85rem",
                  color: colors.ink,
                }}
              >
                Settings
              </h4>

              <div style={{ marginBottom: "12px" }}>
                <p style={{ margin: "0 0 6px", fontSize: "0.72rem", color: colors.inkSoft }}>Animation speed</p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {SPEED_OPTIONS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setAnimationSpeed(speed)}
                      style={{
                        flex: "1 1 auto",
                        padding: "6px 8px",
                        fontSize: "0.75rem",
                        borderRadius: "999px",
                        border: `1px solid ${animationSpeed === speed ? colors.ink : colors.line}`,
                        background: animationSpeed === speed ? colors.ink : "transparent",
                        color: animationSpeed === speed ? colors.paper : colors.ink,
                        cursor: "pointer",
                      }}
                    >
                      {SPEED_LABEL[speed]}
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                />
                Sound effects
              </label>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
