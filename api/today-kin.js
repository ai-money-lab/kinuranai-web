// 今日のKIN返却 API — LINE Bot や サイトから利用
// GET /api/today-kin → { kin, seal, tone, date, message }

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
const DAILY_MESSAGES = {
  red:    '情熱を一歩先に出す日。直感に従って動くと運が開ける。',
  white:  '冷静に整える日。書類・連絡・小さな約束を丁寧に守る。',
  blue:   '変化を受け入れる日。違和感を見逃さず、流れに乗る。',
  yellow: '実りを収穫する日。これまでの積み重ねが目に見える形に。',
};
const SEAL_COLOR = ['', 'red', 'white', 'blue', 'yellow', 'red', 'white', 'blue', 'yellow', 'red', 'white', 'blue', 'yellow', 'red', 'white', 'blue', 'yellow', 'red', 'white', 'blue', 'yellow'];

function calcKin(y, m, d) {
  const a = new Date(ANCHOR.y, ANCHOR.m - 1, ANCHOR.d);
  const t = new Date(y, m - 1, d);
  const r = Math.round((t - a) / 86400000);
  return ((0 + r) % 260 + 260) % 260 + 1;
}

export default function handler(req, res) {
  const now = new Date();
  // JST 補正
  const jst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const kin = calcKin(y, m, d);
  const seal = ((kin - 1) % 20) + 1;
  const tone = ((kin - 1) % 13) + 1;
  const color = SEAL_COLOR[seal];

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.status(200).json({
    date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    kin,
    seal: SEAL_NAMES[seal],
    seal_index: seal,
    color,
    tone,
    tone_name: TONE_NAMES[tone],
    message: DAILY_MESSAGES[color],
    formatted_text:
      `🌟 ${y}年${m}月${d}日のKIN 🌟\n\n` +
      `KIN: ${kin}\n` +
      `太陽の紋章: ${SEAL_NAMES[seal]}\n` +
      `銀河の音: ${tone}「${TONE_NAMES[tone]}」\n\n` +
      `今日のメッセージ:\n${DAILY_MESSAGES[color]}\n\n` +
      `あなたのKINは: kinuranai.vercel.app`,
  });
}
