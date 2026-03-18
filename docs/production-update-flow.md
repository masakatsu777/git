# 本番更新手順

ConoHa VPS 上の本番環境を更新するときの最小手順です。  
基本は `ローカル修正 -> GitHub push -> ConoHa pull -> build -> restart` です。

## 1. ローカルPCで修正

```powershell
npm run lint
npx tsc --noEmit
git add .
git commit -m "修正内容"
git push
```

## 2. ConoHa で更新反映

```bash
cd /root/app
git pull
npm install
set -a
source .env
set +a
npx prisma generate
npm run build
pm2 restart git-evaluation
```

## 3. DB スキーマ変更がある場合

`schema.prisma` を変えたときは、build 前にこれを追加します。

```bash
npx prisma db push
```

反映順:

```bash
cd /root/app
git pull
npm install
set -a
source .env
set +a
npx prisma generate
npx prisma db push
npm run build
pm2 restart git-evaluation
```

## 4. JSON 設定ファイルを変えた場合

このアプリは一部設定をファイル保存しています。以下を変更したときは、GitHub に含めて更新してください。

- `data/settings/salary-structure.json`
- `data/settings/salary-simulation-adjustments.json`
- `data/settings/user-menu-visibility.json`
- `data/ui-settings.json`

## 5. 更新後の確認

```bash
pm2 status
pm2 logs git-evaluation --lines 30
curl http://127.0.0.1/login
```

ブラウザ確認:

- `/login` が開く
- ログインできる
- `/menu` が表示される
- 理念実践管理が開ける

## 6. ロールバックの考え方

更新後に不具合が出たら、前のコミットへ戻して再 build します。

```bash
cd /root/app
git log --oneline -5
git checkout <戻したいコミット>
npm install
set -a
source .env
set +a
npx prisma generate
npm run build
pm2 restart git-evaluation
```

DB 変更を含む場合は、単純ロールバック前に影響確認が必要です。

## 7. 補足

- `pm2 restart git-evaluation` だけでは新 build は反映されません。`npm run build` を先に実行してください。
- `.env` は Git に含めず、ConoHa 側で維持します。
- Prisma 周りのエラーが出たら、`generated/prisma` を削除してから `npx prisma generate` をやり直すと直ることがあります。
