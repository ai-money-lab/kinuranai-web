// Stripe webhook handler — 決済成功時に kin-divination を生成してLINEで送信
// 設定:
//   1. https://dashboard.stripe.com/ → Developers → Webhooks → Add endpoint
//   2. URL: https://kinuranai.vercel.app/api/stripe-webhook
//   3. Events: checkout.session.completed
//   4. Signing secret を Vercel env STRIPE_WEBHOOK_SECRET に設定
//   5. このハンドラは raw body 必須なので bodyParser:false

import Stripe from 'stripe';
import { Client } from '@line/bot-sdk';

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

const lineClient = process.env.LINE_CHANNEL_ACCESS_TOKEN
  ? new Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.LINE_CHANNEL_SECRET || '',
    })
  : null;

async function handleCheckoutCompleted(session) {
  // metadata に kin / line_user_id を含める設計 (LINE bot から checkout作成時に付与)
  const kin = parseInt(session.metadata?.kin || '0');
  const lineUserId = session.metadata?.line_user_id;
  const birthdate = session.metadata?.birthdate || '不明';

  if (!kin || !lineUserId || !lineClient) return;

  // Claude API で鑑定生成
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

    if (data.divination) {
      // LINEで鑑定結果を push
      await lineClient.pushMessage(lineUserId, [
        {
          type: 'text',
          text: `🔮 KIN${kin}の深層鑑定が届きました 🔮\n\n${data.divination}`,
        },
        {
          type: 'text',
          text:
            `さらに詳しいZoom個人鑑定（60分・¥8,800）もご利用いただけます。\n\n` +
            `予約はこちら:\n${process.env.PUBLIC_BASE_URL || 'https://kinuranai.vercel.app'}/api/stripe-checkout?product=zoom_60min&kin=${kin}`,
        },
      ]);
    }
  } catch (e) {
    console.error('divination push error:', e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  const rawBody = await readRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object);
  }

  return res.status(200).json({ received: true });
}
