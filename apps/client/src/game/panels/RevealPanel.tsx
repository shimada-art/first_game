import { useEffect, useRef, useState } from "react";
import type { GameStateView } from "@souk/engine";
import { Card, colors, fonts } from "@souk/ui";
import { RAID_REVEAL_SUSPENSE_MS } from "../fx.js";

function name(names: Record<string, string>, id: string): string {
  return names[id] ?? "someone";
}

const OUTCOME_STYLE: Record<string, { label: string; bg: string; border: string; text: string }> = {
  success: { label: "SUCCESS", bg: colors.textileBg, border: colors.textile, text: colors.textileText },
  mutual_cancel: { label: "CANCELLED — mutual raid", bg: colors.secretBg, border: colors.secret, text: colors.secret },
  blocked_bodyguard: { label: "BLOCKED — Bodyguard", bg: colors.goldBg, border: colors.gold, text: colors.goldText },
  blocked_underwriter: { label: "BLOCKED — Underwriter", bg: colors.goldBg, border: colors.gold, text: colors.goldText },
};

export function RevealPanel({ view, names }: { view: GameStateView; names: Record<string, string> }) {
  const reveal = view.reveal;
  const [suspenseDone, setSuspenseDone] = useState(false);
  const shownForRound = useRef<number | null>(null);

  useEffect(() => {
    if (!reveal) return;
    if (shownForRound.current === view.round) return;
    shownForRound.current = view.round;
    setSuspenseDone(false);
    const timer = setTimeout(() => setSuspenseDone(true), RAID_REVEAL_SUSPENSE_MS);
    return () => clearTimeout(timer);
  }, [reveal, view.round]);

  if (!reveal) return null;

  const raids = reveal.raids.filter((r) => r.outcome !== "no_action");

  if (!suspenseDone) {
    return (
      <Card style={{ textAlign: "center" }}>
        <h3 style={{ fontFamily: fonts.headingLatin, fontSize: "1rem", marginBottom: "10px" }}>Reveal</h3>
        <div
          style={{
            padding: "22px",
            background: colors.nightVeil,
            borderRadius: "10px",
            animation: "souk-pulse-tile 900ms ease-in-out infinite",
          }}
        >
          <p style={{ color: colors.paper, margin: 0, fontFamily: fonts.headingLatin, letterSpacing: "0.05em" }}>
            The caravans converge…
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={{ fontFamily: fonts.headingLatin, fontSize: "1rem", marginBottom: "10px" }}>Reveal</h3>

      <h4 style={{ fontSize: "0.85rem", color: colors.inkSoft, marginBottom: "8px" }}>Raids</h4>
      {raids.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: colors.inkSoft, marginBottom: "12px" }}>No raids this round.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "8px" }}>
          {raids.map((r, i) => {
            const style = OUTCOME_STYLE[r.outcome] ?? {
              label: r.outcome,
              bg: colors.paper2,
              border: colors.line,
              text: colors.ink,
            };
            const stolen = Object.entries(r.stolen).filter(([, n]) => (n ?? 0) > 0);
            return (
              <div
                key={i}
                style={{
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  borderRadius: "10px",
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <p style={{ margin: 0, fontSize: "0.9rem" }}>
                    <strong>{name(names, r.attackerId)}</strong>
                    <span style={{ color: colors.inkSoft }}> raided </span>
                    <strong>{name(names, r.targetId)}</strong>
                  </p>
                  <span
                    style={{
                      fontFamily: fonts.headingLatin,
                      fontWeight: 700,
                      fontSize: "0.78rem",
                      color: style.text,
                    }}
                  >
                    {style.label}
                  </span>
                </div>
                {stolen.length > 0 && (
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                    {stolen.map(([res, n]) => (
                      <span
                        key={res}
                        style={{
                          fontSize: "0.75rem",
                          background: colors.card,
                          border: `1px solid ${style.border}`,
                          borderRadius: "999px",
                          padding: "2px 8px",
                        }}
                      >
                        took {n} {res}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reveal.whispers.length > 0 && (
        <>
          <h4 style={{ fontSize: "0.85rem", color: colors.inkSoft, margin: "12px 0 6px" }}>Whispers this round</h4>
          {reveal.whispers.map((w, i) => (
            <p key={i} style={{ fontSize: "0.8rem", color: colors.inkSoft, marginBottom: "4px" }}>
              {name(names, w.claimantId)} claimed {w.claimedCount} {w.resource} to {name(names, w.targetId)} —{" "}
              {w.outcome.replaceAll("_", " ")}
            </p>
          ))}
        </>
      )}
    </Card>
  );
}
