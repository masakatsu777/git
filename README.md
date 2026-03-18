# ITエンジニア評価・チーム収益管理システム

社内向けの IT エンジニア評価、チーム月次 PL、粗利差異可視化、昇給シミュレーションを扱う Web システムです。  
Next.js App Router と Prisma を使って、評価と収益管理を同じ基盤で運用できる構成にしています。

## 技術スタック

- Next.js 16
- TypeScript
- Prisma
- PostgreSQL
- Tailwind CSS 4

## 実装済みの主な機能

### 1. 月次PL / 収益管理

- 月次ダッシュボード
- チーム別月次PL表示
- 売上明細入力
- 外注費明細入力
- 採用教育費 / その他経費のチーム単位入力
- 全社固定費入力
- 社員人数比による固定費按分
- 明細保存後の自動再計算
- 粗利目標率と実績差異の表示

### 2. 社員コスト / 売上設定

- 社員コスト入力
- 社員ごとの基本給、手当、社保、その他固定費管理
- 社員売上の基準値設定
- パートナー売上の基準値設定
- パートナー外注費の基準値設定
- 社員コストからの人件費自動集計
- 総合等級別の昇給ルール設定
- 期待充足ランク別の昇給ルール設定

### 3. 半期評価

- 自己評価入力
- 上長評価入力
- 最終評価確定
- 評価コメント保存
- 自己評価、上長評価、最終評価の比較表示

### 4. 昇給シミュレーション

- 最終評価済み社員を対象にした昇給シミュレーション
- 昇給率、昇給額、新月額の調整
- シミュレーション保存
- 社長承認
- 社員コストへの反映

### 5. 権限制御

- 社員、リーダー、管理者、社長ロール
- RBAC ベースの権限制御
- チームスコープ制御

## 評価制度ルール

- 評価の2軸は `自律成長力` と `協調相乗力` 
- `自律成長力` は 1: 完全ではないができる / 2: 問題なくできる
- `協調相乗力` は 0: 継続実践には至っていない / 1: 継続実践できている
- `協調相乗力` は項目ごとの重みを使って実施率を計算
- 等級は `自律成長等級`、`協調相乗等級`、`総合等級` で管理

## 業務ルール

### 固定費・経費

- 固定費: 全社入力
- 固定費按分: 社員人数比でチーム配賦
- 採用教育費: チーム単位入力
- その他経費: チーム単位入力

### 人件費・売上

- 社員コストは `salary_records` で管理
- 月次PLの人件費は社員コストと所属チームから自動集計
- 売上入力時は社員 / パートナーの売上基準値を初期値として利用
- パートナー外注費入力時は外注費基準値を初期値として利用

## 本番前チェック

- [本番前チェックリスト](./docs/pre-release-checklist.md)
- [本番準備ガイド](./docs/production-setup.md)
- [ConoHa VPS 本番反映手順](./docs/conoha-vps-deploy.md)
- [本番更新手順](./docs/production-update-flow.md)
- [Zenlogic 本番反映手順 (`menber.git.co.jp`)](./docs/zenlogic-menber-git-co-jp.md)

## 主な画面

- `/dashboard`
- `/pl/monthly`
- `/settings/fixed-costs`
- `/settings/salary-records`
- `/settings/rates`
- `/settings/skill-careers` (評価制度設定)
- `/settings/overall-grade-salary-rules`
- `/settings/salary-revision-rules`
- `/settings/users`
- `/settings/audit-logs`
- `/evaluations/my`
- `/evaluations/team`
- `/evaluations/finalize`
- `/salary/simulations`
- `/login`

## 主なAPI

### PL

- `GET /api/pl/dashboard`
- `GET /api/pl/monthly?teamId=team-platform&yearMonth=2026-03`
- `POST /api/pl/monthly`
- `GET /api/pl/details?teamId=team-platform&yearMonth=2026-03`
- `POST /api/pl/details`
- `GET /api/pl/fixed-costs?yearMonth=2026-03`
- `POST /api/pl/fixed-costs`
- `POST /api/pl/recalculate/team-platform?yearMonth=2026-03`

### 社員コスト / 売上

- `GET /api/salary-records`
- `POST /api/salary-records`
- `GET /api/rate-settings`
- `POST /api/rate-settings`

### 評価

- `GET /api/evaluations/my`
- `POST /api/evaluations/my`
- `GET /api/evaluations/team`
- `POST /api/evaluations/team`
- `GET /api/evaluations/final`
- `POST /api/evaluations/final`

### 昇給シミュレーション

- `GET /api/salary-simulations`
- `POST /api/salary-simulations`
- `POST /api/salary-simulations/approve`
- `POST /api/salary-simulations/apply`

## セットアップ

### DB ありで使う場合

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

`.env` には最低限以下を設定してください。

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/evaluation_system"
```

### DB なしで画面確認だけする場合

`DATABASE_URL` が未設定でも、ログイン画面はデモユーザーに自動フォールバックします。  
この場合は一部の一覧や保存処理がプレビュー動作になりますが、画面遷移や基本操作の確認は可能です。

デモログイン情報:

- `DEMO-1` / `password` : 社長
- `DEMO-2` / `password` : 管理者
- `DEMO-3` / `password` : リーダー
- `DEMO-4` / `password` : 社員

起動手順:

```bash
npm install
npx prisma generate
npm run dev
```

開発サーバーは `http://localhost:3000` で起動します。

## seed データ

`prisma/seed.ts` では以下の初期データを投入します。

- ロール / 権限
- 部署 / チーム / 所属
- サンプル社員
- 評価期間 / スキル等級 / 評価項目
- 社員コスト
- 売上 / 外注費の基準値
- 月次PLサンプル明細
- 自己評価 / 上長評価 / 最終評価のサンプル

seed 後の確認用ログイン情報:

- `E0001` / `password`
- `E0002` / `password`
- `E1001` / `password`
- `E1002` / `password`
- `E1003` / `password`

## 現時点の制約

- 本番向け認証基盤までは未接続です
- DB 未接続時は一部画面でフォールバック表示があります
- 本番向けの承認監査や通知は未実装です

