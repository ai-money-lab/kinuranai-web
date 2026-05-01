// PAY.JP Charge endpoint — checkout.htmlのトークン化フロー後にPOSTされる
// 1. payjp.js でカード→token生成 (フロント)
// 2. このAPIでtoken→charge作成 (一括決済)
// 3. 成功なら Claude API で鑑定生成→LINE push
//
// 占い・スピリチュアル業界での Stripe審査落ち回避のため PAY.JP に切替 (2026-05-01)

import Payjp from 'payjp';

const payjp = process.env.PAYJP_SECRET_KEY ? Payjp(process.env.PAYJP_SECRET_KEY) : null;

const PRICE_TABLE = {
  ai_divination: { amount: 1980, label: 'KIN AI文字鑑定' },
  zoom_60min: { amount: 8800, label: 'KIN Zoom個人鑑定60分' },
  monthly_news: { amount: 1100, label: '月額KINニュースレター', recurring: true },
};

async function pushDivinationToLine(kin, birthdate, lineUserId) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !lineUserId) return;
  try {
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://kinuranai.vercel.app';
    const r = await fetch(`${baseUrl}/api/kin-divination`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ kin, birthdate }),
    });
    const data = await r.json();
    if (!data.divination) return;

    const { messagingApi } = await import('@line/bot-sdk');
    const line = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    });
    await line.pushMessage({
      to: lineUserId,
      messages: [
        { type: 'text', text: `🔮 KIN${kin}の深層鑑定が届きました 🔮\n\n${data.divination}` },
        {
          type: 'text',
          text:
            `さらに詳しいZoom個人鑑定（60分・¥8,800）もご利用いただけます。\n\n` +
            `予約はこちら:\n${baseUrl}/checkout.html?product=zoom_60min&kin=${kin}`,
        },
      ],
    });
  } catch (e) {
    console.error('divination push failed:', e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!payjp) return res.status(503).json({ error: 'PAY.JP not configured' });

  const { token, product, kin, birthdate, line_user_id } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token required' });
  if (!product || !PRICE_TABLE[product]) return res.status(400).json({ error: 'invalid product' });

  const cfg = PRICE_TABLE[product];

  try {
    if (cfg.recurring) {
      // サブスクリプション: customer→subscription
      const customer = await payjp.customers.create({
        card: token,
        email: req.body.email || undefined,
        metadata: { product, kin: kin || '', line_user_id: line_user_id || '' },
      });
      const subscription = await payjp.subscriptions.create({
        customer: customer.id,
        plan: process.env.PAYJP_PLAN_MONTHLY_NEWS,
      });
      return res.status(200).json({
        success: true,
        type: 'subscription',
        subscription_id: subscription.id,
      });
    }

    // 一括決済
    const charge = await payjp.charges.create({
      amount: cfg.amount,
      currency: 'jpy',
      card: token,
      description: `${cfg.label}${kin ? ` (KIN${kin})` : ''}`,
      metadata: { product, kin: kin || '', line_user_id: line_user_id || '' },
    });

    if (charge.paid) {
      // AI鑑定なら即時LINE push
      if (product === 'ai_divination' && kin && line_user_id) {
        // 非同期でpush (チャージレスポンスは即返す)
        pushDivinationToLine(parseInt(kin), birthdate || '不明', line_user_id);
      }
      return res.status(200).json({
        success: true,
        type: 'charge',
        charge_id: charge.id,
        amount: charge.amount,
      });
    }
    return res.status(402).json({ error: 'charge not paid', detail: charge });
  } catch (e) {
    console.error('payjp charge error:', e);
    return res.status(500).json({ error: e.message, code: e.code });
  }
}
