import type { ResourceId } from "@souk/shared";
import type { BankDirection } from "./bank.js";
import type { TradeBundle } from "./types.js";

export type EngineAction =
  | { kind: "WHISPER_CLAIM"; targetId: string; resource: ResourceId; count: number }
  | { kind: "WHISPER_TRUST" }
  | { kind: "WHISPER_VERIFY" }
  | { kind: "WHISPER_BRIBE_OFFER"; amount: number }
  | { kind: "WHISPER_BRIBE_RESPOND"; accept: boolean }
  | { kind: "BANK_TRADE"; resource: ResourceId; direction: BankDirection }
  | { kind: "OPPORTUNIST_BANK_TRADE"; resource: ResourceId; direction: BankDirection }
  | {
      kind: "TRADE_PROPOSE";
      toPlayerId: string;
      offer: TradeBundle;
      request: TradeBundle;
      useCloser?: boolean;
    }
  | { kind: "TRADE_ACCEPT"; proposalId: string }
  | { kind: "TRADE_DECLINE"; proposalId: string }
  | { kind: "TRADE_COUNTER"; proposalId: string; offer: TradeBundle; request: TradeBundle }
  | { kind: "TRADE_WITHDRAW"; proposalId: string }
  | { kind: "APPRAISER_PEEK"; targetId: string }
  | {
      kind: "RAID_COMMIT";
      targetId: string | null;
      tokens: number;
      lootPreference?: ResourceId[];
      useSmuggler?: boolean;
    }
  | {
      kind: "ADVANCE_PHASE";
      /** Only used when leaving Reveal into the next round's Market — spec §13, Speculator. */
      speculatorAdjustment?: { resource: ResourceId; direction: 1 | -1 };
    };

export type EngineActionKind = EngineAction["kind"];
