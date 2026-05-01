// LINE Bot Webhook handler (Vercel Function)
// 設定:
//   1. LINE Developers で webhook URL を設定: https://kinuranai.vercel.app/api/line-webhook
//   2. Vercel env に LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN を設定
//   3. /api/kin-divination.js も併せてデプロイ

// LINE Bot SDK v9+ 公式API (context7検証済 2026-05-01)
import { messagingApi, validateSignature } from '@line/bot-sdk';

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const channelSecret = process.env.LINE_CHANNEL_SECRET || '';

const client = channelAccessToken
  ? new messagingApi.MessagingApiClient({ channelAccessToken })
  : null;

// 簡易KIN計算 (kinuranai-web/index.html と同じロジック)
const ANCHOR = { y: 2013, m: 7, d: 26 };
function calcKin(y, m, d) {
  const a = new Date(ANCHOR.y, ANCHOR.m - 1, ANCHOR.d);
  const t = new Date(y, m - 1, d);
  const r = Math.round((t - a) / 86400000);
  return ((0 + r) % 260 + 260) % 260 + 1;
}

const SEAL_NAMES = [
  '', '赤い龍', '白い風', '青い夜', '黄色い種', '赤い蛇',
  '白い世界の橋渡し', '青い手', '黄色い星', '赤い月', '白い犬',
  '青い猿', '黄色い人', '赤い空歩く人', '白い魔法使い', '青い鷲',
  '黄色い戦士', '赤い地球', '白い鏡', '青い嵐', '黄色い太陽',
];
const TONE_NAMES = [
  '', '磁気', '月', '電気', '自己存在', '倍音', 'リズム',
  '共振', '銀河', '太陽', '惑星', 'スペクトル', '水晶', '宇宙',
];

function parseDate(text) {
  // 1990年3月15日 / 1990/3/15 / 1990-03-15 / 19900315 等を許容
  const patterns = [
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/,
    /(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/,
    /(\d{4})(\d{2})(\d{2})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3]);
      if (y >= 1900 && y <= 2099 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return { y, m: mo, d };
      }
    }
  }
  return null;
}

function buildKinReply(birthdate) {
  const kin = calcKin(birthdate.y, birthdate.m, birthdate.d);
  const seal = ((kin - 1) % 20) + 1;
  const tone = ((kin - 1) % 13) + 1;
  return [
    {
      type: 'text',
      text:
        `🌟 あなたのKIN占い結果 🌟\n\n` +
        `生年月日: ${birthdate.y}年${birthdate.m}月${birthdate.d}日\n` +
        `KIN番号: ${kin}\n` +
        `太陽の紋章: ${SEAL_NAMES[seal]}\n` +
        `銀河の音: ${tone}「${TONE_NAMES[tone]}」\n\n` +
        `この組み合わせがあなたの「使命の設計図」です。\n` +
        `260日に1度しか巡ってこない特別なKINです。`,
    },
    {
      type: 'text',
      text:
        `📿 もっと深く知りたい方へ\n\n` +
        `あなたのKIN${kin}に向けた「2026年下半期の3つの転機」「裏KIN」「運命の人と出会うタイミング」を含む\n` +
        `🔮 AI鑑定 ¥1,980\n\n` +
        `下のリンクから決済できます:\n` +
        `${process.env.PUBLIC_BASE_URL || 'https://kinuranai.vercel.app'}/api/stripe-checkout?product=ai_divination&kin=${kin}`,
    },
  ];
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;
  const text = event.message.text.trim();

  // 生年月日と判定できたらKIN計算
  const date = parseDate(text);
  if (date) {
    return client.replyMessage({ replyToken: event.replyToken, messages: buildKinReply(date) });
  }

  // ヘルプ
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text:
        `KINURANAIへようこそ✨\n\n` +
        `生年月日を送ると、あなたのKIN番号と紋章をお伝えします。\n\n` +
        `例:\n  1995年3月15日\n  1995/3/15\n  19950315\n\n` +
        `毎日のKINメッセージも自動配信中💫`,
    }],
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!client) {
    return res.status(503).json({ error: 'LINE not configured' });
  }

  // 署名検証
  const signature = req.headers['x-line-signature'];
  const body = JSON.stringify(req.body);
  if (!validateSignature(body, channelSecret, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const events = req.body.events || [];
    await Promise.all(events.map(handleEvent));
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('webhook error:', e);
    return res.status(500).json({ error: e.message });
  }
}
