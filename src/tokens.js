// Token registry: symbol -> mint and decimals (Solana mainnet).
const TOKENS = {
  SOL: { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  JUP: { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
  BONK: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  JTO: { mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', decimals: 9 },
  WIF: { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
};

function token(sym) {
  const t = TOKENS[sym.toUpperCase()];
  if (!t) throw new Error(`unknown token ${sym}; known: ${Object.keys(TOKENS).join(', ')}`);
  return { symbol: sym.toUpperCase(), ...t };
}

// human amount -> atomic string, without float rounding for typical inputs
function toAtomic(t, amount) {
  const [whole, frac = ''] = String(amount).split('.');
  const padded = (frac + '0'.repeat(t.decimals)).slice(0, t.decimals);
  return (BigInt(whole || '0') * 10n ** BigInt(t.decimals) + BigInt(padded || '0')).toString();
}

function fromAtomic(t, atomic) {
  return Number(atomic) / 10 ** t.decimals;
}

module.exports = { TOKENS, token, toAtomic, fromAtomic };
