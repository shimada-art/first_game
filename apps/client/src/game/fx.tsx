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
import type { GameStateView } from "@souk/engine";
import { colors, resourceColors } from "@souk/ui";

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
}

const FxContext = createContext<FxContextValue | null>(null);

export function useFxRegistrar(): (key: string, el: HTMLElement | null) => void {
  const ctx = useContext(FxContext);
  return ctx?.registerAnchor ?? (() => undefined);
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
  const [floats, setFloats] = useState<FloatEffect[]>([]);
  const [flights, setFlights] = useState<FlightEffect[]>([]);
  const [bubbles, setBubbles] = useState<BubbleEffect[]>([]);

  const registerAnchor = useCallback((key: string, el: HTMLElement | null) => {
    if (el) anchors.current.set(key, el);
    else anchors.current.delete(key);
  }, []);

  const spawnFloat = useCallback((key: string, delta: number, color: string) => {
    if (delta === 0) return;
    const el = anchors.current.get(key);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const id = `${key}-${Date.now()}-${Math.random()}`;
    setFloats((f) => [
      ...f,
      { id, x: rect.left + rect.width / 2, y: rect.top, text: `${delta > 0 ? "+" : ""}${delta}`, color },
    ]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), FLOAT_MS);
    el.style.animation = "none";
    // Force reflow so re-adding the same animation restarts it on rapid repeats.
    void el.offsetWidth;
    el.style.animation = "souk-pulse-tile 400ms ease-out";
  }, []);

  const spawnFlight = useCallback((fromKey: string, toKey: string, color: string) => {
    const fromEl = anchors.current.get(fromKey);
    const toEl = anchors.current.get(toKey);
    if (!fromEl || !toEl) return;
    const id = `${fromKey}->${toKey}-${Date.now()}-${Math.random()}`;
    setFlights((fl) => [
      ...fl,
      { id, fromRect: fromEl.getBoundingClientRect(), toRect: toEl.getBoundingClientRect(), color },
    ]);
    setTimeout(() => setFlights((fl) => fl.filter((x) => x.id !== id)), FLIGHT_MS + 100);
  }, []);

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
  }, [view, spawnFloat, spawnFlight]);

  useEffect(() => {
    if (!reaction || reaction.id === lastReactionIdRef.current) return;
    lastReactionIdRef.current = reaction.id;

    const el = anchors.current.get(`portrait:${reaction.playerId}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const id = `reaction-${reaction.id}`;
    setBubbles((b) => [...b, { id, x: rect.left + rect.width / 2, y: rect.top, text: reaction.text }]);
    setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), BUBBLE_MS);
  }, [reaction]);

  useEffect(() => {
    if (!raidReveal || raidReveal.round === lastRaidRevealRoundRef.current) return;
    lastRaidRevealRoundRef.current = raidReveal.round;

    // Wait out the same suspense beat RevealPanel holds, so the loot
    // visibly "lands" right as the outcome text appears, not before it.
    const timer = setTimeout(() => {
      for (const raid of raidReveal.raids) {
        if (raid.outcome === "success") {
          spawnFlight(`portrait:${raid.targetId}`, `portrait:${raid.attackerId}`, colors.brass);
        }
      }
    }, RAID_REVEAL_SUSPENSE_MS);
    return () => clearTimeout(timer);
  }, [raidReveal, spawnFlight]);

  return (
    <FxContext.Provider value={{ registerAnchor }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(<FxOverlay floats={floats} flights={flights} bubbles={bubbles} />, document.body)}
    </FxContext.Provider>
  );
}

function FxOverlay({
  floats,
  flights,
  bubbles,
}: {
  floats: FloatEffect[];
  flights: FlightEffect[];
  bubbles: BubbleEffect[];
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
            animation: `souk-float-up ${FLOAT_MS}ms ease-out forwards`,
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          {f.text}
        </div>
      ))}
      {flights.map((fl) => (
        <FlightToken key={fl.id} {...fl} />
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
            animation: `souk-bubble-pop ${BUBBLE_MS}ms ease-out forwards`,
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

function FlightToken({ fromRect, toRect, color }: FlightEffect) {
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
        transition: `left ${FLIGHT_MS}ms cubic-bezier(.3,.6,.3,1), top ${FLIGHT_MS}ms cubic-bezier(.3,.6,.3,1), opacity ${FLIGHT_MS}ms ease`,
        opacity: moved ? 0.1 : 1,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
