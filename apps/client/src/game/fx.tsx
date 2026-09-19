import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { RESOURCE_IDS } from "@souk/shared";
import type { GameStateView, WhisperResolution } from "@souk/engine";
import { colors, resourceColors, type Expression } from "@souk/ui";
import { useAnimationSpeedMultiplier } from "../settings/SettingsContext.js";
import { usePlaySound } from "../sound/useSound.js";

/**
 * Drives every coin/resource animation strictly off real view-to-view
 * diffs (never off a click handler) — an effect only plays once the
 * server has actually confirmed the change and broadcast the new state,
 * so the visual layer can never show a transfer the game state didn't
 * also make. A Bank trade specifically (bank + your resource count both
 * moved, opposite directions) gets a token that visibly flies between
 * the two anchored DOM nodes; every other coin/resource change (raid,
 * whisper, trade, reckoning, ...) still gets the floating +/- number.
 */

interface FxContextValue {
  registerAnchor: (key: string, el: HTMLElement | null) => void;
  expressions: Record<string, Expression>;
  roundTransition: number | null;
}

const FxContext = createContext<FxContextValue | null>(null);

export function useFxRegistrar(): (key: string, el: HTMLElement | null) => void {
  const ctx = useContext(FxContext);
  return ctx?.registerAnchor ?? (() => undefined);
}

/** The current real-event-driven expression for a player, or "idle" if nothing's happened recently. */
export function useFxExpression(playerId: string): Expression {
  const ctx = useContext(FxContext);
  return ctx?.expressions[playerId] ?? "idle";
}

/** The round number that just began, for the brief window its transition card should be shown — or null the rest of the time. */
export function useFxRoundTransition(): number | null {
  const ctx = useContext(FxContext);
  return ctx?.roundTransition ?? null;
}

interface FloatEffect {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface FlightEffect {
  id: string;
  fromRect: DOMRect;
  toRect: DOMRect;
  color: string;
}

interface BubbleEffect {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface ReactionEventLike {
  id: number;
  playerId: string;
  text: string;
}

export interface RaidRevealLike {
  round: number;
  raids: { attackerId: string; targetId: string; outcome: string }[];
}

const FLIGHT_MS = 550;
const FLOAT_MS = 1100;
const BUBBLE_MS = 2000;
/** How long RevealPanel holds its own suspense card before showing outcomes — raid loot flights wait the same beat so they land in sync with the reveal, not before it. */
export const RAID_REVEAL_SUSPENSE_MS = 800;
/** How long WhisperPanel holds its own suspense card before a Verify's outcome — shared here so expressions land in sync with that reveal too. */
export const WHISPER_REVEAL_SUSPENSE_MS = 700;
const EXPRESSION_MS = 1700;
/** How long RoundTransitionCard stays up after a real round change lands. */
export const ROUND_TRANSITION_MS = 2400;
/** No further real event can supersede a Victory-screen expression, so it's held far longer than a mid-game reaction — effectively for the rest of the session. */
const VICTORY_EXPRESSION_MS = 3_600_000;

export function FxProvider({
  view,
  reaction,
  raidReveal,
  children,
}: {
  view: GameStateView | null;
  /** Latest quick-reaction event, keyed by an ever-increasing id so repeats of the same reaction still trigger. */
  reaction?: ReactionEventLike | null;
  /** This round's raid outcomes, keyed by round so a re-render doesn't replay it. */
  raidReveal?: RaidRevealLike | null;
  children: ReactNode;
}) {
  const anchors = useRef(new Map<string, HTMLElement>());
  const prevViewRef = useRef<GameStateView | null>(null);
  const lastReactionIdRef = useRef<number | null>(null);
  const lastRaidRevealRoundRef = useRef<number | null>(null);
  const lastWhisperCountRef = useRef(0);
  const lastWhisperRoundRef = useRef<number | null>(null);
  const lastRoundRef = useRef<number | null>(null);
  const roundTransitionToken = useRef(0);
  const finalTallyReactedRef = useRef(false);
  const expressionTokens = useRef(new Map<string, number>());
  const [floats, setFloats] = useState<FloatEffect[]>([]);
  const [flights, setFlights] = useState<FlightEffect[]>([]);
  const [bubbles, setBubbles] = useState<BubbleEffect[]>([]);
  const [expressions, setExpressions] = useState<Record<string, Expression>>({});
  const [roundTransition, setRoundTransition] = useState<number | null>(null);

  const speed = useAnimationSpeedMultiplier();
  const playSound = usePlaySound();
  const floatMs = FLOAT_MS * speed;
  const flightMs = FLIGHT_MS * speed;
  const bubbleMs = BUBBLE_MS * speed;
  const raidRevealSuspenseMs = RAID_REVEAL_SUSPENSE_MS * speed;
  const whisperRevealSuspenseMs = WHISPER_REVEAL_SUSPENSE_MS * speed;
  const roundTransitionMs = ROUND_TRANSITION_MS * speed;

  const setExpression = useCallback(
    (playerId: string, expr: Expression, durationMs = EXPRESSION_MS * speed) => {
      const token = (expressionTokens.current.get(playerId) ?? 0) + 1;
      expressionTokens.current.set(playerId, token);
      setExpressions((e) => ({ ...e, [playerId]: expr }));
      setTimeout(() => {
        // Only revert to idle if nothing newer has claimed this player's expression since.
        if (expressionTokens.current.get(playerId) === token) {
          setExpressions((e) => ({ ...e, [playerId]: "idle" }));
        }
      }, durationMs);
    },
    [speed],
  );

  const registerAnchor = useCallback((key: string, el: HTMLElement | null) => {
    if (el) anchors.current.set(key, el);
    else anchors.current.delete(key);
  }, []);

  const spawnFloat = useCallback(
    (key: string, delta: number, color: string) => {
      if (delta === 0) return;
      const el = anchors.current.get(key);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const id = `${key}-${Date.now()}-${Math.random()}`;
      setFloats((f) => [
        ...f,
        { id, x: rect.left + rect.width / 2, y: rect.top, text: `${delta > 0 ? "+" : ""}${delta}`, color },
      ]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), floatMs);
      el.style.animation = "none";
      // Force reflow so re-adding the same animation restarts it on rapid repeats.
      void el.offsetWidth;
      el.style.animation = `souk-pulse-tile ${400 * speed}ms ease-out`;
    },
    [floatMs, speed],
  );

