import { useEffect, useRef, type ReactNode } from "react";
import { colors } from "./tokens.js";

/**
 * The full emotional vocabulary a character can be shown reacting with.
 * "idle" is the resting state; everything else is a transient reaction to
 * a real game event (see apps/client/src/game/fx.tsx for what triggers
 * each one) — never a decorative loop. `portraits` maps some or all of
 * these to generated art; until art exists for a given expression the
 * silhouette itself still plays the matching motion/tint, so the wiring
 * is real today and upgrades for free once art lands.
 */
export type Expression =
  | "idle"
  | "happy"
  | "confident"
  | "suspicious"
  | "surprised"
  | "angry"
  | "shocked"
  | "sad"
  | "victory"
  | "thinking";

export interface MerchantPortraitProps {
  /** Seat-derived identity color (see tokens.seatPalette). */
  color: string;
  /** Generated character art, once available (Phase C). Falls back to a silhouette. */
  portraitUrl?: string | undefined;
  size?: "sm" | "md" | "lg";
  /** Dims and desaturates — used for a disconnected player. */
  faded?: boolean;
  /** Warm glow ring — used for "this player is acting right now". */
  active?: boolean;
  /** Small overlay in the bottom-right corner (e.g. a raid-committed check). */
  badge?: ReactNode;
  /** Current emotional state — see the Expression union for what drives each one. */
  expression?: Expression;
}

const DIMENSIONS: Record<NonNullable<MerchantPortraitProps["size"]>, number> = {
  sm: 44,
  md: 64,
  lg: 112,
};

/** Expressions with a one-shot motion; anything else (idle, thinking, suspicious) is static/handled elsewhere. */
const ANIMATED_EXPRESSIONS = new Set<Expression>([
  "happy",
  "confident",
  "surprised",
  "angry",
  "shocked",
  "sad",
  "victory",
]);

/**
 * A framed circular portrait slot for a merchant character. Renders a
 * generated portrait image once one exists (Phase C); until then, a tinted
 * silhouette keeps every seat visually distinct without falling back to a
 * flat initial-letter avatar. `expression` plays a short, real reaction —
 * every value maps to a `souk-expr-<name>` keyframe defined once in the
 * app's global stylesheet.
 */
export function MerchantPortrait({
  color,
  portraitUrl,
  size = "md",
  faded = false,
  active = false,
  badge,
  expression = "idle",
}: MerchantPortraitProps) {
  const dimension = DIMENSIONS[size];
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || !ANIMATED_EXPRESSIONS.has(expression)) return;
    el.style.animation = "none";
    // Force reflow so the same expression firing twice in a row still restarts the animation.
    void el.offsetWidth;
    el.style.animation = `souk-expr-${expression} 650ms ease`;
  }, [expression]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        width: dimension,
        height: dimension,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          padding: 3,
          background: active
            ? `conic-gradient(${colors.lantern}, ${colors.brass}, ${colors.lantern})`
            : `linear-gradient(155deg, ${colors.brass}, ${colors.brassDim})`,
          boxShadow: active
            ? `0 0 0 3px ${colors.nightVeil}, 0 0 14px 2px rgba(242,184,75,0.55)`
            : `0 0 0 3px ${colors.nightVeil}, 0 2px 6px rgba(0,0,0,0.35)`,
          transition: "box-shadow 200ms ease",
          opacity: faded ? 0.5 : 1,
          filter: [faded && "grayscale(0.6)", expression === "suspicious" && "sepia(0.45) saturate(1.4)"]
            .filter(Boolean)
            .join(" ") || "none",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            overflow: "hidden",
            background: portraitUrl
              ? colors.nightVeil
              : `radial-gradient(circle at 50% 35%, ${color}CC, ${color}55 70%, ${colors.nightVeil})`,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          {portraitUrl ? (
            <img
              src={portraitUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <svg
              viewBox="0 0 64 64"
              width="78%"
              height="78%"
              aria-hidden
              style={{ opacity: 0.9 }}
            >
              <circle cx="32" cy="22" r="12" fill="rgba(0,0,0,0.55)" />
              <path
                d="M8 62c0-15 10.7-24 24-24s24 9 24 24"
                fill="rgba(0,0,0,0.55)"
              />
            </svg>
          )}
        </div>
      </div>
      {badge && (
        <div style={{ position: "absolute", bottom: -2, right: -2 }}>{badge}</div>
      )}
    </div>
  );
}
