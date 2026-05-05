# Vercel 部署說明

這個專案是 Vite SPA + Supabase。部署到 Vercel 時，只需要設定前端環境變數，不需要另外建 Vercel Serverless Function。

## 1. 先準備 Supabase

1. 建立 Supabase Project。
2. 到 Supabase SQL Editor 執行 `supabase/schema.sql`。
3. 到 Project Settings > API 複製：
   - Project URL
   - anon public key

不要把 `service_role` key 放到 Vercel 前端環境變數。這個專案只需要 anon public key。

## 2. 推到 GitHub

```bash
git init
git add .
git commit -m "init maple raid board"
git branch -M main
git remote add origin https://github.com/<your-name>/<repo-name>.git
git push -u origin main
```

## 3. 在 Vercel 匯入 GitHub 專案

1. Vercel Dashboard > Add New > Project。
2. Import 你的 GitHub repo。
3. Framework Preset 選 `Vite`。如果 Vercel 自動偵測到 Vite，可維持預設。
4. Build and Output 設定可沿用專案內的 `vercel.json`：
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: `dist`

## 4. 設定 Vercel Environment Variables

在 Vercel Project Settings > Environment Variables 新增：

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

建議三個環境都勾：

- Production
- Preview
- Development

新增或修改環境變數後，要重新 Deploy，舊的 deployment 不會自動套用新變數。

## 5. 部署

按 Deploy，或之後直接 push 到 `main`：

```bash
git add .
git commit -m "update raid board"
git push
```

Vercel 會自動建立新的 Production Deployment。

## 6. 本機使用 Vercel CLI 可選

如果你想從 Vercel 把環境變數拉回本機：

```bash
npx vercel login
npx vercel link
npx vercel env pull .env.local
npm install
npm run dev
```

## 7. SPA refresh / route fallback

`vercel.json` 內已加：

```json
"rewrites": [
  {
    "source": "/(.*)",
    "destination": "/"
  }
]
```

這是給前端單頁應用用的 fallback。雖然目前主要用 `?group=<group_id>` 查詢參數，不一定需要路徑式 routing，但先保留可避免未來加入 `/raid/:id` 之類路由時重新整理 404。

## 8. Supabase Realtime 注意事項

`supabase/schema.sql` 已把 `raid_groups`、`raid_members` 加入 `supabase_realtime` publication。若部署後列表沒有即時刷新，先檢查：

1. SQL 是否完整執行。
2. Supabase Realtime 是否啟用。
3. Vercel 環境變數是否填對。
4. Browser DevTools Console 是否有 Supabase 連線或 RLS 錯誤。

## 9. 正式站安全建議

目前 schema 是 demo 公開報名模式：匿名使用者可 read / insert / update / delete。正式站至少建議改成：

- 匿名只允許 `select` 與 `insert raid_members`。
- 修改或刪除團資料需登入。
- 團長管理操作使用 Supabase Auth 或 admin token 流程。
