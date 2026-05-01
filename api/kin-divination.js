// AI KIN鑑定 (Claude API) — Stripe決済完了後にLINE Bot経由で配信される鑑定文を生成
// 呼び出し: POST /api/kin-divination { kin: 47, birthdate: "1990-03-15" }
// 認証: x-internal-secret ヘッダー (LINE webhook handler 側からのみ許可)

import Anthropic from '@anthropic-ai/sdk';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SEAL_NAMES = [
  '', '赤い龍', '白い風', '青い夜', '黄色い種', '赤い蛇',
  '白い世界の橋渡し', '青い手', '黄色い星', '赤い月', '白い犬',
  '青い猿', '黄色い人', '赤い空歩く人', '白い魔法使い', '青い鷲',
  '黄色い戦士', '赤い地球', '白い鏡', '青い嵐', '黄色い太陽',
];

function buildPrompt(kin, birthdate) {
  const seal = ((kin - 1) % 20) + 1;
  const tone = ((kin - 1) % 13) + 1;
  const hiddenKin = 261 - kin;
  const hiddenSeal = ((hiddenKin - 1) % 20) + 1;
  return (
    `あなたはマヤ暦KIN占いの鑑定士です。以下の情報をもとに、${birthdate}生まれのKIN${kin}「${SEAL_NAMES[seal]}」の方への深層鑑定を5項目で書いてください。\n\n` +
    `## 鑑定項目（各2-3文・断定口調・占い読者女性27-38歳向け）\n` +
    `1. 2026年下半期に訪れる3つの大きな転機（具体的な月を含めて）\n` +
    `2. 「運命の人」と出会うタイミング（年齢ではなく時期で）\n` +
    `3. 仕事で開花する才能と、注意すべき落とし穴\n` +
    `4. 金運の波と最適な投資・貯蓄のタイミング\n` +
    `5. 裏KIN（KIN${hiddenKin}「${SEAL_NAMES[hiddenSeal]}」）が示す、あなたの隠れた才能\n\n` +
    `## ルール\n` +
    `- 各項目は番号付きで、見出しは太字\n` +
    `- 「〜かもしれません」「〜でしょう」禁止\n` +
    `- 出典・引用は不要（占いとして書く）\n` +
    `- 全体で500-700字程度\n` +
    `- 日本語のみ`
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!anthropic) return res.status(503).json({ error: 'Anthropic not configured' });

  // 内部認証
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret && req.headers['x-internal-secret'] !== internalSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { kin, birthdate } = req.body || {};
  if (!kin || kin < 1 || kin > 260) return res.status(400).json({ error: 'Invalid kin' });

  try {
    const message = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: buildPrompt(kin, birthdate || '不明') }],
    });
    const text = message.content[0].text;
    return res.status(200).json({ kin, divination: text });
  } catch (e) {
    console.error('claude error:', e);
    return res.status(500).json({ error: e.message });
  }
}
