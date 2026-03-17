# Zenlogic 本番反映手順 (`menber.git.co.jp`)

## 1. 前提

本番公開先は次です。

- `https://menber.git.co.jp`

この手順は、Zenlogic 側で `menber.git.co.jp` のサブドメイン作成が完了している前提です。

## 2. 最初に確認すること

Zenlogic 側で次を必ず確認してください。

- Node.js アプリの常時実行が可能か
- `npm install / npm run build / npm run start` の運用が可能か
- `.env` などの環境変数設定方法があるか
- PostgreSQL へ外部接続できるか
- 永続ファイルとして `data/settings/` と `data/ui-settings.json` を保持できるか

## 3. 重要な注意

このアプリは Next.js アプリです。
そのため、PHP/静的 HTML 専用の一般的な共有ホスティングだけでは、そのまま動かせない可能性があります。

確認結果を次の 2 パターンで分けて考えてください。

### パターンA: Zenlogic 上で Node.js 実行が可能

そのまま `menber.git.co.jp` を本番として運用できます。

### パターンB: Zenlogic 上で Node.js 実行が不可

次のいずれかが必要です。

- Node.js 実行可能な別サーバーへ本体を置く
- `menber.git.co.jp` をリバースプロキシまたは転送先ドメインとして使う

## 4. 本番へ持っていくもの

### DB

- PostgreSQL 本番DB
- `DATABASE_URL`

### アプリ設定ファイル

- `data/settings/salary-structure.json`
- `data/settings/salary-simulation-adjustments.json`
- `data/ui-settings.json`

### ソース一式

- このリポジトリ一式

## 5. 本番反映の基本手順

Node.js 実行が可能な場合の想定手順です。

### 5-1. 環境変数設定

```env
DATABASE_URL="postgresql://user:password@host:5432/evaluation_system"
```

### 5-2. 依存関係インストール

```powershell
npm install
```

### 5-3. Prisma 生成

```powershell
npx prisma generate
```

### 5-4. DB 反映

migrate が整っていれば `migrate deploy`、暫定では `db push` を使います。

```powershell
npx prisma db push
```

### 5-5. 設定ファイル配置

次を本番ディレクトリへ配置します。

- `data/settings/salary-structure.json`
- `data/settings/salary-simulation-adjustments.json`
- `data/ui-settings.json`

### 5-6. ビルド

```powershell
npm run build
```

### 5-7. 起動

```powershell
npm run start
```

## 6. 初回確認項目

- `https://menber.git.co.jp/login` が表示される
- ログイン後に `メニュー` が表示される
- `理念実践管理` へ入れる
- 社員は `マイ評価結果` を見られる
- 年次昇給未確定時は参考値のみ表示される
- 組織設定、ユーザー管理、評価制度設定が表示される

## 7. バックアップ対象

本番運用では、DB に加えて次もバックアップ対象にしてください。

- `data/settings/`
- `data/ui-settings.json`

## 8. 本番切替前の最終実行

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

## 9. 推奨

Zenlogic 側の仕様が曖昧な場合は、先に `Node.js アプリ運用可否` だけ確認してから進めるのがおすすめです。
ここが不可の場合は、アプリ本体の配置先を別にした方が安全です。
