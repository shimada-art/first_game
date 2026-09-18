import { QUICK_REACTION_IDS, type QuickReactionId } from "@souk/shared";
import { colors } from "@souk/ui";

export const REACTION_LABEL: Record<QuickReactionId, string> = {
  smirk: "😏",
  think: "🤔",
  eyes: "👀",
  shock: "😱",
  laugh: "😂",
  deal: "Deal?",
  noWay: "No way!",
  interesting: "Interesting…",
  liar: "Liar!",
};

export function QuickReactions({ onSend }: { onSend: (reaction: QuickReactionId) => void }) {
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {QUICK_REACTION_IDS.map((id) => (
        <button
          key={id}
          onClick={() => onSend(id)}
          style={{
            fontSize: "0.78rem",
            padding: "4px 9px",
            borderRadius: "999px",
            border: `1px solid ${colors.line}`,
            background: colors.paper2,
            color: colors.ink,
            cursor: "pointer",
          }}
        >
          {REACTION_LABEL[id]}
        </button>
      ))}
    </div>
  );
}
