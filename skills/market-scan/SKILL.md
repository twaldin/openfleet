---
name: market-scan
description: Review prediction markets, positions, catalysts, and mark-to-market P&L.
---

# Market Scan

Use this skill when checking prediction markets, open positions, or event-driven trading setups.

1. Identify the venue, market contract, resolution criteria, and expiration date first.
2. Separate the question being priced from the story people are telling about it.
3. Pull current bid, ask, last trade, implied probability, and available liquidity.
4. Record your position size, average entry, and any fees that affect true breakeven.
5. Compute mark-to-market P&L from current executable prices, not idealized midpoints when liquidity is thin.
6. Note the spread, because a wide spread can dominate short-term P&L.
7. Check for obvious catalyst timing: earnings, rulings, launches, elections, deadlines, or data releases.
8. Read the market rules for edge cases, ambiguity, and settlement risk.
9. Compare market price to the strongest evidence you can find, not just social sentiment.

Useful output fields:

- Contract name
- Resolution date
- Position and average entry
- Best bid and ask
- Current mark probability
- Unrealized P&L
- Key catalysts
- Main risks

If scanning multiple markets, rank them by mispricing signal, liquidity, and time sensitivity.

Flag when the market is too illiquid, too ambiguous, or too close to settlement for clean execution.
