import type { CSSProperties, ReactNode } from "react";
import { colors } from "./tokens.js";

// An 8-point zellige-style star tile, tiled as a subtle low-opacity overlay
// so the table reads as patterned wood/tilework instead of a flat gradient.
const ZELLIGE_TILE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'%3E%3Cg fill='none' stroke='%23C9A227' stroke-width='0.6' opacity='0.5'%3E%3Cpath d='M28 2 L34 14 L28 26 L22 14 Z'/%3E%3Cpath d='M28 30 L34 42 L28 54 L22 42 Z'/%3E%3Cpath d='M2 28 L14 22 L26 28 L14 34 Z'/%3E%3Cpath d='M30 28 L42 22 L54 28 L42 34 Z'/%3E%3Ccircle cx='28' cy='28' r='5'/%3E%3C/g%3E%3C/svg%3E";

export interface TableSurfaceProps {
  children: ReactNode;
  /** Renders lantern-glow accents in the corners. Off by default for reduced-motion contexts. */
  lanterns?: boolean;
}

/**
 * The living bazaar backdrop: a wood/zellige-patterned table under warm
 * lantern light. Purely atmospheric — it lays out no game state itself,
 * it just gives every phase's content somewhere that isn't a flat page.
 */
export function TableSurface({ children, lanterns = true }: TableSurfaceProps) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: "28px",
        margin: "0 auto",
        width: "100%",
        maxWidth: "980px",
        padding: "clamp(16px, 3vw, 36px)",
        background: `
          radial-gradient(ellipse 90% 70% at 50% 8%, rgba(242,184,75,0.16), transparent 60%),
          radial-gradient(circle at 50% 50%, ${colors.wood}, ${colors.woodDark} 78%)
        `,
        boxShadow: `inset 0 0 0 2px rgba(201,162,39,0.35), inset 0 20px 50px rgba(0,0,0,0.45), 0 18px 40px rgba(0,0,0,0.4)`,
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("${ZELLIGE_TILE}")`,
          backgroundSize: "56px 56px",
          opacity: 0.35,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />
      {lanterns && (
        <>
          <LanternGlow style={{ top: "-40px", left: "-30px" }} />
          <LanternGlow style={{ top: "-40px", right: "-30px" }} />
        </>
      )}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

function LanternGlow({ style }: { style: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        width: "220px",
        height: "220px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(242,184,75,0.35), transparent 70%)",
        animation: "souk-lantern-pulse 5s ease-in-out infinite",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}
