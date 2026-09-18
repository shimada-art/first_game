import { useEffect, useState } from "react";
import { colors, fonts } from "./tokens.js";

export function PhaseTimer({
  deadlineAt,
  onDark = false,
}: {
  deadlineAt: number | null;
  /** Use light, glowing tones — for placement on the dark table backdrop rather than the parchment UI. */
  onDark?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadlineAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [deadlineAt]);

  if (deadlineAt === null) return null;

  const remainingMs = Math.max(0, deadlineAt - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = seconds <= 10;

  const color = onDark
    ? urgent
      ? "#F2846B"
      : colors.lantern
    : urgent
      ? colors.textileText
      : colors.ink;

  return (
    <div
      style={{
        fontFamily: fonts.headingLatin,
        fontWeight: 600,
        fontSize: "1.1rem",
        color,
        minWidth: "3ch",
        textAlign: "center",
        textShadow: onDark ? "0 1px 3px rgba(0,0,0,0.6)" : undefined,
      }}
    >
      {seconds}s
    </div>
  );
}
