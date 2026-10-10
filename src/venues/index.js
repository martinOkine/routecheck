// Venue adapters. Each takes (from, to, atomicAmount, opts) and resolves to
// { out: atomic output string, route: short description }.
// All are read-only quote requests: no wallet, no signing, nothing is sent on-chain.

async function getJson(url, init = {}, timeoutMs = 15000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Jupiter public quote API (aggregator). Docs: https://dev.jup.ag
async function jupiter(from, to, amount, { slippageBps }) {
  const q = new URLSearchParams({ inputMint: from.mint, outputMint: to.mint, amount, slippageBps });
  const d = await getJson(`https://lite-api.jup.ag/swap/v1/quote?${q}`);
  const labels = (d.routePlan || []).map((r) => r.swapInfo?.label).filter(Boolean);
  return { out: d.outAmount, route: [...new Set(labels)].join('+') || 'jupiter' };
}

// Raydium public trade API (single DEX). Docs: https://docs.raydium.io
async function raydium(from, to, amount, { slippageBps }) {
  const q = new URLSearchParams({ inputMint: from.mint, outputMint: to.mint, amount, slippageBps, txVersion: 'V0' });
  const d = await getJson(`https://transaction-v1.raydium.io/compute/swap-base-in?${q}`);
  if (!d.success) throw new Error(d.msg || 'raydium: no route');
  return { out: d.data.outputAmount, route: `raydium (${(d.data.routePlan || []).length} hop)` };
}

// swap.io (meta-aggregator). OPT-IN ONLY: this calls the quote endpoint used by the swap.io web app,
// which is not a documented public API. swap.io's documented API is pay-per-request (x402).
// Enable with --include-swapio, keep request volume low, and switch to the official API when practical.
async function swapio(from, to, amount, { slippageBps }) {
  const d = await getJson('https://swap.io/internal-api/routhex/swap/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://swap.io', Referer: 'https://swap.io/' },
    body: JSON.stringify({
      input: { token: from.mint, amount, chainKey: 'sol' },
      output: { token: to.mint, chainKey: 'sol' },
      userAddress: '11111111111111111111111111111111', // placeholder: quotes only, nothing is signed
      slippageBps,
    }),
  });
  const best = d.quotes.find((q) => q.bestQuote) || d.quotes[0];
  return { out: best.output.amount, route: `swap.io via ${best.provider.key}` };
}

module.exports = { jupiter, raydium, swapio };
