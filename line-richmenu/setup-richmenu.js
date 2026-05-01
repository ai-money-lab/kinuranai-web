// LINE Rich Menu 自動セットアップ
// 使い方:
//   1. line-richmenu/rich-menu.png (2500x1686) を用意
//   2. .env で LINE_CHANNEL_ACCESS_TOKEN セット
//   3. node line-richmenu/setup-richmenu.js
//
// 1ファイル完結で richMenu 作成→画像upload→全ユーザー適用 を行う

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { messagingApi } from '@line/bot-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('LINE_CHANNEL_ACCESS_TOKEN が未設定');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'rich-menu.json'), 'utf-8'));
// _comment / _setup_steps / _label を除去
delete config._comment;
delete config._setup_steps;
config.areas = config.areas.map(({ _label, ...rest }) => rest);

const imagePath = path.join(__dirname, 'rich-menu.png');
if (!fs.existsSync(imagePath)) {
  console.error(`rich-menu.png が見つかりません: ${imagePath}`);
  console.error('Canva等で 2500x1686px の画像を作成して保存してください');
  process.exit(1);
}

const apiClient = new messagingApi.MessagingApiClient({ channelAccessToken: TOKEN });
const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken: TOKEN });

async function main() {
  console.log('1. richMenu 作成中...');
  const created = await apiClient.createRichMenu(config);
  const richMenuId = created.richMenuId;
  console.log(`   richMenuId: ${richMenuId}`);

  console.log('2. 画像 upload 中...');
  const imageBlob = new Blob([fs.readFileSync(imagePath)], { type: 'image/png' });
  await blobClient.setRichMenuImage(richMenuId, imageBlob);
  console.log('   画像 OK');

  console.log('3. 全ユーザーにデフォルト適用中...');
  await apiClient.setDefaultRichMenu(richMenuId);
  console.log('   適用 OK');

  console.log('\n完了。LINE Bot に表示されているはずです。');
  console.log(`削除: curl -X DELETE -H "Authorization: Bearer $TOKEN" https://api.line.me/v2/bot/richmenu/${richMenuId}`);
}

main().catch((e) => {
  console.error('FAILED:', e.originalError?.response?.data || e);
  process.exit(1);
});
