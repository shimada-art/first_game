import type { GameStateView } from "@souk/engine";
import { Card, colors, fonts } from "@souk/ui";

function name(names: Record<string, string>, id: string): string {
  return names[id] ?? "someone";
}

const RAID_OUTCOME_LABEL: Record<string, string> = {
  no_action: "sat out",
  mutual_cancel: "raided each other — cancelled",
  blocked_bodyguard: "blocked by a Bodyguard",
  blocked_underwriter: "blocked by an Underwriter",
  success: "succeeded",
};

export function RevealPanel({ view, names }: { view: GameStateView; names: Record<string, string> }) {
  const reveal = view.reveal;
  if (!reveal) return null;

  return (
    <Card>
      <h3 style={{ fontFamily: fonts.headingLatin, fontSize: "1rem", marginBottom: "10px" }}>Reveal</h3>

      <h4 style={{ fontSize: "0.85rem", color: colors.inkSoft, marginBottom: "6px" }}>Raids</h4>
      {reveal.raids.every((r) => r.outcome === "no_action") ? (
        <p style={{ fontSize: "0.85rem", color: colors.inkSoft, marginBottom: "12px" }}>No raids this round.</p>
      ) : (
        reveal.raids
          .filter((r) => r.outcome !== "no_action")
          .map((r, i) => {
            const stolen = Object.entries(r.stolen)
              .map(([res, n]) => `${n} ${res}`)
              .join(", ");
            return (
              <p key={i} style={{ fontSize: "0.85rem", marginBottom: "4px" }}>
                {name(names, r.attackerId)} → {name(names, r.targetId)}: {RAID_OUTCOME_LABEL[r.outcome]}
                {stolen && ` — took ${stolen}`}
              </p>
            );
          })
      )}

      {reveal.whispers.length > 0 && (
        <>
          <h4 style={{ fontSize: "0.85rem", color: colors.inkSoft, margin: "12px 0 6px" }}>Whispers</h4>
          {reveal.whispers.map((w, i) => (
            <p key={i} style={{ fontSize: "0.85rem", marginBottom: "4px" }}>
              {name(names, w.claimantId)} claimed {w.claimedCount} {w.resource} to {name(names, w.targetId)} —{" "}
              {w.outcome.replaceAll("_", " ")}
            </p>
          ))}
        </>
      )}
    </Card>
  );
}
