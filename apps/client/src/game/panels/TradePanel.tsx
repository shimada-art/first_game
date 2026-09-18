import { useState } from "react";
import { RESOURCE_IDS } from "@souk/shared";
import type { EngineAction, GameStateView } from "@souk/engine";
import { Button, Card, colors, fonts, resourceColors } from "@souk/ui";
import { BundleEditor, describeBundle, emptyBundle, type Bundle } from "../BundleEditor.js";
import { useFxRegistrar } from "../fx.js";

const RESOURCE_LABEL = { spice: "Spice", textile: "Textile", gold: "Gold", gem: "Gem" } as const;

export function TradePanel({
  view,
  sendAction,
  names,
}: {
  view: GameStateView;
  sendAction: (action: EngineAction) => void;
  names: Record<string, string>;
}) {
  const [proposeOpen, setProposeOpen] = useState(false);
  const [targetId, setTargetId] = useState<string>(view.players.find((p) => p.id !== view.you.id)?.id ?? "");
  const [offer, setOffer] = useState<Bundle>(emptyBundle());
  const [request, setRequest] = useState<Bundle>(emptyBundle());
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const registerAnchor = useFxRegistrar();

  const bankOpen = view.currentEvent !== "bankHoliday" && view.round !== view.config.finalBazaarRound;
  const others = view.players.filter((p) => p.id !== view.you.id);

  function submitPropose() {
    sendAction({ kind: "TRADE_PROPOSE", toPlayerId: targetId, offer, request });
    setProposeOpen(false);
    setOffer(emptyBundle());
    setRequest(emptyBundle());
  }

  function submitCounter(proposalId: string) {
    sendAction({ kind: "TRADE_COUNTER", proposalId, offer, request });
    setCounteringId(null);
    setOffer(emptyBundle());
    setRequest(emptyBundle());
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <Card>
        <h3 style={{ fontFamily: fonts.headingLatin, fontSize: "1rem", marginBottom: "10px" }}>Bank</h3>
        {!bankOpen && (
          <p style={{ color: colors.inkSoft, fontSize: "0.85rem", marginBottom: "10px" }}>
            The Bank is closed this round.
          </p>
        )}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {RESOURCE_IDS.map((r) => (
            <div
              key={r}
              ref={(el) => registerAnchor(`bank:${r}`, el)}
              style={{
                border: `1px solid ${resourceColors[r]}`,
                borderRadius: "8px",
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                minWidth: "84px",
              }}
            >
              <span style={{ fontSize: "0.8rem" }}>
                {RESOURCE_LABEL[r]} · {view.prices[r]}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <Button
                  variant="secondary"
                  disabled={!bankOpen}
                  onClick={() => sendAction({ kind: "BANK_TRADE", resource: r, direction: "buy" })}
                  style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                >
                  Buy
                </Button>
                <Button
                  variant="secondary"
                  disabled={!bankOpen || view.you.resources[r] < 1}
                  onClick={() => sendAction({ kind: "BANK_TRADE", resource: r, direction: "sell" })}
                  style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                >
                  Sell
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h3 style={{ fontFamily: fonts.headingLatin, fontSize: "1rem", margin: 0 }}>Trade offers</h3>
          {!proposeOpen && others.length > 0 && (
            <Button variant="secondary" onClick={() => setProposeOpen(true)} style={{ padding: "6px 12px", fontSize: "0.85rem" }}>
              Propose a trade
            </Button>
          )}
        </div>

        {proposeOpen && (
          <div style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: `1px solid ${colors.line}` }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: colors.inkSoft, marginBottom: "8px" }}>
              To:{" "}
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {names[p.id] ?? p.id}
                  </option>
                ))}
              </select>
            </label>
            <BundleEditor label="You give" value={offer} onChange={setOffer} />
            <BundleEditor label="You want" value={request} onChange={setRequest} />
            <div style={{ display: "flex", gap: "8px" }}>
              <Button onClick={submitPropose} style={{ padding: "6px 14px", fontSize: "0.85rem" }}>
                Send offer
              </Button>
              <Button variant="secondary" onClick={() => setProposeOpen(false)} style={{ padding: "6px 14px", fontSize: "0.85rem" }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {view.trade.proposals.length === 0 && !proposeOpen && (
          <p style={{ color: colors.inkSoft, fontSize: "0.85rem" }}>No active trade offers.</p>
        )}

        {view.trade.proposals.map((p) => {
          const otherPartyId = p.playerAId === view.you.id ? p.playerBId : p.playerAId;
          const youAreRecipient = p.currentProposerId !== view.you.id;

          return (
            <div key={p.id} style={{ padding: "10px 0", borderBottom: `1px solid ${colors.line}` }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "6px" }}>
                <strong>{names[p.currentProposerId] ?? "Someone"}</strong> offers {describeBundle(p.offer)} for{" "}
                {describeBundle(p.request)} (with {names[otherPartyId] ?? "someone"})
                {p.unrefusable && <span style={{ color: colors.secret }}> — cannot be refused</span>}
              </p>

              {p.status !== "pending" && <p style={{ color: colors.inkSoft, fontSize: "0.8rem" }}>{p.status}</p>}

              {p.status === "pending" && youAreRecipient && counteringId !== p.id && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button onClick={() => sendAction({ kind: "TRADE_ACCEPT", proposalId: p.id })} style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
                    Accept
                  </Button>
                  {!p.unrefusable && (
                    <Button
                      variant="secondary"
                      onClick={() => sendAction({ kind: "TRADE_DECLINE", proposalId: p.id })}
                      style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                    >
                      Decline
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCounteringId(p.id);
                      setOffer(p.request);
                      setRequest(p.offer);
                    }}
                    style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                  >
                    Counter
                  </Button>
                </div>
              )}

              {p.status === "pending" && counteringId === p.id && (
                <div style={{ marginTop: "8px" }}>
                  <BundleEditor label="You give" value={offer} onChange={setOffer} />
                  <BundleEditor label="You want" value={request} onChange={setRequest} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button onClick={() => submitCounter(p.id)} style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
                      Send counter
                    </Button>
                    <Button variant="secondary" onClick={() => setCounteringId(null)} style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {p.status === "pending" && !youAreRecipient && (
                <Button
                  variant="secondary"
                  onClick={() => sendAction({ kind: "TRADE_WITHDRAW", proposalId: p.id })}
                  style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                >
                  Withdraw
                </Button>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
