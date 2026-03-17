# ITエンジニア評価・チーム収益管理システム 初期設計

## 1. DBスキーマ概要

### 業務ドメイン
- 認証・権限: `users`, `roles`, `permissions`, `role_permissions`
- 組織: `departments`, `positions`, `teams`, `team_memberships`
- 評価: `evaluation_periods`, `evaluation_items`, `employee_evaluations`, `evaluation_scores`, `skill_grade_definitions`
- 収益管理: `monthly_assignments`, `monthly_costs`, `team_monthly_pls`, `team_indirect_costs`, `fixed_cost_settings`, `fixed_cost_allocations`, `team_targets`
- 給与改定: `salary_records`, `salary_revision_rules`, `salary_revision_simulations`
- 監査: `approval_logs`, `audit_logs`

### 粗利計算ルール
- 1次粗利 = 売上合計 - (給与 + 社保等 + 外注費)
- 2次粗利 = 1次粗利 - チーム間接費
- 最終粗利 = 2次粗利 - 固定費配賦
- 粗利差異 = 実績粗利率 - 目標粗利率

## 2. ディレクトリ構成

```txt
src/
  app/
    (auth)/
      login/
    (dashboard)/
      dashboard/
      evaluations/
        periods/
        my/
        team/
        finalize/
      pl/
        monthly/
        targets/
        allocations/
      salary/
        simulations/
        revisions/
      master/
        employees/
        partners/
        teams/
        grades/
      settings/
        roles/
        fixed-costs/
    api/
      auth/
      users/
      teams/
      evaluations/
      pl/
      salary/
      masters/
  components/
    ui/
    forms/
    tables/
    charts/
    layout/
  features/
    auth/
    evaluations/
    pl/
    salary/
    master/
    permissions/
  lib/
    auth/
    prisma/
    permissions/
    calculations/
    validators/
    utils/
  types/
  constants/
prisma/
  schema.prisma
  seed.ts
docs/
  initial-design.md
README.md
```

## 3. 画面一覧

### 共通
- ログイン
- パスワード変更
- ダッシュボード

### 社員
- マイページ
- 自己評価入力
- 評価結果閲覧
- 昇給シミュレーション閲覧

### リーダー
- チームメンバー一覧
- 上長評価入力
- 月次PL入力
- チーム間接費入力
- チーム目標設定
- チーム粗利差異確認

### 管理者
- 社員マスタ
- パートナーマスタ
- チームマスタ
- 等級マスタ
- 評価項目マスタ
- 固定費設定
- 固定費配賦確認
- 給与・社保入力
- 外注費入力
- 売上単価入力
- 半期評価確定
- 昇給シミュレーション調整
- 給与改定確定

### 社長
- 全社サマリー
- チーム別PL比較
- 最終評価承認
- 昇給案承認

## 4. API一覧

