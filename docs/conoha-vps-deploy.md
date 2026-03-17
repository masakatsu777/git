# ConoHa VPS 本番反映手順

この手順は、ConoHa VPS 上に本アプリを本番配置するための最短構成です。  
対象は `Next.js + Prisma + PostgreSQL` 構成で、Node.js を常駐実行する前提です。

## 前提

- ConoHa VPS を契約済み
- Ubuntu 系 OS を利用
- SSH 接続できる
- PostgreSQL を同居または外部で利用できる
- ここでは PostgreSQL を同居させる前提で説明します
- GitHub などから本リポジトリを取得できる

## おすすめ構成

- アプリ実行: `Node.js + PM2`
- リバースプロキシ: `Nginx`
- DB: `PostgreSQL`
- SSL: `Let's Encrypt`

## 1. 初期セットアップ

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y nginx git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Node と npm の確認:

```bash
node -v
npm -v
pm2 -v
```

## 2. PostgreSQL 同居セットアップ

PostgreSQL を同じ VPS に入れます。

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

初期ユーザーとDB作成例:

```bash
sudo -u postgres psql
```

```sql
CREATE USER evaluation_app WITH PASSWORD 'strong-password';
CREATE DATABASE evaluation_system OWNER evaluation_app;
GRANT ALL PRIVILEGES ON DATABASE evaluation_system TO evaluation_app;
\q
```

接続確認:

```bash
psql postgresql://evaluation_app:strong-password@127.0.0.1:5432/evaluation_system -c "SELECT 1;"
```

## 3. アプリ配置

任意の配置先へ clone します。

```bash
git clone <your-repository-url> app
cd app
npm install
```

## 4. 環境変数設定

`.env` を作成します。

```env
DATABASE_URL="postgresql://evaluation_app:strong-password@127.0.0.1:5432/evaluation_system"
NODE_ENV="production"
PORT=3000
```

このアプリで最低限必要なのは、現時点では `DATABASE_URL` です。  
`PORT` は Nginx から受けるアプリ側ポートを明示したい場合に指定します。

作成例:

```bash
cp .env.example .env
nano .env
```

入力後の確認:

```bash
cat .env
```

注意:

- `DATABASE_URL` が未設定だと Prisma が起動できません。
- 本番サーバーでは `.env` を Git 管理に含めないでください。
- 将来認証用の秘密鍵やメール設定を追加する場合も `.env` に寄せます。

## 5. Prisma 反映

```bash
npx prisma generate
npx prisma db push
```

マイグレーション運用に切り替える場合は `db push` の代わりに `migrate deploy` を使います。

## 6. 設定ファイル持ち込み

このアプリは一部設定を JSON に保存しています。以下を本番へ持ち込んでください。

- `data/settings/salary-structure.json`
- `data/settings/salary-simulation-adjustments.json`
- `data/settings/user-menu-visibility.json`
- `data/ui-settings.json`

開発環境の内容をそのまま反映する場合は、同じパスへ配置します。

## 7. ビルドと起動

```bash
npm run build
pm2 start npm --name git-evaluation -- start
pm2 save
pm2 startup
```

確認:

```bash
pm2 status
pm2 logs git-evaluation
```

アプリの疎通確認:

```bash
curl http://127.0.0.1:3000/login
```

HTML が返れば、Node.js 側は起動しています。

## 7.5 初回反映コマンドまとめ

初回だけまとめて実行するなら、順番はこの通りです。

```bash
git clone <your-repository-url> app
cd app
npm install
cp .env.example .env
nano .env
psql postgresql://evaluation_app:strong-password@127.0.0.1:5432/evaluation_system -c "SELECT 1;"
npx prisma generate
npx prisma db push
npm run build
pm2 start npm --name git-evaluation -- start
pm2 save
```

JSON 設定ファイルを持ち込む場合は、このあとで `data/` 配下へ配置してください。

## 8. Nginx 設定

`/etc/nginx/sites-available/git-evaluation` を作成します。

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

有効化:

```bash
sudo ln -s /etc/nginx/sites-available/git-evaluation /etc/nginx/sites-enabled/git-evaluation
sudo nginx -t
sudo systemctl restart nginx
```

## 9. SSL 設定

独自ドメインを使う場合は `certbot` を入れて SSL 化します。

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <your-domain>
```

## 10. 初回確認

以下を通しで確認します。

- `/login` に入れる
- `/menu` が表示される
- `理念実践管理` 対象者だけ評価画面へ入れる
- `/settings/users` でユーザー管理できる
- `/salary/simulations` で参考額が出る
- JSON 設定値が本番へ反映されている

## 11. 更新手順

```bash
cd app
git pull
npm install
npx prisma generate
npm run build
pm2 restart git-evaluation
```

スキーマ変更があるときは `npx prisma db push` または `npx prisma migrate deploy` を追加します。

## 12. 補足

- ConoHa VPS では Node.js 常駐運用ができるので、本アプリ構成と相性が良いです。
- 将来的には JSON 保存設定を DB 化すると、バックアップと移行がさらに簡単になります。
- 本番前の業務確認は `docs/pre-release-checklist.md` も合わせて使ってください。
