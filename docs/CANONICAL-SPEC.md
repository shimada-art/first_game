# Souk El Kdoub (سوق الكذوب) — Canonical Rules Specification
**Status:** Locked for engine implementation. This document supersedes any prior partial descriptions (tabletop guide prose, app companion guide, chat summaries). Where earlier material conflicts with this file, this file wins.

**Non-goals / explicitly out of scope:** No dice. No board movement. No property ownership. No secret-goal/"Secret Wish" win condition. Any reference material describing those mechanics belongs to a different, unrelated product and must not be merged into this engine.

---

## 1. Overview

- **Players:** 4–6 (human or AI-controlled, any mix)
- **Length:** exactly 10 rounds, always — no early win, no elimination
- **Victory:** highest **total wealth** (coins + resources valued at current market price) after round 10
- **Theme:** merchants in a Moroccan souk; trading, public bluffing, and raiding

## 2. Resource types (locked — exactly 4)

| id | Display (EN) | Display (AR) |
|---|---|---|
| `spice` | Spice | التوابل |
| `textile` | Textile | الأقمشة |
| `gold` | Gold | الذهب |
| `gem` | Gem | الجواهر |

No other resource type exists. Do not add a 5th/6th type without a full re-derivation of every numeric constant below (they all assume 4).

## 3. Components & fixed quantities

| Component | Quantity | Notes |
|---|---|---|
| Coins | 80 total | Pure integer currency, no denominations |
| Resource tokens | 80 total | 20 per resource type (4 × 20) |
| Merchant Role cards | 12 | One dealt per player; unused ones are not used this game |
| Market Event cards | 8 | All 8 used exactly once per game, rounds 2–9 |
| Whisper cards | 3 per player | 5 for a player holding Silver Tongue |
| Raid tokens | conceptually 0–3 per player per round | (4 in round 10, or 4 once for Smuggler) — not a depleting physical resource, a per-round choice |
| Price track | 4, one per resource | Range 1–10 inclusive, starts at 5 |

## 4. Setup sequence

1. Price track: all 4 resources start at **5**.
2. Each player receives: **10 coins**, **2 of each resource** (8 tokens total), **1 Merchant Role** (dealt from shuffled 12, unused roles discarded for this game), **3 Whisper cards** (5 if role = Silver Tongue), and conceptual access to raid tokens 0–3 (0–4 for Smuggler).
3. **Bank reserve = everything not dealt to players.** This means Bank size is a function of player count:
   - Bank coins = 80 − (10 × player count)
   - Bank resources per type = 20 − (2 × player count)
   - *Example, 4 players:* Bank = 40 coins, 12 of each resource.
   - *Example, 6 players:* Bank = 20 coins, 8 of each resource.
4. Shuffle the 8 Market Event cards into a face-down deck (used rounds 2–9 only, one per round, no repeats).
5. Determine starting player (youngest, or random for digital) — this seat also anchors raid-resolution order (§9.4) for the whole game. Round-to-round, whoever holds "starting player" status may rotate one seat left each round (cosmetic for turn-order display; does not gate any action in the digital implementation since Whisper/Trade/Raid are not strict turn-locked phases except where stated).

## 5. The round — exactly 5 steps, every round, rounds 1–10

Round 1 is special: **skip step 1 (Market) entirely** — no event, no price change, prices are still 5 from setup. Proceed directly to step 2.

