#!/usr/bin/env node
// RouteCheck: same-moment swap quotes across Solana venues.
//
//   node src/routecheck.js SOL USDC 10                 one trade, ranked table
//   node src/routecheck.js --matrix                    built-in pairs x sizes, saved to out/
//   node src/routecheck.js --matrix --rounds 3 --gap 300
//   add --include-swapio to also query swap.io (see src/venues/index.js)
const fs = require('fs');
const path = require('path');
const { token, toAtomic, fromAtomic } = require('./tokens');
const venues = require('./venues');

const MATRIX = [
  ['SOL', 'USDC', ['0.1', '1', '10', '100']],
  ['USDC', 'SOL', ['10', '100', '1000', '10000']],
  ['SOL', 'USDT', ['1', '10', '100']],
  ['USDC', 'JUP', ['10', '100', '1000', '10000']],
  ['USDC', 'BONK', ['10', '100', '1000', '10000']],
];

function parseArgs(argv) {
  const a = { positional: [], slippageBps: 50, rounds: 1, gap: 300, matrix: false, includeSwapio: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--matrix') a.matrix = true;
    else if (v === '--include-swapio') a.includeSwapio = true;
    else if (v === '--rounds') a.rounds = Number(argv[++i]);
    else if (v === '--gap') a.gap = Number(argv[++i]);
    else if (v === '--slippage') a.slippageBps = Number(argv[++i]);
    else a.positional.push(v);
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = (p) => p.then((v) => ({ ok: true, ...v }), (e) => ({ ok: false, error: e.message }));

// Query every venue for one trade in parallel, so all quotes come from the same moment.
async function check(fromSym, toSym, size, opts) {
  const from = token(fromSym);
  const to = token(toSym);
  const amount = toAtomic(from, size);
  const names = ['jupiter', 'raydium', ...(opts.includeSwapio ? ['swapio'] : [])];
  const at = new Date().toISOString();
  const results = await Promise.all(names.map((n) => settle(venues[n](from, to, amount, opts))));
  const quotes = names.map((n, i) => ({
    venue: n,
    ok: results[i].ok,
    out: results[i].ok ? fromAtomic(to, results[i].out) : null,
    route: results[i].ok ? results[i].route : `error: ${results[i].error}`,
  }));
  const best = Math.max(...quotes.filter((q) => q.ok).map((q) => q.out));
  for (const q of quotes) q.vsBestBps = q.ok && best > 0 ? ((q.out - best) / best) * 10000 : null;
  quotes.sort((x, y) => (y.out ?? -1) - (x.out ?? -1));
  return { at, pair: `${from.symbol}->${to.symbol}`, size, quotes };
}

function printCheck(c) {
  console.log(`\n${c.pair}  size ${c.size}  at ${c.at}`);
  for (const q of c.quotes) {
    const out = q.ok ? q.out.toFixed(6).padStart(22) : '-'.padStart(22);
    const bps = q.vsBestBps === null ? '' : `${q.vsBestBps.toFixed(2).padStart(8)} bps`;
    console.log(`  ${q.venue.padEnd(8)} ${out} ${bps}   ${q.route}`);
  }
}

async function runMatrix(opts) {
  const outDir = path.join(__dirname, '..', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rows = [];
  for (let r = 1; r <= opts.rounds; r++) {
    for (const [f, t, sizes] of MATRIX) {
      for (const s of sizes) {
        const c = await check(f, t, s, opts);
        printCheck(c);
        for (const q of c.quotes) rows.push({ round: r, at: c.at, pair: c.pair, size: s, ...q });
        await sleep(1200); // stay gentle with public endpoints
      }
    }
    if (r < opts.rounds) await sleep(opts.gap * 1000);
  }
  const cols = ['round', 'at', 'pair', 'size', 'venue', 'out', 'vsBestBps', 'route'];
  fs.writeFileSync(path.join(outDir, `${stamp}.csv`), [cols.join(','), ...rows.map((x) => cols.map((c) => JSON.stringify(x[c] ?? '')).join(','))].join('\n'));

  const wins = {};
  for (const x of rows) if (x.vsBestBps === 0) wins[x.venue] = (wins[x.venue] || 0) + 1;
  console.log(`\nbest-venue count: ${JSON.stringify(wins)}`);
  console.log(`saved out/${stamp}.csv`);
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.matrix) return runMatrix(opts);
  const [f, t, s] = opts.positional;
  if (!f || !t || !s) {
    console.log('usage: node src/routecheck.js <FROM> <TO> <AMOUNT> [--include-swapio] [--slippage 50]');
    console.log('       node src/routecheck.js --matrix [--rounds N --gap SECONDS] [--include-swapio]');
    process.exit(1);
  }
  printCheck(await check(f, t, s, opts));
})().catch((e) => {
  console.error('error:', e.message);
  process.exit(1);
});