  const spawnFlight = useCallback(
    (fromKey: string, toKey: string, color: string) => {
      const fromEl = anchors.current.get(fromKey);
      const toEl = anchors.current.get(toKey);
      if (!fromEl || !toEl) return;
      const id = `${fromKey}->${toKey}-${Date.now()}-${Math.random()}`;
      setFlights((fl) => [
        ...fl,
        { id, fromRect: fromEl.getBoundingClientRect(), toRect: toEl.getBoundingClientRect(), color },
      ]);
      setTimeout(() => setFlights((fl) => fl.filter((x) => x.id !== id)), flightMs + 100);
    },
    [flightMs],
  );

  useEffect(() => {
    const prev = prevViewRef.current;
    prevViewRef.current = view;
    if (!prev || !view) return;

    for (const r of RESOURCE_IDS) {
      const bankDelta = view.bank.resources[r] - prev.bank.resources[r];
      const yourDelta = view.you.resources[r] - prev.you.resources[r];
      if (yourDelta !== 0) {
        spawnFloat(`you:resource:${r}`, yourDelta, resourceColors[r]);
        // Opposite-signed bank movement in the same tick means this was a
        // Bank trade you made — fly the token between the two real anchors.
        if (bankDelta === -yourDelta) {
          if (yourDelta > 0) spawnFlight(`bank:${r}`, `you:resource:${r}`, resourceColors[r]);
          else spawnFlight(`you:resource:${r}`, `bank:${r}`, resourceColors[r]);
        }
      }
    }

    const coinDelta = view.you.coins - prev.you.coins;
    spawnFloat("you:coins", coinDelta, coinDelta > 0 ? colors.lantern : "#F2846B");
    if (coinDelta > 0) {
      setExpression(view.you.id, "happy");
      playSound("coinGain");
    } else if (coinDelta < 0) {
      setExpression(view.you.id, "sad");
      playSound("coinLoss");
    }
  }, [view, spawnFloat, spawnFlight, setExpression, playSound]);