### 認証
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 組織・マスタ
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:id`
- `PATCH /api/users/:id`
- `GET /api/teams`
- `POST /api/teams`
- `PATCH /api/teams/:id`
- `GET /api/partners`
- `POST /api/partners`

### 評価
- `GET /api/evaluation-periods`
- `POST /api/evaluation-periods`
- `GET /api/evaluations/my`
- `POST /api/evaluations/my`
- `GET /api/evaluations/team?periodId=`
- `PATCH /api/evaluations/:id/manager-review`
- `PATCH /api/evaluations/:id/final-review`
- `POST /api/evaluations/:id/finalize`
- `GET /api/evaluation-items`
- `POST /api/evaluation-items`

### PL
- `GET /api/pl/monthly?teamId=&yearMonth=`
- `POST /api/pl/monthly`
- `PATCH /api/pl/monthly/:id`
- `POST /api/pl/recalculate/:teamId`
- `GET /api/pl/targets`
- `POST /api/pl/targets`
- `GET /api/pl/dashboard`
- `POST /api/pl/indirect-costs`
- `POST /api/pl/fixed-cost-settings`
- `POST /api/pl/fixed-cost-allocations/execute`

### 原価・単価
- `GET /api/assignments`
- `POST /api/assignments`
- `PATCH /api/assignments/:id`
- `GET /api/costs`
- `POST /api/costs`
- `PATCH /api/costs/:id`

### 給与改定
- `GET /api/salary-records`
- `POST /api/salary-records`
- `GET /api/salary-simulations?periodId=`
- `POST /api/salary-simulations/generate`
- `PATCH /api/salary-simulations/:id`
- `POST /api/salary-simulations/:id/approve`
- `POST /api/salary-simulations/:id/apply`

## 5. 権限制御設計

### 基本方針
- ロールベース制御は `RBAC`
- 閲覧・更新対象は `team scope` で追加制御
- API側で必ず再判定する

### ロール別権限
- `employee`: 自分の評価入力、自分の評価閲覧、自チームPL閲覧
- `leader`: 自チーム評価入力、自チームPL入力、自チーム目標管理
- `admin`: 全マスタ管理、給与原価管理、評価確定、昇給シミュレーション管理
- `president`: 全社閲覧、最終評価承認、昇給最終承認

### 代表的な permission code
- `evaluation:self:write`
- `evaluation:team:write`
- `evaluation:finalize`
- `pl:team:read`
- `pl:team:write`
- `pl:all:read`
- `cost:write`
- `salary:read`
- `salary:write`
- `salary:approve`
- `master:write`

## 6. 画面ワイヤーフレーム

### 月次ダッシュボード
```txt
+------------------------------------------------------+
| 月次ダッシュボード  2026-03                          |
+------------------------------------------------------+
| 売上合計 | 1次粗利 | 2次粗利 | 最終粗利 | 粗利率差異 |
+------------------------------------------------------+
| チーム別PL一覧                                       |
| Team A | 売上 | 最終粗利 | 目標率 | 実績率 | 差異     |
| Team B | 売上 | 最終粗利 | 目標率 | 実績率 | 差異     |
+------------------------------------------------------+
| 評価進捗                                             |
| 自己評価済 | 上長評価済 | 最終確定済                 |
+------------------------------------------------------+
```

### 半期評価入力
```txt
+------------------------------------------------------+
| 半期評価入力                                         |
+------------------------------------------------------+
| 社員: 開発 一郎   期間: 2025年度下期                 |
| 自律成長等級: SG2   協調相乗等級: KG2                 |
+------------------------------------------------------+
| 項目             | 自己評価 | 上長評価 | 最終評価    |
| 設計力           |    4     |    4     |    4        |
| 実装力           |    5     |    4     |    4        |
| 顧客対応         |    3     |    4     |    4        |
| チーム貢献       |    4     |    4     |    4        |
+------------------------------------------------------+
| コメント欄                                           |
+------------------------------------------------------+
| [保存] [提出] [確定]                                 |
+------------------------------------------------------+
```

### 昇給シミュレーション
```txt
+------------------------------------------------------+
| 昇給シミュレーション                                 |
+------------------------------------------------------+
| 社員名   | 現給与 | 評価 | 昇給額 | 昇給率 | 新給与   |
| 一郎     | 360000 | A    | 12000  | 3.33%  | 372000   |
| 二郎     | 340000 | B+   |  8000  | 2.35%  | 348000   |
+------------------------------------------------------+
| [自動計算] [個別調整] [承認申請]                     |
+------------------------------------------------------+
```

## 7. 評価制度方針

- 理念に基づき、評価軸は 自律成長力 と 協調相乗力 の2つとする
- 自律成長力 は職務遂行に必要な成長と実践の力を評価する
- 協調相乗力 は他者と力を掛け合わせて価値を広げる継続実践を評価する
- 自律成長力 は 1 / 2 評価、協調相乗力 は継続実践の 0 / 1 評価とする

## 8. 開発ロードマップ

1. 認証・ロール管理・共通レイアウト
2. 組織マスタ、社員マスタ、パートナーマスタ
3. 月次PL入力と粗利自動計算
4. 半期評価入力と評価確定フロー
5. 昇給シミュレーションと承認フロー
6. ダッシュボード、集計、監査ログ