### 5.1 Market
- Rounds 2–9: draw the next Event from the shuffled deck (see §14 for the full, fixed list of 8 — there are no others). Apply its effect for this round only, then discard it.
- Round 10: **no Event is drawn.** Round 10 instead runs the Final Bazaar rule (§11).
- Price update (rounds 2–10, using **last round's** Bank trade volume — see §7 for the exact formula).

### 5.2 Whisper
- Skipped entirely in round 1.
- Any player with Whisper cards remaining may, on their turn in the step, spend one card to make **one specific, checkable claim** about their own current resource holdings, naming exactly one resource type and one count (e.g., "I have 3 Gold"), aimed at exactly one other named player, declared **publicly** (visible/audible to all players — this is not a private message).
- See §8 for the full Trust/Verify/Bribe resolution and the exact list of valid claim shapes.
- A player with 0 Whisper cards remaining simply has no action this step but can still be targeted and can still respond as a target (Trust/Verify) or as a whisperer being verified (offer a bribe).

### 5.3 Trade
- Open, unstructured, simultaneous-feeling window (not strictly turn-locked). Two independent mechanisms:
  - **Player-to-player barter:** any resources and/or coins, any ratio, by mutual agreement. **Not enforced or validated by the engine** beyond executing the agreed transfer once both sides confirm — this is intentionally informal (mirrors physical play) and does **not** affect Market pricing.
  - **Bank trade:** buy or sell exactly 1 unit of 1 resource type at the *current* listed price (see §6). This is the only trade type that feeds into next round's price movement.
- No hard cap on number of actions per player per round in the base rules. (A digital implementation may rate-limit for pacing/UX reasons, but that is a UX choice, not a rule.)

### 5.4 Raid
- Every player **simultaneously and secretly** commits: one target (any other player) + a token count from **0–3** (0–4 in round 10, or 0–4 once-only if the player holds Smuggler and chooses to use it this raid). Committing 0 = does not raid anyone this round, but remains a valid target for others.
- All commitments reveal at once. See §9 for full resolution logic (mutual cancellation, steal amount, resource choice, multi-raider ordering, role interactions).

### 5.5 Reveal
- Announce/display all Raid outcomes and any Whisper lies caught this round.
- Advance: if round == 7, run the Reckoning (§10) before starting round 8. If round == 10, this Reveal is followed by the Final Tally (§12), not another round. Otherwise, begin round + 1 at §5.1.

## 6. The Bank — full specification

The Bank is a passive counterparty available during the Trade step (except when closed, see below). It is **not a player** and has no strategy.

- **Buy** (player → Bank pays coins, receives resource): cost = current listed price of that resource (+1 if Tight Purses event active this round; −1, floored at 1 coin, if the buyer holds Broker and has used fewer than 4 Broker-discounted trades so far this game). Requires Bank to hold ≥1 of that resource AND buyer to hold ≥ cost coins. On success: Bank resource −1, Bank coins +cost; buyer resource +1, buyer coins −cost.
- **Sell** (player → Bank pays coins, receives resource): gain = current listed price of that resource (−1, floored at 0, if Tight Purses active; +1 if seller holds Broker and has used fewer than 4 Broker-discounted trades so far). Requires seller to hold ≥1 of that resource AND Bank to hold ≥ gain coins. On success: Bank resource +1, Bank coins −gain; seller resource −1, seller coins +gain.
- **Bank closed** (neither Buy nor Sell possible by anyone, for any resource) during: a **Bank Holiday** event round, and all of **round 10** (Final Bazaar). This closure must be enforced at the transaction-function level, not only hidden in the UI — nothing (including an AI actor) may execute a Bank trade while closed.
- If the Bank runs out of a specific resource, only *sells* to it remain possible for that resource until restocked; if it runs out of coins, only *buys* from it remain possible (coins flow back in).

## 7. Market price update — exact formula

Applies at the start of every round from round 2 onward (round 1 has no Market step; round 10 still updates prices using round 9's data, since final wealth is valued at round-10 prices).

For each of the 4 resources independently:
1. Take **net Bank volume from the immediately preceding round only**: (units bought from Bank) − (units sold to Bank). Player-to-player trades and Raid transfers are never counted.
2. If net > 0 → price **+1** (or **+2** for Gem during a Gem Rush event). If net < 0 → price **−1** (or **−2** for Gem during Gem Rush). If net == 0 → unchanged.
3. **Exception overrides** (checked before the above): Spice Festival event → Spice price frozen regardless of volume. Quiet Market event → **all four** resources frozen regardless of volume.
4. Clamp result to the track range **[1, 10]** inclusive.
5. This is a **hard cap of exactly 1 step per resource per round** (2 for Gem under Gem Rush) — magnitude of volume does not matter; 1 unit of net movement and 50 units of net movement produce the identical price change. This is an intentional anti-manipulation guardrail (prevents a coalition from crashing or spiking a price in one round) — do not "improve" this into a volume-scaled formula.

There is no randomness anywhere in price movement. It is fully deterministic given trade history and active event.

## 8. Whisper / Trust / Verify / Bribe — full specification

**Claim shape (the only valid form):** `{ claimant, target, resource ∈ {spice,textile,gold,gem}, count ∈ integer ≥ 0 }`, meaning "I currently hold exactly `count` of `resource`." No other claim type exists (no claims about coins, about other players, about future actions, or vague/unquantified claims).

**Sequence:**
1. Claimant spends 1 Whisper card (0 if this is a free extra granted by Rumor Mill this round, or a second claim this round granted by Double Whisper) and states the claim publicly.
2. Target chooses **Trust** (nothing further happens, claim's truth is never revealed) or **announces Verify**.
3. If Verify announced: **before any peek occurs**, claimant may offer a bribe of any coin amount (including 0 / declining) to the target to cancel the Verify.
   - Bribe accepted → coins transfer claimant→target exactly as offered; no peek occurs; the claim's truth is never revealed or recorded.
   - Bribe declined (or 0 offered) → proceed to Verify resolution.
4. **Verify resolution:** cost to the verifier = 1 coin (2 coins if the claimant holds Locksmith; 0 coins if Generous Terms event is active this round — Generous Terms overrides Locksmith's surcharge). Reveal the claimant's actual current count of the named resource and compare to the claimed count.
   - **Claim false (actual ≠ claimed):** claimant pays verifier 1 coin, in addition to the verifier's own Verify cost already paid. Net: claimant −1; verifier's own cost is offset by the 1 received (verifier nets 0 when cost=1; nets −1 when cost=2 under Locksmith, since they receive only 1 back against a 2-coin spend).
   - **Claim true (actual == claimed):** verifier pays claimant 1 coin, **in addition to** their own Verify cost. Net: claimant +1; verifier −(cost + 1).
   - This symmetric penalty is intentional: wrongly doubting an honest player costs the doubter more than the cost of checking, discouraging reflexive over-verification.
5. Whichever branch resolves, the step then advances (see Double Whisper / Rumor Mill interaction below) to the next player's Whisper turn, or to Trade if no players have remaining actions.

**Interactions:**
- **Rumor Mill event:** each player, once this round, gets one additional Whisper action that costs no card (does not consume from their 3/5 total). This is separate from and stacks with Double Whisper.
- **Double Whisper role (once per game):** after resolving their normal claim this round, that player may immediately make a second claim (to a different target) in the same round, at the normal Whisper-card cost (i.e., this consumes 2 cards total from their pool across the two claims, not a free action).
- **Silver Tongue role:** passive, affects only the starting pool size (5 instead of 3); no other interaction.

## 9. Raid resolution — full specification

**Commitment phase (simultaneous, secret):** every player independently chooses `{ target: other player or null, tokens: 0–3 }` (0–4 in round 10; 0–4 once-only if using Smuggler this raid, see §13).

**Resolution order:** process players in seating order starting from the current round's starting player (§4.5). This order matters only when it determines what's left to steal (see multi-raider case below) — it does not change whether any individual raid succeeds.

**Per-raider resolution:**
1. If `tokens == 0` or `target == null`: no effect, this player raids no one this round (they may still be raided by others).
2. **Mutual raid check:** if the chosen target *also* chose this raider as their target with tokens > 0, both raids cancel completely — no theft either direction, tokens are simply spent for nothing.
3. **Defensive role check** (only if not already cancelled by mutuality): if target holds **Bodyguard** and has not yet used it this game, the raid is blocked entirely (target loses nothing, raider's tokens are wasted, Bodyguard is now marked used). Else if target holds **Underwriter**, has not yet used it, and has ≥2 coins, target may pay 2 coins to cancel the raid (Underwriter now marked used).
4. **Steal amount** = tokens committed, **+1 if Caravan Season event is active this round**, **+1 more if the raider holds Fence and has not yet used it this game** (Fence is then marked used only if this raid actually stole something).
5. **Resource selection: the raider chooses** which resource type(s) to take, one unit at a time, up to the steal amount, capped by what the target currently has available (if the target runs out before the full steal amount is satisfied, the raider simply takes less — no substitution, no partial-unit theft).
6. **Coins are never stolen by a raid, under any circumstance.**
7. **Multi-raider case:** if two or more players raid the *same* target and none of them cancels by mutuality/defense, each is resolved independently in the seating-order sequence from step "Resolution order" above — meaning a later raider in that order may find the target already partially or fully drained by an earlier raider's steal this same Reveal, even though both committed simultaneously. This is intentional (not a bug): simultaneity applies to the *commitment*, not to the *resolution order*.

## 10. Round 7 — The Reckoning

- Triggers after round 7's Reveal step, before round 8 begins.
- All players' total wealth (coins + resources × **current** market prices) is computed and displayed simultaneously to everyone.
- The player with the **lowest** total wealth receives **2 coins** from the Bank (from Bank reserve; if Bank has <2 coins, give what's available — this edge case should be rare given typical reserve sizes but must not go negative).
- **This is fixed at round 7, not round 5.** This timing was deliberately chosen after simulation testing showed an earlier reveal (round 5) gives the remaining 5 rounds enough time for the rest of the table to converge raids onto the revealed leader and collapse their win probability to near-zero; round 7 leaves only 3 rounds of "hunting" time, preserving tension without making the lead nearly unrecoverable. Do not move this back to round 5 without re-validating against that finding.
- Wealth is otherwise **never** publicly aggregated/displayed at any other point before this (individual trades/raids are visible; the summed total is not) — this gap is intentional (prevents constant leader-ganging every round) and should be preserved in the UI/state model (i.e., don't surface a running "total wealth" leaderboard continuously; only at the Reckoning and the Final Tally).

## 11. Round 10 — The Final Bazaar

- No Market Event is drawn this round.
- The **Bank is fully closed** for the entire round (no Buy, no Sell, by anyone, including AI actors — see §6 enforcement note).
- **Raid token cap rises to 4** for every player, this round only (independent of whether they hold Smuggler).
- Price update still occurs at the start of round 10 using round 9's Bank-trade data (§7) — prices are not frozen, only the Bank's ability to transact is.
- Followed immediately by the Final Tally (§12) after this round's Reveal.

## 12. Victory condition & tie-break

- After round 10's Reveal: each player's **total wealth** = coins + Σ(resource count × that resource's final market price).
- Highest total wealth wins.
- **Tie-break:** players may agree to share the win, or play one additional tiebreaker round among only the tied players (same 5-step structure, single round, highest resulting wealth among the tied group wins). A digital implementation should surface both options rather than silently picking one.

## 13. Merchant Roles — complete table (12, exactly)

One dealt per player at setup from a shuffled 12; a game with fewer than 12 players simply leaves some roles unused for that game (do not redistribute a role to two players). **None of these are win conditions** — they are personal tools only.

| Role (EN / AR) | Timing (when it can be invoked) | Limit | Exact effect |
|---|---|---|---|
| The Smuggler / المهرّب | Raid step, at the moment of committing tokens | Once per game | May commit 4 tokens instead of the normal 0–3 max (0–5 if this coincides with round 10, since round 10's cap is already 4 — Smuggler adds +1 on top of whatever the round's normal cap is) |
| The Silver Tongue / اللسان الفضي | Passive from setup | Permanent, not a triggered use | Starts with, and keeps, 5 Whisper cards instead of 3 for the whole game |
| The Appraiser / المُقيِّم | Trade step | Once per game | Free, private look at any 3 of one chosen player's current resource tokens (raider's/viewer's choice which 3; not tied to any Whisper claim) |
| The Bodyguard / الحارس الشخصي | Raid reveal, the instant this player would be successfully raided | Once per game | Blocks that raid completely — raider's committed tokens are wasted, this player loses nothing |
| The Broker / السمسار | Trade step, automatic | First 4 Bank trades this game only | Each of those trades is 1 coin better for this player (−1 to buy cost, floored at 1; +1 to sell gain) |
| Double Whisper / الهمسة المزدوجة | Whisper step, immediately after resolving this player's own claim | Once per game | May make a second claim this round to a different target (costs a 2nd Whisper card normally, per §8) |
| The Underwriter / الضامن | Raid reveal, the instant this player would be successfully raided | Once per game, requires ≥2 coins on hand | Pay 2 coins instead to cancel that raid entirely |
| The Speculator / المضارب | Market step, before that round's price update is applied | Once per game | Move any one resource's price by ±1 (player's choice of resource and direction) |
| The Locksmith / صانع الأقفال | Whisper step, passive, applies whenever anyone Verifies this player | Permanent, every time | Verify cost against this player is always 2 coins instead of 1 (Generous Terms event still overrides to 0) |
| The Fence / بائع المسروقات | Raid reveal, the instant one of this player's raids succeeds | Once per game | Steal 1 extra resource on top of the normal amount (stacks with Caravan Season) |
| The Closer / المُبرِم | Trade step, when this player proposes a trade | Once per game, 1-for-1 only | A trade of exactly 1 resource for exactly 1 resource that this player proposes to a named other player cannot be refused (deliberately capped at 1-for-1 to prevent forcing lopsided trades) |
| The Opportunist / المغتنم | After the Market step resolves, before the Whisper step begins | Once per game | May make one Bank trade at that round's just-updated listed price, ahead of the normal Trade step (still subject to normal Bank-closed rules if applicable that round) |

## 14. Market Events — complete table (8, exactly, no others)

Shuffled once at setup; exactly one drawn per round for rounds 2–9 (8 rounds, 8 events, each appears exactly once per game, never repeats within a game). None drawn in round 1 or round 10.

| Event (EN / AR) | Exact effect |
|---|---|
| Spice Festival / مهرجان التوابل | Spice's price is frozen this round (overrides the normal formula for Spice only) |
| Caravan Season / موسم القوافل | Every successful raid this round steals 1 extra resource (stacks with Fence) |
| Rumor Mill / طاحونة الشائعات | Every player gets 1 additional free Whisper action this round (no card spent) |
| Bank Holiday / عطلة البنك | The Bank is fully closed this round — no Buy, no Sell, by anyone |
| Gem Rush / حمّى الجواهر | Gem's price moves by 2 instead of 1 this round (direction still determined by net Bank volume as normal) |
| Quiet Market / سوق هادئ | No resource's price changes this round, regardless of Bank trading volume |
| Generous Terms / شروط سخية | Verify costs 0 coins for everyone this round (overrides Locksmith's surcharge) |
| Tight Purses / جيوب ضيّقة | Bank buy costs +1 coin; Bank sell gain −1 coin (floored at 0), this round only |

## 15. Coins & Resources — digital flexibility principles

These are binding design constraints for the engine, informed by documented failure/success patterns in Monopoly's own 40-year history of digital adaptations (physical-cash board game → app):

1. **No denomination modeling.** Coins and resource counts are plain integers. Never introduce bill/denomination logic, "exact change" requirements, or any constraint that simulates physical currency handling — that friction has no gameplay purpose here and was one of the few things digitization was universally agreed to legitimately fix.
2. **No artificial scarcity as a monetization lever.** There is no IAP layer in this game. Do not later introduce energy systems, timed currency drips, or pay-to-progress mechanics into the coins/resources model — this is the single most-cited player complaint pattern in mobile board-game adaptations generally.
3. **Local (trusted-group) play keeps manual override.** In local pass-and-play, any player may manually adjust any player's resource/coin count (±1 style controls) to self-correct mistakes or record an informally-agreed side trade — this mirrors the physical game's honor-system banker model and is intentional, not a security gap, in that context.
4. **Online (untrusted-device) play is server/state-authoritative per player.** In online multiplayer, a given device may only directly modify its own player's coins/resources (plus AI-controlled players' Trade actions, which any connected client may trigger since AI has no "private" stake to protect); it can never directly write another human player's coins/resources. This is already a hard requirement, not a nice-to-have — treat it as equivalent to server-side validation even if the "server" is a shared-state store rather than a traditional backend.
5. **State must be a single resumable object.** The full game state (players, bank, prices, round/phase, in-progress Whisper/Raid sub-state, log) should serialize to one coherent object at all times, so that a session can be persisted and resumed — locally (closed tab/app) or across devices (online). A digital board game with no save/resume is a well-documented, easily-avoided failure mode.

## 16. Suggested state shape (for schema reference, not a code requirement)

```
GameState {
  round: int (1–10)
  phase: enum(market, whisper, trade, raid, reveal, reckoning, gameover)
  players: [
    {
      id, name, isAI: bool,
      role: enum(12 role ids), roleUsed: bool, roleUseCount?: int (Broker needs a 0–4 counter, not a bool),
      resources: { spice: int, textile: int, gold: int, gem: int },
      coins: int,
      whisperCardsRemaining: int
    }
  ]
  bank: { resources: { spice, textile, gold, gem }, coins: int }
  prices: { spice, textile, gold, gem }  // each 1–10
  lastRoundBankNet: { spice, textile, gold, gem }  // signed int, feeds §7 next round
  eventDeck: [8 event ids, shuffled], eventIndex: int, currentEvent: id | null
  whisperState: { turnPlayerId, subStage: enum(turn,response,bribeOffer,bribeResponse), pendingClaim: {claimantId, targetId, resource, count} | null, pendingBribeAmount: int | null }
  raidState: { commitments: { [playerId]: {targetId, tokens} }, resolutionOrderStartId }
  log: [ {round, phase, text, ...structured fields for replay} ]
}
```
Anything not listed here (UI-only concerns: language preference, which panel is expanded, animation flags) is deliberately excluded from the canonical state — keep those client-local, not persisted/synced.

## 17. Explicitly not yet specified / left to implementation judgment

- Exact tie-break UI flow (share vs. replay round) — both must be *offered*, per §12; which is default is an implementation choice.
- Whether Bank running out of coins mid-buy should partially fill an order or reject it outright — current rules assume atomic all-or-nothing per single-unit trade (since trades are always exactly 1 unit at a time, this shouldn't arise, but note it if a future version allows multi-unit trades in one action).
- Any pacing/rate-limiting on Trade-step action count is a UX decision, not a rule (§5.3).
