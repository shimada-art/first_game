import type { ReactNode } from "react";
import { colors } from "./tokens.js";

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
}

const DIMENSIONS: Record<NonNullable<MerchantPortraitProps["size"]>, number> = {
  sm: 44,
  md: 64,
  lg: 112,
};

/**
 * A framed circular portrait slot for a merchant character. Renders a
 * generated portrait image once one exists (Phase C); until then, a tinted
 * silhouette keeps every seat visually distinct without falling back to a
 * flat initial-letter avatar.
 */
export function MerchantPortrait({
  color,
  portraitUrl,
  size = "md",
  faded = false,
  active = false,
  badge,
}: MerchantPortraitProps) {
  const dimension = DIMENSIONS[size];

  return (
    <div
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
          filter: faded ? "grayscale(0.6)" : "none",
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
