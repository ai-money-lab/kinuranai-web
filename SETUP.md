# KINURANAI セットアップ手順 (HIROKI操作用)

このドキュメントは、kinuranai のマネタイズフローを稼働させるためにHIROKIが手動で行う手順をまとめたものです。

## 全体像

```
[note無料記事] → [サイト無料診断] → [LINE登録] → [生年月日送信] → [KIN自動返信] → [AI鑑定¥1,980決済] → [鑑定文LINE配信] → [Zoom¥8,800オファー]
```

決済代行: **PAY.JP** (Stripe代替・占い・スピリチュアル業界の審査通過実績あり・GMO系)

---

## Step 1. LINE公式アカウント開設 (所要15分)

### 1-1. LINE Business アカウント作成
1. https://www.linebiz.com/jp/entry/ にアクセス
2. 「LINE公式アカウントを始める」→ メール+電話で登録
3. アカウント名: `KINURANAI` / カテゴリー: 占い・スピリチュアル

### 1-2. Messaging API 有効化
1. LINE Official Account Manager で対象アカウントを選択
2. 設定 → Messaging API → 「Messaging APIを利用する」
3. プロバイダー作成 (例: `ROCKEDGE`)
4. **Channel Secret** と **Channel Access Token** を控える

### 1-3. webhook URL 設定
1. LINE Developers Console → 該当チャネル → Messaging API設定
2. Webhook URL: `https://kinuranai.vercel.app/api/line-webhook`
3. Webhookの利用 = ON / 応答メッセージ = OFF
4. **検証ボタン押下** → 200 OK を確認

### 1-4. 友だち追加URL取得
1. LINE Official Account Manager → ホーム → 友だちを増やす
2. 「LINE友だち追加URL」(`https://lin.ee/xxxxx`) をコピー
3. 後で env `LINE_OFFICIAL_URL` に設定

---

## Step 2. PAY.JP 登録 (所要30〜60分)

**Why PAY.JP**: Stripeは占い/スピリチュアル業界で審査落ち多数。PAY.JPは占いコンテンツ業界での審査通過実績あり。GMOグループ運営で個人事業主でも開設可。

### 2-1. アカウント作成
1. https://pay.jp/ 「お申込み」→ メール+パスワードで登録
2. テスト環境APIキー (`pk_test_xxx` / `sk_test_xxx`) が即時発行される
3. **テスト環境で先に動作確認** → 本番審査申請の流れがおすすめ

### 2-2. テスト環境で動作確認
1. ダッシュボード → API → publishable key/secret key コピー
2. Vercel env に `PAYJP_PUBLIC_KEY=pk_test_xxx` / `PAYJP_SECRET_KEY=sk_test_xxx` 一旦セット
3. https://kinuranai.vercel.app/checkout.html?product=ai_divination&kin=47 を開く
4. テストカード `4242 4242 4242 4242 / 12/34 / 123` で決済
5. LINE 連携も含めて動作確認

### 2-3. 本番環境申請
1. ダッシュボード → 設定 → 本人確認・事業者情報入力
2. 本人確認書類 (運転免許証等) アップロード
3. 売上入金口座登録
4. **業種選択**: 「コンテンツ販売 (占い・診断系)」
5. 審査期間 約3-7営業日

### 2-4. プラン作成 (月額用・本番審査通過後)
1. ダッシュボード → 商品 → プラン → 新規作成
2. 名前: `月額KINニュースレター` / 金額: `1100` / 通貨: JPY / 期間: 月
3. 作成後の `plan_xxxxx` を `PAYJP_PLAN_MONTHLY_NEWS` env に設定
4. 一括決済 (¥1,980 AI鑑定 / ¥8,800 Zoom) は **プラン不要** (charge直接作成)

### 2-5. Webhook 設定
1. ダッシュボード → Webhook → エンドポイント追加
2. URL: `https://kinuranai.vercel.app/api/payjp-webhook`
3. シグネチャ用シークレット文字列を生成 (例: `openssl rand -hex 32`)
4. Webhook secret を Vercel env `PAYJP_WEBHOOK_SECRET` に設定
5. イベント選択: `subscription.renewed` / `subscription.deleted` / `charge.refunded`

---

## Step 3. Vercel env 設定 (所要10分)

1. https://vercel.com/ai-money-lab/kinuranai-web/settings/environment-variables
2. 以下のすべてを Production / Preview / Development にチェックして追加:

