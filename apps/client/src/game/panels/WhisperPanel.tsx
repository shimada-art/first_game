import { useEffect, useRef, useState, type ReactNode } from "react";
import { RESOURCE_IDS, type ResourceId } from "@souk/shared";
import type { EngineAction, GameStateView, WhisperResolution } from "@souk/engine";
import { Button, Card, colors, fonts } from "@souk/ui";
import { QuickReactions } from "../QuickReactions.js";
import { WHISPER_REVEAL_SUSPENSE_MS as REVEAL_SUSPENSE_MS_BASE } from "../fx.js";
import { useAnimationSpeedMultiplier } from "../../settings/SettingsContext.js";

function name(names: Record<string, string>, id: string): string {
  return names[id] ?? "someone";
}

export function WhisperPanel({
  view,
  sendAction,
  sendReaction,
  names,
}: {
  view: GameStateView;
  sendAction: (action: EngineAction) => void;
  sendReaction: Parameters<typeof QuickReactions>[0]["onSend"];
  names: Record<string, string>;
}) {
  const others = view.players.filter((p) => p.id !== view.you.id);
  const [targetId, setTargetId] = useState(others[0]?.id ?? "");
  const [resource, setResource] = useState<ResourceId>("spice");
  const [count, setCount] = useState(0);
  const [bribeAmount, setBribeAmount] = useState(0);

  const pending = view.whisper.pending;
  const youId = view.you.id;

  // Verify has a real resolution the instant the server broadcasts it — this
  // just delays *displaying* that already-decided outcome for a beat, so the
  // reveal reads as a moment rather than a number silently updating. Tracked
  // by index, not object reference: every WS message re-parses the view from
  // JSON, so no resolution object is ever the same reference twice, but the
  // array only ever grows within a round, so its position is stable.
  const [revealing, setRevealing] = useState<{ index: number; done: boolean } | null>(null);
  const prevResolutionCount = useRef(view.whisper.resolutions.length);
  const speed = useAnimationSpeedMultiplier();
  const revealSuspenseMs = REVEAL_SUSPENSE_MS_BASE * speed;

  useEffect(() => {
    const resolutions = view.whisper.resolutions;
    if (resolutions.length > prevResolutionCount.current) {
      const latestIndex = resolutions.length - 1;
      const latest = resolutions[latestIndex]!;
      if (latest.outcome === "verified_true" || latest.outcome === "verified_false") {
        setRevealing({ index: latestIndex, done: false });
        const timer = setTimeout(() => {
          setRevealing((s) => (s ? { ...s, done: true } : s));
        }, revealSuspenseMs);
        prevResolutionCount.current = resolutions.length;
        return () => clearTimeout(timer);
      }
    }
    prevResolutionCount.current = resolutions.length;
    return undefined;
  }, [view.whisper.resolutions, revealSuspenseMs]);

  const revealingResolution = revealing ? view.whisper.resolutions[revealing.index] : undefined;
  const inSuspense = revealing !== null && !revealing.done;
  const loggedResolutions = view.whisper.resolutions.filter((_, i) => i !== revealing?.index);

  return (
    <Card>
      <h3 style={{ fontFamily: fonts.headingLatin, fontSize: "1rem", marginBottom: "10px" }}>Whisper</h3>

      {inSuspense && revealingResolution && (
        <VerifySuspenseCard resolution={revealingResolution} names={names} />
      )}

      {revealing?.done && revealingResolution && (
        <VerifyRevealBanner resolution={revealingResolution} names={names} />
      )}

      {!pending && !inSuspense && (
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

      {pending?.stage === "awaitingResponse" && !inSuspense && (
        <ClaimCallout claim={pending.claim} names={names}>
          {pending.claim.targetId === youId ? (
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <Button onClick={() => sendAction({ kind: "WHISPER_TRUST" })}>Trust</Button>
              <Button variant="secondary" onClick={() => sendAction({ kind: "WHISPER_VERIFY" })}>
                Verify (costs a coin)
              </Button>
            </div>
          ) : (
            <p style={{ color: colors.inkSoft, fontSize: "0.85rem", marginTop: "8px" }}>
              Waiting on {name(names, pending.claim.targetId)}'s response…
            </p>
          )}
        </ClaimCallout>
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

      <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: `1px solid ${colors.line}` }}>
        <QuickReactions onSend={sendReaction} />
      </div>

      {loggedResolutions.length > 0 && (
        <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: `1px solid ${colors.line}` }}>
          <h4 style={{ fontSize: "0.85rem", color: colors.inkSoft, marginBottom: "6px" }}>This round</h4>
          {loggedResolutions.map((r, i) => (
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

function ClaimCallout({
  claim,
  names,
  children,
}: {
  claim: { claimantId: string; targetId: string; resource: ResourceId; count: number };
  names: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: colors.secretBg,
        border: `1px solid ${colors.secret}`,
        borderRadius: "10px",
        padding: "12px 14px",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.95rem" }}>
        <strong>{name(names, claim.claimantId)}</strong>
        <span style={{ color: colors.secret }}> to {name(names, claim.targetId)}: </span>
        "I have <strong>{claim.count}</strong> {claim.resource}."
      </p>
      {children}
    </div>
  );
}

function VerifySuspenseCard({
  resolution,
  names,
}: {
  resolution: WhisperResolution;
  names: Record<string, string>;
}) {
  const speed = useAnimationSpeedMultiplier();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        padding: "18px",
        marginBottom: "12px",
        background: colors.nightVeil,
        borderRadius: "10px",
      }}
    >
      <div
        style={{
          width: 52,
          height: 68,
          borderRadius: "6px",
          background: `linear-gradient(155deg, ${colors.brass}, ${colors.brassDim})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.nightVeil,
          fontFamily: fonts.headingLatin,
          fontWeight: 700,
          fontSize: "1.3rem",
          animation: `souk-card-flip ${700 * speed}ms ease-in-out infinite alternate`,
        }}
      >
        ?
      </div>
      <p style={{ color: colors.paper, fontSize: "0.95rem", margin: 0 }}>
        Verifying {name(names, resolution.claimantId)}'s claim of {resolution.claimedCount}{" "}
        {resolution.resource}…
      </p>
    </div>
  );
}

function VerifyRevealBanner({
  resolution,
  names,
}: {
  resolution: WhisperResolution;
  names: Record<string, string>;
}) {
  const isTrue = resolution.outcome === "verified_true";
  return (
    <div
      style={{
        padding: "12px 16px",
        marginBottom: "12px",
        borderRadius: "10px",
        background: isTrue ? colors.gemBg : colors.textileBg,
        border: `1px solid ${isTrue ? colors.gem : colors.textile}`,
        textAlign: "center",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: fonts.headingLatin,
          fontWeight: 700,
          fontSize: "1.1rem",
          color: isTrue ? colors.gemText : colors.textileText,
        }}
      >
        {isTrue ? "TRUE!" : "LIE CAUGHT!"}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: colors.inkSoft }}>
        {name(names, resolution.claimantId)} actually had {resolution.actualCount} {resolution.resource} —
        claimed {resolution.claimedCount}.
      </p>
    </div>
  );
}
