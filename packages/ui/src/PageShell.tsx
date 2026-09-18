import type { ReactNode } from "react";
import { colors, fonts } from "./tokens.js";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.paper,
        color: colors.ink,
        fontFamily: fonts.bodyLatin,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}
