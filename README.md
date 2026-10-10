# RouteCheck

Same-moment swap quotes across Solana venues. Pick a pair and a size, and RouteCheck asks every venue for a quote **in parallel**, then shows what you would actually receive from each and the gap in basis points.

Single screenshots taken minutes apart are not a fair price comparison. RouteCheck takes all quotes in the same instant, for several pairs and trade sizes, and saves the results so anyone can repeat the test.

Read-only: it never asks for a wallet, never signs anything, and never sends a transaction.

## Quick start

Requires Node.js 18+ (uses the built-in `fetch`). No dependencies.

```bash
node src/routecheck.js SOL USDC 10
node src/routecheck.js USDC JUP 10000 --include-swapio
node src/routecheck.js --matrix                    # built-in pairs x sizes -> out/<timestamp>.csv
node src/routecheck.js --matrix --rounds 3 --gap 300
```

Example output:

```
USDC->JUP  size 10000  at 2026-10-10T16:11:56.220Z
  jupiter            27210.477557     0.00 bps   GoonFi V2+HumidiFi+ZeroFi
  swapio             27202.995544    -2.75 bps   swap.io via okx-dex
  raydium            25542.078788  -613.15 bps   raydium (2 hop)
```

## Venues

| Venue | Type | Source |
|---|---|---|
| Jupiter | aggregator | public quote API (`lite-api.jup.ag`) |
| Raydium | single DEX | public trade API (`transaction-v1.raydium.io`) |
| swap.io | meta-aggregator (queries Jupiter, DFlow, OKX DEX and others) | **opt-in** with `--include-swapio`: uses the quote endpoint of the swap.io web app, which is not a documented public API. swap.io's documented API is pay-per-request (x402). Keep volume low. |

Adding a venue means adding one adapter in `src/venues/index.js` that returns `{ out, route }`.

## Method

- All venues for a given trade are queried with `Promise.all`, so the quotes come from the same moment. The timestamp is recorded.
- Amounts are what the venue says you would **receive**, net of its fees. Example: swap.io documents a 0.01% fee on SOL/stablecoin pairs, and it shows up as about −1 bp against Jupiter when swap.io routes through Jupiter.
- `vsBestBps` is each venue's gap to the best quote for that trade: 0 = best, −10 = 0.10% worse.
- Slippage is fixed (default 50 bps) so it does not change the comparison.
- Quotes are not executions. Real fills can differ with latency and MEV.

## Sample results (2026-10-10)

`samples/2026-10-10-swapio-jupiter-raydium.md`: 19 trades across SOL/USDC, USDC/SOL, SOL/USDT, USDC/JUP and USDC/BONK, from 0.1 SOL up to $10,000.

- swap.io and Jupiter were within about ±2 bps of each other. swap.io sometimes won by finding a better route through OKX or DFlow.
- Raydium on its own was up to **6.4% worse** on a $10,000 USDC→JUP trade, which shows why routing across venues matters.

## Roadmap

- Web UI: pick pair and size, ranked table.
- Scheduled snapshots and a public history page ("who wins, for which pairs and sizes, by how much").
- More venues (documented APIs first).
- Optional: check a quote against `simulateTransaction`.

## License

MIT
