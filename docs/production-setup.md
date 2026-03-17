# 本番準備ガイド

## 0. 本番URL

- 本番公開先: `https://menber.git.co.jp`
- 想定利用: 社内向け本番環境


## 1. 先に押さえること

このシステムは、設定がすべて DB に入る構成ではありません。
本番へ移すときは次の 2 系統を両方そろえる必要があります。

- PostgreSQL の DB データ
- アプリ配下の JSON 設定ファイル

特に次のファイルは本番へ引き継ぎが必要です。

- `data/settings/salary-structure.json`
  - 自律成長基準額
  - 協調相乗基準額
  - 粗利補正
- `data/settings/salary-simulation-adjustments.json`
  - 昇給シミュレーションの調整理由
- `data/ui-settings.json`
  - UI 文言設定

## 2. 本番環境に用意するもの

- Node.js 20 以上
- PostgreSQL
- `.env` または本番環境変数
- アプリ配置先ディレクトリ
- 上記 JSON 設定ファイル

最低限必要な環境変数:

```env
DATABASE_URL="postgresql://user:password@host:5432/evaluation_system"
```

## 3. 事前バックアップ

本番反映前に、開発または移行元環境で次をバックアップしてください。

- DB ダンプ
- `data/settings/` 配下
- `data/ui-settings.json`

## 4. 本番反映手順

### 4-1. ソース配置

```powershell
npm install
```

### 4-2. Prisma 生成

```powershell
npx prisma generate
```

### 4-3. スキーマ反映

本番では `prisma migrate deploy` が理想です。
まだ migrate を整えていない場合は、暫定で `db push` を使います。

```powershell
npx prisma db push
```

## 5. 設定ファイル反映

次のファイルを本番環境へ配置します。

- `data/settings/salary-structure.json`
- `data/settings/salary-simulation-adjustments.json`
- `data/ui-settings.json`

未配置だと以下になります。

- `salary-structure.json` 未配置
  - デフォルト給与構成で動作
- `salary-simulation-adjustments.json` 未配置
  - 調整理由が空として扱われる
- `ui-settings.json` 未配置
  - デフォルト文言で動作

## 6. 初期データ投入

本番初回のみ、必要に応じて seed を使います。

```powershell
npm run db:seed
```

注意:
- 既に本番データがある環境では、seed の実行内容を確認してから実施してください。
- 既存データ上書きの可能性があるため、無条件実行は避けてください。

## 7. ビルドと起動

```powershell
npm run build
npm run start
```

## 8. 本番確認ポイント

### ログイン

- ログインできる
- ロール別にメニューが正しい

### 評価

- 自己評価が表示される
- 上長評価、最終評価が権限どおり表示される
- 社員は `マイ評価結果` を見られる

### 昇給

- 昇給シミュレーションが表示される
- `新月額(参考)` が表示される
- 調整理由が保持される
- 結果一覧、個人詳細が表示される

### 組織

- 組織設定が表示される
- 未所属メンバーが見える
- チーム割当ができる

## 9. OneDrive 利用時の注意

開発時に OneDrive 配下で `.next` や Prisma エンジン DLL がロックされることがあります。
本番配置先は OneDrive 同期対象外にするのを推奨します。

ロックが出た場合の開発復旧例:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force .next
npx prisma generate
npm run dev
```

## 10. 現時点の本番運用上の注意

- 一部設定は DB ではなく JSON ファイル保存です
- 本番向け認証基盤は未接続です
- 通知やワークフロー連携は未実装です

## 11. 推奨の本番前最終実行

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

上記が通ってから本番反映するのがおすすめです。
