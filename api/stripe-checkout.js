// Stripe Checkout Session creator (Vercel Function)
// 設定:
//   1. https://dashboard.stripe.com/ でアカウント作成
//   2. Products → 商品作成: AI鑑定¥1,980 / Zoom60min¥8,800 / 月額¥1,100
//   3. 各 price_xxx を Vercel env に設定
//   4. /api/stripe-webhook で決済成功通知を受ける

import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

const PRODUCTS = {
  ai_divination: {
    price: process.env.STRIPE_PRICE_AI_DIVINATION,
    name: 'KIN AI文字鑑定',
    description: '5項目の個別深層鑑定（裏KIN・転機・運命の相手・才能・金運）',
  },
  zoom_60min: {
    price: process.env.STRIPE_PRICE_ZOOM_60MIN,
    name: 'KIN Zoom個人鑑定 60分',
    description: 'マヤ暦KINに基づくZoom個別セッション',
  },
  monthly_news: {
    price: process.env.STRIPE_PRICE_MONTHLY_NEWS,
    name: '月額KINニュースレター',
    description: '毎月のKINエネルギー解説（サブスクリプション）',
    mode: 'subscription',
  },
};

export default async function handler(req, res) {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }
  const product = req.method === 'GET' ? req.query.product : (req.body || {}).product;
  const kin = req.method === 'GET' ? req.query.kin : (req.body || {}).kin;
  if (!product || !PRODUCTS[product]) {
    return res.status(400).json({ error: 'Invalid product' });
  }
  const cfg = PRODUCTS[product];
  if (!cfg.price) {
    return res.status(503).json({ error: `STRIPE_PRICE_* env not set for ${product}` });
  }

  const baseUrl = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: cfg.mode || 'payment',
      line_items: [{ price: cfg.price, quantity: 1 }],
      success_url: `${baseUrl}/?paid=1&product=${product}${kin ? `&kin=${kin}` : ''}`,
      cancel_url: `${baseUrl}/?cancelled=1`,
      metadata: { product, kin: kin || '' },
      payment_method_types: ['card'],
      locale: 'ja',
    });

    if (req.method === 'GET') {
      // GET: 直接リダイレクト (LINE bot からのリンクで利用)
      res.writeHead(303, { Location: session.url });
      return res.end();
    }
    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('stripe error:', e);
    return res.status(500).json({ error: e.message });
  }
}
