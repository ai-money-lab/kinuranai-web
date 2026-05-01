# KINURANAI セットアップ手順 (HIROKI操作用)

このドキュメントは、kinuranai のマネタイズフローを稼働させるためにHIROKIが手動で行う手順をまとめたものです。

## 全体像

```
[note無料記事] → [サイト無料診断] → [LINE登録] → [生年月日送信] → [KIN自動返信] → [AI鑑定¥1,980決済] → [鑑定文LINE配信] → [Zoom¥8,800オファー]
```

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

## Step 2. Stripe アカウント開設 (所要30分)

### 2-1. Stripe登録
1. https://dashboard.stripe.com/register にアクセス
2. メール+ビジネス情報入力
3. 本人確認書類アップロード (運転免許証等)
4. 入金先口座登録

### 2-2. 商品作成
Dashboard → 商品 → 商品を追加 で **3商品** 登録:

**商品1: KIN AI文字鑑定**
- 価格: ¥1,980 (一括)
- 「価格IDをコピー」 → `STRIPE_PRICE_AI_DIVINATION`

**商品2: KIN Zoom個人鑑定 60分**
- 価格: ¥8,800 (一括)
- 「価格IDをコピー」 → `STRIPE_PRICE_ZOOM_60MIN`

**商品3: 月額KINニュースレター**
- 価格: ¥1,100 / 月 (定期支払い)
- 「価格IDをコピー」 → `STRIPE_PRICE_MONTHLY_NEWS`

### 2-3. APIキー取得
1. Dashboard → 開発者 → APIキー
2. **シークレットキー** (`sk_live_xxx`) をコピー → `STRIPE_SECRET_KEY`

### 2-4. Webhook 設定
1. Dashboard → 開発者 → Webhook → エンドポイントを追加
2. URL: `https://kinuranai.vercel.app/api/stripe-webhook`
3. イベント: `checkout.session.completed`
4. 「シグネチャシークレット」(`whsec_xxx`) をコピー → `STRIPE_WEBHOOK_SECRET`

---

## Step 3. Vercel env 設定 (所要10分)

1. https://vercel.com/ai-money-lab/kinuranai-web/settings/environment-variables
2. 以下のすべてを Production / Preview / Development すべてにチェックして追加:

```
LINE_CHANNEL_SECRET = (Step 1-2 で取得)
LINE_CHANNEL_ACCESS_TOKEN = (Step 1-2 で取得)
LINE_OFFICIAL_URL = https://lin.ee/xxxxx (Step 1-4)

STRIPE_SECRET_KEY = sk_live_xxx (Step 2-3)
STRIPE_WEBHOOK_SECRET = whsec_xxx (Step 2-4)
STRIPE_PRICE_AI_DIVINATION = price_xxx (Step 2-2 商品1)
STRIPE_PRICE_ZOOM_60MIN = price_xxx (Step 2-2 商品2)
STRIPE_PRICE_MONTHLY_NEWS = price_xxx (Step 2-2 商品3)

ANTHROPIC_API_KEY = sk-ant-xxx (HIROKIが既に持っているはず)
CLAUDE_MODEL = claude-sonnet-4-5

PUBLIC_BASE_URL = https://kinuranai.vercel.app
INTERNAL_API_SECRET = (任意のランダム文字列・openssl rand -hex 32 等で生成)
```

3. すべて保存後 → Vercel が自動再デプロイ

---

## Step 4. index.html の LINE URL 差し替え (所要5分)

現在 `https://lin.ee/kinuranai` プレースホルダー。Step 1-4 で取得した実URLに差し替え:

```bash
cd C:/Users/mauloa/Projects/kinuranai-web
# https://lin.ee/kinuranai を実URLに置換
sed -i 's|https://lin.ee/kinuranai|https://lin.ee/REAL_URL|g' index.html
git add index.html
git commit -m "fix: replace LINE URL with real account"
git push origin master
```

---

## Step 5. 動作確認

### 5-1. LINE Bot
1. LINE で `KINURANAI` 公式アカウントを友だち追加
2. メッセージ「1990年3月15日」を送信
3. KIN番号+紋章+音 + AI鑑定¥1,980オファーが返ってくれば成功

### 5-2. Stripe checkout
1. AI鑑定オファー内のリンクをタップ
2. Stripe checkout が開く
3. テストカード `4242 4242 4242 4242 / 12/34 / 123` で決済
4. 成功 → サイトに `?paid=1` で戻る + LINE で鑑定文が届く

### 5-3. note → サイト誘導
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

---

## トラブルシューティング

- **LINE webhook が 400 を返す** → Channel Secret が違う or env未反映
- **Stripe checkout が 503** → STRIPE_PRICE_xxx が未設定
- **鑑定文がLINEに届かない** → STRIPE_WEBHOOK_SECRET / INTERNAL_API_SECRET 未設定
- **ANTHROPIC_API_KEY 余計に消費** → CLAUDE_MODEL を `claude-haiku-4-5` に切替で1/3コスト

---

最終更新: 2026-05-01
