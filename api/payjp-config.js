// PAY.JP publishable key endpoint
// HOLD-3 fix 2026-05-01: pk_live_xxx を git history に残さず Vercel env から動的提供
// checkout.html が読込時にfetchして data-key に注入する.

export default function handler(req, res) {
  const pk = process.env.PAYJP_PUBLIC_KEY || '';
  if (!pk) {
    return res.status(503).json({ error: 'PAYJP_PUBLIC_KEY not configured' });
  }
  // 公開鍵なので CORS 許可・キャッシュ短め (key rotation 対応)
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({ public_key: pk });
}
