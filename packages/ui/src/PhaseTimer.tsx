import { useEffect, useState } from "react";
import { colors, fonts } from "./tokens.js";

export function PhaseTimer({ deadlineAt }: { deadlineAt: number | null }) {
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

  return (
    <div
      style={{
        fontFamily: fonts.headingLatin,
        fontWeight: 600,
        fontSize: "1.1rem",
        color: urgent ? colors.textileText : colors.ink,
        minWidth: "3ch",
        textAlign: "center",
      }}
    >
      {seconds}s
    </div>
  );
}
