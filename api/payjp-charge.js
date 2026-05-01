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

// HOLD-1 fix 2026-05-01: 失敗時にユーザーへエラー通知 + 結果を返す
async function pushDivinationToLine(kin, birthdate, lineUserId) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !lineUserId) {
    return { ok: false, error: 'LINE not configured' };
  }
  let line;
  try {
    const { messagingApi } = await import('@line/bot-sdk');
    line = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    });
  } catch (e) {
    console.error('LINE SDK init failed:', e);
    return { ok: false, error: 'LINE SDK init failed' };
  }

  async function notifyFailure(reason) {
    try {
      await line.pushMessage({
        to: lineUserId,
        messages: [{
          type: 'text',
          text:
            `⚠️ ご決済は完了しましたが、鑑定の自動配信でエラーが発生しました。\n\n` +
            `5分以内に手動でお届けします。お待たせして申し訳ありません。\n\n` +
            `万一届かない場合はこのLINEに「鑑定届きません」と返信ください。\n\n(エラーコード: ${reason})`,
        }],
      });
    } catch (e2) {
      console.error('failure notification also failed:', e2);
    }
  }

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
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('claude api non-ok:', r.status, text);
      await notifyFailure(`claude_${r.status}`);
      return { ok: false, error: `claude api ${r.status}` };
    }
    const data = await r.json();
    if (!data.divination) {
      await notifyFailure('claude_empty');
      return { ok: false, error: 'claude empty' };
    }

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
    return { ok: true };
  } catch (e) {
    console.error('divination push failed:', e);
    await notifyFailure(e.code || 'unknown');
    return { ok: false, error: e.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!payjp) return res.status(503).json({ error: 'PAY.JP not configured' });

  const { token, product, kin, birthdate, line_user_id } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token required' });
  if (!product || !PRICE_TABLE[product]) return res.status(400).json({ error: 'invalid product' });

  const cfg = PRICE_TABLE[product];

  // C-2 fix 2026-05-01: ai_divination は line_user_id+kin 必須 (なしだと鑑定がロストする)
  if (product === 'ai_divination') {
    if (!line_user_id) {
      return res.status(400).json({
        error: 'line_user_id required for ai_divination',
        message: 'AI鑑定はLINE経由でお届けします。LINE登録後にお買い求めください。',
      });
    }
    if (!kin) return res.status(400).json({ error: 'kin required for ai_divination' });
  }

  // M-3 fix 2026-05-01: subscription product 用の env 必須チェック
  if (cfg.recurring && !process.env.PAYJP_PLAN_MONTHLY_NEWS) {
    return res.status(503).json({ error: 'subscription plan not configured (PAYJP_PLAN_MONTHLY_NEWS)' });
  }

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
      // C-1 fix 2026-05-01: AI鑑定push を await + 結果を caller に返す (fire-and-forget廃止)
      let divinationStatus = null;
      if (product === 'ai_divination') {
        divinationStatus = await pushDivinationToLine(
          parseInt(kin), birthdate || '不明', line_user_id,
        );
      }
      return res.status(200).json({
        success: true,
        type: 'charge',
        charge_id: charge.id,
        amount: charge.amount,
        divination_delivered: divinationStatus ? divinationStatus.ok : null,
        divination_error: divinationStatus && !divinationStatus.ok ? divinationStatus.error : null,
      });
    }
    return res.status(402).json({ error: 'charge not paid', detail: charge });
  } catch (e) {
    console.error('payjp charge error:', e);
    return res.status(500).json({ error: e.message, code: e.code });
  }
}
