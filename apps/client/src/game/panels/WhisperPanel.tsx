import { useState } from "react";
import { RESOURCE_IDS, type ResourceId } from "@souk/shared";
import type { EngineAction, GameStateView } from "@souk/engine";
import { Button, Card, colors, fonts } from "@souk/ui";

function name(names: Record<string, string>, id: string): string {
  return names[id] ?? "someone";
}

export function WhisperPanel({
  view,
  sendAction,
  names,
}: {
  view: GameStateView;
  sendAction: (action: EngineAction) => void;
  names: Record<string, string>;
}) {
  const others = view.players.filter((p) => p.id !== view.you.id);
  const [targetId, setTargetId] = useState(others[0]?.id ?? "");
  const [resource, setResource] = useState<ResourceId>("spice");
  const [count, setCount] = useState(0);
  const [bribeAmount, setBribeAmount] = useState(0);

  const pending = view.whisper.pending;
  const youId = view.you.id;

  return (
    <Card>
      <h3 style={{ fontFamily: fonts.headingLatin, fontSize: "1rem", marginBottom: "10px" }}>Whisper</h3>

      {!pending && (
        <>
          <p style={{ color: colors.inkSoft, fontSize: "0.85rem", marginBottom: "10px" }}>
            Make a specific, checkable claim about your own holdings — publicly, for everyone to see.
          </p>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ fontSize: "0.85rem" }}>
              To:{" "}
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {names[p.id] ?? p.id}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: "0.85rem" }}>
              I have
              <input
                type="number"
                min={0}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 0)}
                style={{ width: "48px", marginLeft: "6px", marginRight: "6px" }}
              />
              <select value={resource} onChange={(e) => setResource(e.target.value as ResourceId)}>
                {RESOURCE_IDS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <Button
              onClick={() => sendAction({ kind: "WHISPER_CLAIM", targetId, resource, count })}
              disabled={!targetId}
              style={{ padding: "6px 14px", fontSize: "0.85rem" }}
            >
              Send claim
            </Button>
          </div>
        </>
      )}

      {pending?.stage === "awaitingResponse" && pending.claim.targetId === youId && (
        <div>
          <p style={{ marginBottom: "10px" }}>
            <strong>{name(names, pending.claim.claimantId)}</strong> claims to have {pending.claim.count}{" "}
            {pending.claim.resource}. Do you trust them?
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button onClick={() => sendAction({ kind: "WHISPER_TRUST" })}>Trust</Button>
            <Button variant="secondary" onClick={() => sendAction({ kind: "WHISPER_VERIFY" })}>
              Verify (costs a coin)
            </Button>
          </div>
        </div>
      )}
      {pending?.stage === "awaitingResponse" && pending.claim.targetId !== youId && (
        <p style={{ color: colors.inkSoft }}>
          {name(names, pending.claim.claimantId)} claims {pending.claim.count} {pending.claim.resource} to{" "}
          {name(names, pending.claim.targetId)} — waiting on their response.
        </p>
      )}

      {pending?.stage === "awaitingBribeOffer" && pending.claim.claimantId === youId && (
        <div>
          <p style={{ marginBottom: "10px" }}>
            {name(names, pending.claim.targetId)} wants to Verify your claim. Offer a bribe to make them drop it?
          </p>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="number"
              min={0}
              value={bribeAmount}
              onChange={(e) => setBribeAmount(Number(e.target.value) || 0)}
              style={{ width: "60px" }}
            />
            <Button onClick={() => sendAction({ kind: "WHISPER_BRIBE_OFFER", amount: bribeAmount })}>
              {bribeAmount === 0 ? "Let them verify" : `Offer ${bribeAmount} coins`}
            </Button>
          </div>
        </div>
      )}
      {pending?.stage === "awaitingBribeOffer" && pending.claim.claimantId !== youId && (
        <p style={{ color: colors.inkSoft }}>{name(names, pending.claim.claimantId)} is deciding whether to bribe you…</p>
      )}

      {pending?.stage === "awaitingBribeResponse" && pending.claim.targetId === youId && (
        <div>
          <p style={{ marginBottom: "10px" }}>
            {name(names, pending.claim.claimantId)} offers you {pending.bribeAmount} coins to drop your Verify.
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button onClick={() => sendAction({ kind: "WHISPER_BRIBE_RESPOND", accept: true })}>Accept bribe</Button>
            <Button variant="secondary" onClick={() => sendAction({ kind: "WHISPER_BRIBE_RESPOND", accept: false })}>
              Decline — Verify anyway
            </Button>
          </div>
        </div>
      )}
      {pending?.stage === "awaitingBribeResponse" && pending.claim.targetId !== youId && (
        <p style={{ color: colors.inkSoft }}>A bribe has been offered — waiting on their decision…</p>
      )}

      {view.whisper.resolutions.length > 0 && (
        <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: `1px solid ${colors.line}` }}>
          <h4 style={{ fontSize: "0.85rem", color: colors.inkSoft, marginBottom: "6px" }}>This round</h4>
          {view.whisper.resolutions.map((r, i) => (
            <p key={i} style={{ fontSize: "0.8rem", color: colors.inkSoft }}>
              {name(names, r.claimantId)} → {name(names, r.targetId)}: {r.claimedCount} {r.resource} —{" "}
              {r.outcome.replaceAll("_", " ")}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
