// PAY.JP Webhook handler (補助イベント用・主決済通知は payjp-charge.js で同期処理済)
// 用途:
//   - subscription.renewed / charge.refunded / customer.subscription.deleted 等の通知受信
//   - LINE への補助メッセージ送信 (例: 月額更新通知)
//
// 設定:
//   1. PAY.JP ダッシュボード → Webhook → URL: https://kinuranai.vercel.app/api/payjp-webhook
//   2. Webhook secret は PAYJP_WEBHOOK_SECRET に設定 (HMAC-SHA256)
//   3. このハンドラは raw body 必須

import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

async function pushLineMessage(userId, text) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !userId) return;
  try {
    const { messagingApi } = await import('@line/bot-sdk');
    const line = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    });
    await line.pushMessage({
      to: userId,
      messages: [{ type: 'text', text }],
    });
  } catch (e) {
    console.error('line push error:', e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-payjp-signature'] || req.headers['payjp-signature'];

  if (process.env.PAYJP_WEBHOOK_SECRET) {
    if (!verifySignature(rawBody, signature, process.env.PAYJP_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf-8'));
  } catch (e) {
    return res.status(400).json({ error: 'invalid JSON' });
  }

  const type = event.type;
  const obj = (event.data || {}).object || event.data || {};
  const lineUserId = (obj.metadata || {}).line_user_id;

  try {
    switch (type) {
      case 'subscription.renewed':
        if (lineUserId) {
          await pushLineMessage(
            lineUserId,
            `📿 月額KINニュースレターが更新されました\n今月のKINエネルギー解説をまもなく配信します。`,
          );
        }
        break;
      case 'subscription.deleted':
      case 'subscription.canceled':
        if (lineUserId) {
          await pushLineMessage(
            lineUserId,
            `月額購読が終了しました。またのご縁をお待ちしています✨`,
          );
        }
        break;
      case 'charge.refunded':
        if (lineUserId) {
          await pushLineMessage(
            lineUserId,
            `返金処理が完了しました。何かご不明な点があればこのLINEで返信ください。`,
          );
        }
        break;
      default:
        // 未対応イベントはOKだけ返す
        break;
    }
  } catch (e) {
    console.error('webhook handler error:', e);
  }

  return res.status(200).json({ received: true });
}
