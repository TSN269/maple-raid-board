# Maple Raid Board - 秋楓 UI-V6

這包是 UI-V6 版型。部署後頁首應該看得到「秋楓 UI-V6」。如果看不到，代表 Vercel 沒部署到這份 commit。


仿照突襲組隊報名看板的功能，做成可推 GitHub 的 Vite + React + TypeScript + Tailwind + Supabase 專案。

## 功能

- 突襲場次列表
- `?group=<group_id>` 直連特定團
- 建立突襲場次
- 報名角色
- 第 1～6 隊分隊看板
- 成員狀態：待確認、已確認、候補、請假
- 複製團連結
- Supabase Postgres 資料同步
- Supabase Realtime 訂閱資料變更

## 本機啟動

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` 需要填：

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## Supabase 設定

1. 到 Supabase 建立新 Project。
2. 進入 SQL Editor。
3. 貼上並執行 `supabase/schema.sql`。
4. 到 Project Settings > API 複製 Project URL 與 anon public key。
5. 貼到 `.env.local`。
6. `npm run dev`。

## GitHub 推送

```bash
git init
git add .
git commit -m "init maple raid board"
git branch -M main
git remote add origin https://github.com/<your-name>/<repo-name>.git
git push -u origin main
```

## 重要安全說明

`supabase/schema.sql` 目前是「公開報名 demo」設定：匿名使用者可以讀取、新增、更新、刪除場次與成員。這樣才能不登入就報名，但也代表任何知道網址的人都能改資料。

正式站建議改成其中一種：

1. 使用 Supabase Auth，只有登入者可以建立、編輯、刪除。
2. 每個團產生 `admin_key`，只有持有管理 key 的人可以修改團資訊。
3. 報名只開放 insert；修改與刪除限定團長或管理者。

## Vercel 部署

此專案已加入 Vercel 設定：

- `vercel.json`
- `.vercelignore`
- `VERCEL_DEPLOY.md`

Vercel 設定值：

```text
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

Vercel Project Settings > Environment Variables 需新增：

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

建議 Production、Preview、Development 都設定。新增或修改環境變數後，要重新 Deploy，既有 deployment 不會自動套用。

完整步驟看 [`VERCEL_DEPLOY.md`](./VERCEL_DEPLOY.md)。

## 其他部署

也可部署到 Netlify、Cloudflare Pages 或 GitHub Pages。部署平台需設定：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 專案結構

```text
maple-raid-board-supabase/
├─ supabase/
│  └─ schema.sql
├─ src/
│  ├─ api/
│  │  └─ raids.ts
│  ├─ components/
│  │  ├─ CreateRaidModal.tsx
│  │  ├─ RaidDetail.tsx
│  │  ├─ RaidList.tsx
│  │  ├─ SignupPanel.tsx
│  │  └─ ui.tsx
│  ├─ data/
│  │  └─ options.ts
│  ├─ lib/
│  │  └─ supabase.ts
│  ├─ App.tsx
│  ├─ index.css
│  ├─ main.tsx
│  └─ types.ts
├─ .env.example
├─ .vercelignore
├─ package.json
├─ vercel.json
├─ VERCEL_DEPLOY.md
└─ README.md
```


## Vercel build note

This project intentionally keeps the Supabase client untyped in `src/lib/supabase.ts` and uses local app types in `src/types.ts`. This avoids TypeScript build failures where Supabase generic inference turns insert/update payloads into `never`.

`package.json` uses:

```json
"build": "vite build",
"typecheck": "tsc -b"
```

Vercel should run `npm run build`, not `npm run typecheck`.


## UI-V3 更新

- 左側「首頁」按鈕顯示突襲場次清單。
- 左側「我要報名」按鈕顯示目前選取團的報名表單。
- 中央主內容只保留團隊 Hero、公告、統計與隊伍配置。
- 不需要重新執行 Supabase SQL。


## UI-V5 調整

- 左側「首頁」只顯示突襲場次清單與搜尋。
- 左側「楓突襲」顯示目前選取團隊的詳細內容、公告、統計與隊伍配置。
- 左側「我要報名」顯示目前選取團隊的報名表單。
- 不需要重跑 Supabase schema。


## UI-V5

- 移除頁尾的 Demo mode / policy 提示文字。
- 移除左側第 4 個「我的報名」按鈕。
- 新增突襲場次表單加入「難度」選項：簡單 / 困難。
- 難度目前用既有 boss 欄位相容儲存，不需要重跑 Supabase schema。


## UI-V6 調整

- 隊伍配置刪減為 3 隊。
- 報名表單的隊伍選項只保留隊伍 1～3。
- 舊資料若存在隊伍 4～6，前端顯示時會歸到隊伍 3，避免成員消失。

## UI-V12 權限與名額變更

UI-V12 之後不再使用匿名全開 CRUD。

### 重要：需要重新執行 Supabase SQL

到 Supabase SQL Editor 執行：

```text
supabase/schema.sql
```

新版 SQL 會：

- 將突襲名額上限限制為 18。
- 將舊資料 `capacity` 大於 18 的團修正為 18。
- 將隊伍限制為 1～3 隊。
- 移除舊版匿名 update / delete policy。
- 一般匿名使用者只能讀取資料與新增報名。
- 團長管理操作改由 RPC + 團長管理碼執行。

### 團長管理碼

建立突襲時需輸入「團長管理碼」。之後在「楓突襲」頁面輸入此管理碼，才能：

- 修改招募狀態
- 修改成員狀態
- 刪除成員
- 刪除整團

Demo 團的管理碼是：

```text
demo123
```

此方案是「每團管理碼」模式，不是完整帳號登入制。若要正式上線且避免管理碼被轉傳，下一步應改 Supabase Auth + 管理員角色 RLS。
