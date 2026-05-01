// Vercel Cron Daily Broadcast — 毎朝7時に登録ユーザー全員へ「今日のKIN」配信
// 設定:
//   1. vercel.json で cron schedule を 0 22 * * * (UTC=JST 7:00) に設定済
//   2. CRON_SECRET env 経由で認証 (Vercel Cron は Authorization: Bearer ... を自動付与)
//   3. 配信対象は LINE Followers API で全友だちIDを取得

import { messagingApi } from '@line/bot-sdk';

const ANCHOR = { y: 2013, m: 7, d: 26 };
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

function calcKin(y, m, d) {
  const a = new Date(ANCHOR.y, ANCHOR.m - 1, ANCHOR.d);
  const t = new Date(y, m - 1, d);
  const r = Math.round((t - a) / 86400000);
  return ((0 + r) % 260 + 260) % 260 + 1;
}

export default async function handler(req, res) {
  // Vercel Cron 認証
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    return res.status(503).json({ error: 'LINE not configured' });
  }

  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const kin = calcKin(y, m, d);
  const seal = ((kin - 1) % 20) + 1;
  const tone = ((kin - 1) % 13) + 1;

  const text =
    `🌟 ${y}年${m}月${d}日 今日のKIN 🌟\n\n` +
    `KIN${kin}「${SEAL_NAMES[seal]}」音${tone}「${TONE_NAMES[tone]}」\n\n` +
    `260日に一度のこの日を、あなたはどう生きますか？\n\n` +
    `自分専用の鑑定 → kinuranai.vercel.app/checkout.html?product=ai_divination&kin=${kin}`;

  const line = new messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  });

  try {
    // broadcast = 全友だち配信 (ナローキャストでなく全員送信)
    await line.broadcast({
      messages: [{ type: 'text', text }],
    });
    return res.status(200).json({ ok: true, kin, sent_at: jst.toISOString() });
  } catch (e) {
    console.error('broadcast error:', e);
    return res.status(500).json({ error: e.message });
  }
}