  useEffect(() => {
    if (!reaction || reaction.id === lastReactionIdRef.current) return;
    lastReactionIdRef.current = reaction.id;

    const el = anchors.current.get(`portrait:${reaction.playerId}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const id = `reaction-${reaction.id}`;
    setBubbles((b) => [...b, { id, x: rect.left + rect.width / 2, y: rect.top, text: reaction.text }]);
    setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), bubbleMs);
    playSound("reaction");
  }, [reaction, bubbleMs, playSound]);

  useEffect(() => {
    if (!raidReveal || raidReveal.round === lastRaidRevealRoundRef.current) return;
    lastRaidRevealRoundRef.current = raidReveal.round;

    // Wait out the same suspense beat RevealPanel holds, so the loot (and
    // the reactions) visibly land right as the outcome text appears.
    const timer = setTimeout(() => {
      for (const raid of raidReveal.raids) {
        if (raid.outcome === "success") {
          spawnFlight(`portrait:${raid.targetId}`, `portrait:${raid.attackerId}`, colors.brass);
          setExpression(raid.attackerId, "confident");
          setExpression(raid.targetId, "angry");
          playSound("raidSuccess");
        } else if (raid.outcome === "blocked_bodyguard" || raid.outcome === "blocked_underwriter") {
          setExpression(raid.targetId, "confident");
          setExpression(raid.attackerId, "sad");
          playSound("raidBlocked");
        } else if (raid.outcome === "mutual_cancel") {
          setExpression(raid.attackerId, "surprised");
          setExpression(raid.targetId, "surprised");
          playSound("raidCancel");
        }
      }
    }, raidRevealSuspenseMs);
    return () => clearTimeout(timer);
  }, [raidReveal, spawnFlight, setExpression, playSound, raidRevealSuspenseMs]);

  useEffect(() => {
    if (!view) return;
    if (lastWhisperRoundRef.current !== view.round) {
      lastWhisperRoundRef.current = view.round;
      lastWhisperCountRef.current = 0;
    }
    const resolutions = view.whisper.resolutions;
    if (resolutions.length <= lastWhisperCountRef.current) return;
    const newResolutions = resolutions.slice(lastWhisperCountRef.current);
    lastWhisperCountRef.current = resolutions.length;

    const react = (r: WhisperResolution) => {
      if (r.outcome === "verified_false") {
        setExpression(r.claimantId, "shocked"); // caught lying
        setExpression(r.targetId, "confident"); // verifier's suspicion paid off
        playSound("whisperCaught");
      } else if (r.outcome === "verified_true") {
        setExpression(r.claimantId, "confident"); // vindicated
        setExpression(r.targetId, "sad"); // doubted an honest player, and it cost them (spec §8)
        playSound("whisperVerified");
      } else if (r.outcome === "bribe_accepted") {
        setExpression(r.claimantId, "confident");
        setExpression(r.targetId, "happy"); // took the coin
        playSound("bribeAccepted");
      }
    };

    // Verify outcomes go through WhisperPanel's own suspense card first —
    // land the reaction exactly when that reveal does. Trust/bribe
    // resolutions have no suspense in the UI, so react immediately.
    const verifyOutcomes = newResolutions.filter(
      (r) => r.outcome === "verified_true" || r.outcome === "verified_false",
    );
    const instantOutcomes = newResolutions.filter((r) => r.outcome === "bribe_accepted");
    instantOutcomes.forEach(react);
    if (verifyOutcomes.length === 0) return;
    const timer = setTimeout(() => verifyOutcomes.forEach(react), whisperRevealSuspenseMs);
    return () => clearTimeout(timer);
  }, [view, setExpression, playSound, whisperRevealSuspenseMs]);

  // A real round change (view.round incrementing) — never fired on first
  // mount/reconnect, only on a genuine reveal->market transition the
  // server actually broadcast. Also the moment the Reckoning's real
  // beneficiary gets a reaction, since that event otherwise has no
  // character presence anywhere in the UI.
  useEffect(() => {
    if (!view) return;
    if (lastRoundRef.current === null) {
      lastRoundRef.current = view.round;
      return;
    }
    if (view.round === lastRoundRef.current) return;
    lastRoundRef.current = view.round;

    const token = ++roundTransitionToken.current;
    setRoundTransition(view.round);
    setTimeout(() => {
      if (roundTransitionToken.current === token) setRoundTransition(null);
    }, roundTransitionMs);
    playSound("roundBegin");

    if (view.reckoning && view.reckoning.round === view.round - 1) {
      setExpression(view.reckoning.lowestWealthPlayerId, "happy");
      playSound("reckoning");
    }
  }, [view, setExpression, playSound, roundTransitionMs]);

  // The game just ended — react once, ranking every player by the real
  // final tally the server computed (never a client-side guess).
  useEffect(() => {
    if (!view?.finalTally || finalTallyReactedRef.current) return;
    finalTallyReactedRef.current = true;
    const tally = view.finalTally;
    const winners = new Set(tally.winnerIds);
    const ranked = [...view.players].sort(
      (a, b) => (tally.wealthByPlayer[b.id] ?? 0) - (tally.wealthByPlayer[a.id] ?? 0),
    );
    ranked.forEach((p, i) => {
      if (winners.has(p.id)) setExpression(p.id, "victory", VICTORY_EXPRESSION_MS);
      else if (i === ranked.length - 1) setExpression(p.id, "sad", VICTORY_EXPRESSION_MS);
      else setExpression(p.id, "thinking", VICTORY_EXPRESSION_MS);
    });
    playSound("victory");
  }, [view, setExpression, playSound]);

  return (
    <FxContext.Provider value={{ registerAnchor, expressions, roundTransition }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <FxOverlay floats={floats} flights={flights} bubbles={bubbles} floatMs={floatMs} flightMs={flightMs} bubbleMs={bubbleMs} />,
          document.body,
        )}
    </FxContext.Provider>
  );
}

function FxOverlay({
  floats,
  flights,
  bubbles,
  floatMs,
  flightMs,
  bubbleMs,
}: {
  floats: FloatEffect[];
  flights: FlightEffect[];
  bubbles: BubbleEffect[];
  floatMs: number;
  flightMs: number;
  bubbleMs: number;
}) {
  return (
    <>
      {floats.map((f) => (
        <div
          key={f.id}
          style={{
            position: "fixed",
            left: f.x,
            top: f.y,
            transform: "translate(-50%, -100%)",
            color: f.color,
            fontWeight: 700,
            fontSize: "1rem",
            textShadow: "0 1px 3px rgba(0,0,0,0.7)",
            animation: `souk-float-up ${floatMs}ms ease-out forwards`,
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          {f.text}
        </div>
      ))}
      {flights.map((fl) => (
        <FlightToken key={fl.id} {...fl} flightMs={flightMs} />
      ))}
      {bubbles.map((b) => (
        <div
          key={b.id}
          style={{
            position: "fixed",
            left: b.x,
            top: b.y - 14,
            transform: "translate(-50%, -100%)",
            background: colors.card,
            color: colors.ink,
            border: `1px solid ${colors.brass}`,
            borderRadius: "12px",
            padding: "4px 10px",
            fontSize: "0.95rem",
            fontWeight: 600,
            boxShadow: "0 3px 10px rgba(0,0,0,0.4)",
            animation: `souk-bubble-pop ${bubbleMs}ms ease-out forwards`,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 9999,
          }}
        >
          {b.text}
        </div>
      ))}
    </>
  );
}

function FlightToken({ fromRect, toRect, color, flightMs }: FlightEffect & { flightMs: number }) {
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMoved(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const size = 22;
  const startX = fromRect.left + fromRect.width / 2 - size / 2;
  const startY = fromRect.top + fromRect.height / 2 - size / 2;
  const endX = toRect.left + toRect.width / 2 - size / 2;
  const endY = toRect.top + toRect.height / 2 - size / 2;

  return (
    <div
      style={{
        position: "fixed",
        left: moved ? endX : startX,
        top: moved ? endY : startY,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: "0 2px 10px rgba(0,0,0,0.55)",
        transition: `left ${flightMs}ms cubic-bezier(.3,.6,.3,1), top ${flightMs}ms cubic-bezier(.3,.6,.3,1), opacity ${flightMs}ms ease`,
        opacity: moved ? 0.1 : 1,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