```
LINE_CHANNEL_SECRET = (Step 1-2 で取得)
LINE_CHANNEL_ACCESS_TOKEN = (Step 1-2 で取得)
LINE_OFFICIAL_URL = https://lin.ee/xxxxx (Step 1-4)

PAYJP_PUBLIC_KEY = pk_live_xxx (Step 2-3 本番)
PAYJP_SECRET_KEY = sk_live_xxx (Step 2-3 本番)
PAYJP_WEBHOOK_SECRET = (Step 2-5 で生成した hex)
PAYJP_PLAN_MONTHLY_NEWS = plan_xxx (Step 2-4)

ANTHROPIC_API_KEY = sk-ant-xxx (HIROKIが既に持っているはず)
CLAUDE_MODEL = claude-sonnet-4-5

PUBLIC_BASE_URL = https://kinuranai.vercel.app
INTERNAL_API_SECRET = (任意のランダム文字列・openssl rand -hex 32 等で生成)
```

3. すべて保存後 → Vercel が自動再デプロイ

---

## Step 4. checkout.html の publishable key 差し替え (所要2分)

PAY.JP Checkout iframeは publishable key をフロント側に埋め込む必要あり。

```bash
cd C:/Users/mauloa/Projects/kinuranai-web
# pk_test_PLACEHOLDER_REPLACE_AT_DEPLOY を実publishable keyに置換
sed -i 's|pk_test_PLACEHOLDER_REPLACE_AT_DEPLOY|pk_live_実キー|g' checkout.html
git add checkout.html
git commit -m "fix: replace PAY.JP public key with production"
git push origin master
```

(または index.html の手前で `<script>window.PAYJP_PK_OVERRIDE = 'pk_live_xxx'</script>` を挿入)

---

## Step 5. index.html の LINE URL 差し替え (所要2分)

現在 `https://lin.ee/kinuranai` プレースホルダー。Step 1-4 で取得した実URLに差し替え:

```bash
cd C:/Users/mauloa/Projects/kinuranai-web
sed -i 's|https://lin.ee/kinuranai|https://lin.ee/REAL_URL|g' index.html
git add index.html
git commit -m "fix: replace LINE URL with real account"
git push origin master
```

---

## Step 6. 動作確認

### 6-1. LINE Bot
1. LINE で `KINURANAI` 公式アカウントを友だち追加
2. メッセージ「1990年3月15日」を送信
3. KIN番号+紋章+音 + AI鑑定¥1,980オファーが返ってくれば成功

### 6-2. PAY.JP checkout
1. AI鑑定オファー内のリンクをタップ
2. checkout.html が開き商品名+金額+カード入力フォーム表示
3. テストカード `4242 4242 4242 4242 / 12/34 / 123` で決済 (テスト環境)
4. 成功 → 「✅ 決済が完了しました」表示 + LINE で鑑定文届く

### 6-3. note → サイト誘導
1. https://note.com/kinuranai/n/ncc964f72c302 (flagship#01) を開く
2. 末尾の「無料診断・マガジンで深める」セクションから kinuranai.vercel.app へ
3. 個人診断結果ページの「深層鑑定」ボタンから LINE登録URL へ

---

## 期待される収益フロー (Phase A 5月末まで)

```
1日100PV (note SEO + IG経由)
  ↓ (10%登録)
1日10人 LINE登録 → 月300人
  ↓ (10%購入)
月30件 AI鑑定 ¥1,980 = ¥59,400/月
  ↓ (10%が更にZoom)
月3件 Zoom鑑定 ¥8,800 = ¥26,400/月
  ↓
月額ニュースレター 30件 ¥1,100 = ¥33,000/月

合計 約¥118,800/月 (Phase A完成時)
```

PAY.JP 手数料 3.0% を引くと実収益は約 **¥115,200/月**。

---

## トラブルシューティング

- **LINE webhook が 401 を返す** → LINE_CHANNEL_SECRET が違う or env未反映
- **PAY.JP charge 503** → PAYJP_SECRET_KEY 未設定
- **checkout.html ボタンが出ない** → publishable key が `pk_test_PLACEHOLDER` のまま
- **鑑定文がLINEに届かない** → INTERNAL_API_SECRET 未設定 or LINE_CHANNEL_ACCESS_TOKEN 未設定
- **PAY.JP 審査が通らない** → 業種を「コンテンツ販売」にし「占い」と明記+免責事項追加で再申請
- **ANTHROPIC_API_KEY 余計に消費** → CLAUDE_MODEL を `claude-haiku-4-5` に切替で1/3コスト

---

## 補足: PAY.JP Checkout iframe の挙動

- このプロジェクトでは `checkout.html` がハイブリッド型 (静的HTML + payjp.js iframe) を採用
- カード番号は **payjp.js が直接 PAY.JP サーバへ送信** → トークンのみ当サイト経由
- PCI DSS は PAY.JP 側が責任を持つため当サイト側でのカード情報保管なし
- LINE アプリ内ブラウザでも動作 (iframe対応)

---

最終更新: 2026-05-01 (Stripe → PAY.JP 切替版)
