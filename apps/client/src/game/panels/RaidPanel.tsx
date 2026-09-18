import { useState } from "react";
import type { EngineAction, GameStateView } from "@souk/engine";
import { Button, Card, colors, fonts } from "@souk/ui";

export function RaidPanel({
  view,
  sendAction,
  names,
}: {
  view: GameStateView;
  sendAction: (action: EngineAction) => void;
  names: Record<string, string>;
}) {
  const others = view.players.filter((p) => p.id !== view.you.id);
  const [targetId, setTargetId] = useState<string>(others[0]?.id ?? "");
  const [tokens, setTokens] = useState(0);

  const cap =
    view.round === view.config.finalBazaarRound
      ? view.config.raidTokenCapFinalBazaar
      : view.config.raidTokenCapStandard;

  const alreadyCommitted = view.raid.yourCommitment !== null;

  return (
    <Card>
      <h3 style={{ fontFamily: fonts.headingLatin, fontSize: "1rem", marginBottom: "10px" }}>
        Caravan Raid — secret
      </h3>

      {alreadyCommitted ? (
        <p style={{ color: colors.gem, fontSize: "0.9rem" }}>
          Your raid is locked in for this round. Waiting on the others…
        </p>
      ) : (
        <>
          <p style={{ color: colors.inkSoft, fontSize: "0.85rem", marginBottom: "12px" }}>
            Choose a target and up to {cap} tokens. Nobody else can see your choice until Reveal.
          </p>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "14px" }}>
            <label style={{ fontSize: "0.85rem" }}>
              Target:{" "}
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {names[p.id] ?? p.id}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Button
                variant="secondary"
                onClick={() => setTokens((t) => Math.max(0, t - 1))}
                style={{ padding: "2px 10px" }}
              >
                −
              </Button>
              <span style={{ fontFamily: fonts.headingLatin, minWidth: "2ch", textAlign: "center" }}>{tokens}</span>
              <Button
                variant="secondary"
                onClick={() => setTokens((t) => Math.min(cap, t + 1))}
                style={{ padding: "2px 10px" }}
              >
                +
              </Button>
              <span style={{ color: colors.inkSoft, fontSize: "0.8rem" }}>tokens</span>
            </div>
          </div>

          <Button
            onClick={() =>
              sendAction({
                kind: "RAID_COMMIT",
                targetId: tokens > 0 ? targetId : null,
                tokens,
              })
            }
          >
            {tokens === 0 ? "Sit this raid out" : `Commit raid on ${names[targetId] ?? "target"}`}
          </Button>
        </>
      )}

      <p style={{ color: colors.inkSoft, fontSize: "0.8rem", marginTop: "14px" }}>
        Committed so far: {view.raid.committedPlayerIds.length}/{view.players.length}
      </p>
    </Card>
  );
}
