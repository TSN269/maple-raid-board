# Maple Raid Board

> Artale／楓之谷多人協作工具站  
> 目前版本：**TSN UI-10.0**  
> GitHub：`TSN269/maple-raid-board`  
> 部署架構：React + TypeScript + Vite + Supabase + Vercel

Maple Raid Board 整合突襲報名、隊伍管理、羅茱跳台協作、練功效率 OCR、遊戲 ID 紀錄與 Artale 物價查詢。前端以 Vite SPA 運作，Supabase 提供資料庫與 Realtime，Vercel Serverless API 負責物價資料讀取與每日歷史價格寫入。

---

## 目錄

1. [功能摘要](#1-功能摘要)
2. [快速開始](#2-快速開始)
3. [環境變數](#3-環境變數)
4. [Supabase 建置與升級](#4-supabase-建置與升級)
5. [練功效率 OCR](#5-練功效率-ocr)
6. [Artale 物價查詢](#6-artale-物價查詢)
7. [專案架構](#7-專案架構)
8. [Vercel 部署](#8-vercel-部署)
9. [開發與驗證](#9-開發與驗證)
10. [安全與資料說明](#10-安全與資料說明)
11. [故障排除](#11-故障排除)
12. [GitHub 更新流程](#12-github-更新流程)
13. [完整改版紀錄](#13-完整改版紀錄)

---

## 1. 功能摘要

### 突襲報名與隊伍管理

- 建立 NORMAL／HARD 場次。
- 招募上限 1～18 人，自動對應 1～3 隊。
- 團長可設定角色需求、管理碼、邀請碼與公告。
- 玩家僅能選擇團長開放的角色定位。
- 支援成員狀態、拖曳排序、刪除成員與刪除場次。
- 查看名單僅顯示已確認成員。
- 支援團連結分享與常用隊伍匯入。

### 羅茱跳台協作

- 多人房間、房間代碼與密碼。
- 每位玩家只能選擇一個角色。
- 支援快捷鍵 1～4。
- 支援 1～10 路徑格、上次路徑與迷你路徑預覽。
- 支援再次點擊清除格子。
- 使用 Supabase Realtime／Presence 同步。
- 房間閒置一小時後可自動退出。

### 練功效率偵測

- 螢幕擷取與自適應狀態列定位。
- 自動辨識等級與目前 EXP。
- EXP／分、10 分鐘、60 分鐘與升級時間估算。
- 折線圖、離群值排除與最高效率排除異常資料。
- 暫停、繼續、停止與快捷鍵控制。
- OCR／手動紀錄分類、統計快照與圖片輸出。
- 數據分析支援總控與各欄獨立 👁 顯示／隱藏，隱藏數值以 `*****` 呈現。
- 支援剪貼簿與 Web Share API。

### 遊戲 ID 與收藏

- 保存遊戲 ID、特徵碼與常用隊伍。
- 報名及建立場次時可自動帶入。
- 收藏團連結，快速返回常用場次。

### Artale 物價查詢

- Google Sheet CSV／CSV URL 資料來源。
- 商品搜尋、分類、列表與自選清單。
- 自選清單右側顯示分類為「商城道具」且 `wcmc` 最高的前 10 名 WC 換楓幣排行。
- 最後報價、7 日均、30 日均與漲跌幅。
- 歷史走勢、K 線分析與均線。
- 自選清單保存於 localStorage。
- 每日最後報價寫入 Supabase。

---

## 2. 快速開始

### 系統需求

- Node.js **20.x**
- npm
- Supabase Project
- Vercel Project
- 支援 `getDisplayMedia` 的瀏覽器，例如 Chrome 或 Edge

### 下載與安裝

```bash
git clone <repository-url>
cd maple-raid-board
npm install
```

### 建立本機環境變數

```bash
cp .env.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

填入 Supabase 與 Artale 物價設定後啟動：

```bash
npm run dev
```

預設由 Vite 顯示本機網址。需要讓同網段裝置連線時：

```bash
npm run dev -- --host 0.0.0.0
```

### 首次建立 Supabase

在 Supabase SQL Editor 執行：

```text
supabase/schema.sql
```

接著設定 Vercel 環境變數並部署。

---

## 3. 環境變數

專案範例位於 `.env.example`。

### 前端必填

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### Artale 物價 API

```env
ARTALE_PRICE_CSV_URL=https://example.com/prices.csv
ARTALE_PRICE_GOOGLE_SHEET_GID=
ARTALE_PRICE_DATA_AUTH_HEADER=
VITE_ARTALE_PRICE_ENDPOINT=/api/artale-prices
```

### 物價歷史寫入

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

API 也支援以下相容名稱：

```env
SUPABASE_URL=
ARTALE_PRICE_SUPABASE_SERVICE_ROLE_KEY=
ARTALE_PRICE_DATA_URL=
ARTALE_PRICE_EXCEL_URL=
```

### 安全規則

- `SUPABASE_SERVICE_ROLE_KEY` 不得加上 `VITE_`。
- `service_role` 只能存在於 Vercel／Netlify Serverless 環境。
- 不可把 `service_role` 寫進前端程式碼、Git 或瀏覽器 localStorage。
- `VITE_SUPABASE_ANON_KEY` 是前端使用的公開 anon key，實際權限由 RLS 與 RPC 控制。
- 修改環境變數後必須重新部署，既有 Deployment 不會自動更新。

---

## 4. Supabase 建置與升級

### 全新資料庫

執行：

```text
supabase/schema.sql
```

此檔案包含主要資料表、RPC、RLS、Realtime 與目前 schema 所需結構。

### 舊資料庫升級

依既有版本與問題選擇執行：

| SQL 檔案 | 用途 |
|---|---|
| `supabase/ui-5-9-sqlfix1-role-options.sql` | 修正角色需求選項與「大法」驗證 |
| `supabase/ui-6-7-sqlfix-rojhu-toggle-cell.sql` | 羅茱格子再次點擊取消選取 |
| `supabase/ui-7-5-artale-price-history.sql` | 建立物價每日歷史資料表 |
| `supabase/ui-7-7-artale-merge-legacy-keys.sql` | 合併舊版商品 key |
| `supabase/ui-7-8-artale-history-read-sqlfix1.sql` | 舊價格 key／商品名稱合併初版 |
| `supabase/ui-7-8-sqlfix2-artale-history-read.sql` | 修正 SQLFIX1 的 `item_name` ambiguous 錯誤 |

### Artale 舊價格資料建議處理順序

1. 部署目前版本。
2. 開啟 Artale 物價查詢。
3. 按一次「重新讀取報價」。
4. 執行：

```text
supabase/ui-7-8-sqlfix2-artale-history-read.sql
```

5. 再按一次「重新讀取報價」。
6. 確認走勢圖、7 日均與 30 日均讀得到舊資料。

SQLFIX1 若出現：

```text
ERROR: 42702: column reference "item_name" is ambiguous
```

不要繼續使用 SQLFIX1，改執行 SQLFIX2。

---

## 5. 練功效率 OCR

### 使用方式

1. 開啟「練功效率」。
2. 按「開始分析」。
3. 在瀏覽器分享視窗中選擇包含遊戲畫面的螢幕或視窗。
4. 保持遊戲狀態列完整顯示。
5. 等待狀態列與 OCR 引擎完成初始化。

快捷鍵：

| 快捷鍵 | 功能 |
|---|---|
| `F8` | 開始分析 |
| `F9` | 暫停／繼續 |
| `F10` | 停止分析 |

### 定位流程

程式先在螢幕擷取畫面中尋找完整狀態列，再建立子裁切區：

```text
完整 LV / HP / MP / EXP 狀態列
├─ 等級裁切區
└─ EXP 文字裁切區
```

狀態列辨識會比對 HP、MP、EXP 色條的排列與比例。最大化、全螢幕或畫面切換期間若短暫漏判，程式會重試或暫時沿用上一個有效位置。

### 等級辨識

- 優先使用白色像素字型結構辨識。
- 無法判定時使用 Tesseract 備援。
- 等級範圍限制為 1～200。
- 等級變化需要連續確認，避免單次誤判。
- 等級提高一級後，才允許較低 EXP 進入新基準判定。

### EXP 辨識

目前流程：

1. 使用最近成功的影像處理方式進行快速 OCR。
2. 一般情況只執行一次 OCR。
3. 初始值、較低值、失敗或衝突時追加其他影像流程。
4. 初始 EXP 若兩種流程一致會立即採用；只有單一流程成功時，以連續兩次合理結果確認。
5. 多流程結果依接近程度分組。
6. 異常高值直接拒絕，不會自動成為新基準。
7. 較低值必須符合升級條件並連續確認，才可重設基準。

支援的影像處理方式：

- 二值化 140
- 白字抽取
- 原圖放大
- 二值化 165

### 效能

UI-9.3 起：

- Tesseract Worker 在開始分析時建立一次。
- EXP 與等級 OCR 共用同一個 Worker。
- Worker 不會在每次辨識時重新初始化。
- 預設辨識間隔為 1 秒。
- OCR 尚未完成時不會重疊啟動下一次。

UI-9.4 起：

- 使用 `ImageCapture.grabFrame()` 直接讀取螢幕擷取視訊軌道。
- EXP 辨識不再依賴分析頁 `<video>` 元素是否持續重繪。
- 切換到被擷取的遊戲視窗後，仍可取得最新影格。
- OCR tick 優先由獨立 Web Worker 排程，降低背景頁計時器節流。
- 不支援 ImageCapture 的瀏覽器才回退至 video 元素。

### Debug

勾選 Debug 可查看：

- 完整狀態列、EXP 與等級裁切框。
- EXP／等級 OCR 預覽。
- 狀態列定位來源。
- OCR Worker 狀態。
- 最近一次 OCR 耗時。
- 影格來源：擷取軌道或影片備援。
- OCR 排程：背景 Worker 或頁面計時器備援。
- 最近取得影格距今秒數。
- 原始 OCR 文字與影像流程一致數。
- EXP 辨識處理狀態，例如「辨識成功，數值未變化」。
- OCR 詳細訊息，包括影像流程、等級與影格來源。
- 最近 OCR／手動紀錄。

未勾選 Debug 時，EXP 辨識處理狀態與 OCR 詳細訊息不顯示，也不保留空白區塊。

紀錄分類：

- 全部
- 已加入
- 未變化
- 待確認
- 新基準
- 未辨識
- 已拒絕

### 統計與異常值

顯示內容包括：

- 目前 EXP 與百分比
- 累積 EXP
- EXP／分
- 近 10 分鐘與近 60 分鐘
- 預估 10 分鐘與預估 60 分鐘
- 10／60 分鐘最高值
- 預估升級時間

最高值會先排除異常速率與離群時間窗，避免切換畫面時誤讀其他數字，造成永久異常高值。

---

## 6. Artale 物價查詢

### CSV 建議格式

建議使用固定 `id`：

```csv
id,商品名稱,分類,最後報價
chaos_scroll_60,混沌卷軸 60%,卷軸,28500000
glove_att_60,手套攻擊卷軸 60%,卷軸,16800000
white_potion,白色藥水,消耗品,850
```

英文欄位也可使用：

```csv
id,name,category,latest
```

固定 `id` 不應隨排序或列位置改變。避免使用商品列號作為 key，否則插入、刪除或重新排序商品時，舊歷史資料可能無法對應。

### Google Sheet 發布

```text
Google Sheet
→ 檔案
→ 分享
→ 發布到網路
→ 選擇工作表
→ 逗號分隔值 .csv
→ 發布
```

將 URL 填入：

```env
ARTALE_PRICE_CSV_URL=
```

### API

Vercel：

```text
/api/artale-prices
```

Netlify：

```text
/.netlify/functions/artale-prices
```

前端使用：

```env
VITE_ARTALE_PRICE_ENDPOINT=/api/artale-prices
```

API 功能：

- 下載並解析 CSV。
- 對應固定商品 key。
- 讀取最近歷史報價。
- 計算 7 日均、30 日均與趨勢。
- 使用 `service_role` 寫入每日最後報價。
- 回傳資料來源與最後更新時間。

### 每日歷史價格

Vercel Cron 設定於 `vercel.json`：

```cron
55 15 * * *
```

即每天 UTC 15:55 呼叫 `/api/artale-prices`，約為台灣時間 23:55。

歷史表：

```text
public.artale_price_daily_records
```

主要欄位：

| 欄位 | 用途 |
|---|---|
| `item_key` | 固定商品識別碼 |
| `price_date` | 報價日期 |
| `item_name` | 商品名稱 |
| `category` | 分類 |
| `last_price` | 每日最後報價 |
| `source` | 資料來源 |
| `created_at` | 建立時間 |
| `updated_at` | 更新時間 |

主鍵：

```text
(item_key, price_date)
```

---

## 7. 專案架構

```text
.
├─ api/
│  └─ artale-prices.js
├─ netlify/
│  └─ functions/
│     └─ artale-prices.cjs
├─ public/
│  └─ training-hud-reference.png
├─ src/
│  ├─ App.tsx
│  └─ ...
├─ supabase/
│  ├─ schema.sql
│  ├─ ui-5-9-sqlfix1-role-options.sql
│  ├─ ui-6-7-sqlfix-rojhu-toggle-cell.sql
│  ├─ ui-7-5-artale-price-history.sql
│  ├─ ui-7-7-artale-merge-legacy-keys.sql
│  ├─ ui-7-8-artale-history-read-sqlfix1.sql
│  └─ ui-7-8-sqlfix2-artale-history-read.sql
├─ .env.example
├─ package.json
├─ vercel.json
├─ vite.config.ts
└─ README.md
```

### 技術

| 類型 | 使用技術 |
|---|---|
| UI | React 19 |
| 語言 | TypeScript 5.8 |
| Build | Vite 6 |
| CSS | Tailwind CSS 3 |
| Backend | Supabase PostgreSQL |
| 即時同步 | Supabase Realtime／Presence |
| OCR | tesseract.js 6 CDN |
| Serverless | Vercel Function／Netlify Function |
| 圖片輸出 | Canvas API |
| 分享 | Clipboard API／Web Share API |
| 本機狀態 | localStorage |

---

## 8. Vercel 部署

### 專案設定

| 設定 | 值 |
|---|---|
| Framework Preset | Vite |
| Node.js | 20.x |
| Output Directory | `dist` |
| Build Command | `node -v && npm -v && npm run build` |

`vercel.json` 已定義 Install Command、Build Command、SPA rewrite 與 Cron。

### 部署流程

1. 將專案推送至 GitHub。
2. 在 Vercel Import Project。
3. 設定環境變數。
4. 確認 Node.js 版本為 20.x。
5. Deploy。
6. 測試首頁、Supabase、`/api/artale-prices` 與 OCR 頁面。

環境變數更新後請執行 Redeploy。

### SPA Rewrite

目前 rewrite 會保留 `/api/*`，其餘路徑回到 SPA：

```json
{
  "source": "/((?!api/.*).*)",
  "destination": "/"
}
```

---

## 9. 開發與驗證

### 指令

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run preview
```

Vercel CLI：

```bash
npm run preview:vercel
npm run deploy:vercel
```

### 發布前最低檢查

```bash
npm run typecheck
npm run build
node --check api/artale-prices.js
node --check netlify/functions/artale-prices.cjs
```

### Node.js 版本

專案指定：

```text
20.x
```

相關檔案：

```text
.node-version
.nvmrc
package.json > engines.node
```

---

## 10. 安全與資料說明

- 團長管理操作透過管理碼與 Supabase RPC 驗證。
- 報名流程含輸入驗證、重複名稱檢查、honeypot 與瀏覽器 nonce／冷卻機制。
- Supabase 權限以 RLS 與 RPC 為準。
- `service_role` 僅供 Serverless API 使用。
- 隊伍收藏、自選清單、遊戲 ID、部分練功統計與 OCR 設定保存在瀏覽器 localStorage。
- 螢幕擷取由瀏覽器 `getDisplayMedia` 啟動；使用者必須主動選擇分享來源。
- OCR 影像在瀏覽器端處理，程式碼未設計成將擷取畫面上傳至 Supabase。

正式公開站仍應定期檢查：

- RLS Policy
- RPC 權限
- Vercel 環境變數
- Supabase API 日誌
- Serverless Function 日誌
- Cron 執行結果

---

## 11. 故障排除

### Vercel 安裝失敗：`Exit handler never called`

確認：

1. Node.js 使用 20.x。
2. 清除 Vercel Build Cache。
3. 使用專案內 `vercel.json` 的 Install Command。
4. 重新部署。

### `ENOTEMPTY`／`adler-32`

舊版 xlsx 依賴已移除。物價來源應使用 CSV／Google Sheet CSV。

### `/api/artale-prices` 沒有資料

檢查：

1. `ARTALE_PRICE_CSV_URL` 是否為直接 CSV URL。
2. Google Sheet 是否已發布到網路。
3. 第一列是否含商品名稱與價格欄位。
4. 價格是否可解析為正數。
5. Vercel Environment Variables 是否套用至 Production。
6. 修改後是否已 Redeploy。

### 物價歷史沒有寫入

檢查：

1. `public.artale_price_daily_records` 是否存在。
2. `SUPABASE_SERVICE_ROLE_KEY` 是否設定於 Serverless 環境。
3. `VITE_SUPABASE_URL` 或 `SUPABASE_URL` 是否正確。
4. `/api/artale-prices` 日誌是否有 Supabase REST 錯誤。
5. Cron 是否有執行紀錄。

### 舊商品歷史不見

通常是舊版使用「商品名稱 + 列順序」作為 key。執行：

```text
supabase/ui-7-8-sqlfix2-artale-history-read.sql
```

並重新讀取報價。

### OCR 找不到完整狀態列

- 確認擷取來源包含完整遊戲畫面。
- 狀態列不可被其他視窗遮住。
- 切換最大化或全螢幕後等待畫面穩定。
- 查看 Debug 的定位來源與裁切框。
- 按重新辨識狀態列。
- 必要時停止擷取後重新開始。

### OCR 更新延遲或切換視窗後停在舊值

- Debug 確認「影格來源」為「擷取軌道」。
- Debug 確認「排程」為「背景 Worker」。
- 查看最近影格時間是否持續更新。
- OCR 引擎狀態應為「已就緒」。
- 如果瀏覽器不支援 ImageCapture，會顯示「影片備援」；背景辨識可靠度較低。
- 不要將被擷取的遊戲視窗最小化，部分作業系統會停止提供最小化視窗影格。
- 若影格時間停止，先停止螢幕擷取，再重新開始分析並重新選擇遊戲視窗。

### EXP 被拒絕

可能原因：

- 超過目前等級的合理 EXP 範圍。
- 與近期趨勢差異過大。
- 只有單一影像流程支持異常值。
- 等級未確認提升，卻出現較低 EXP。
- 多流程結果互相衝突。

在 Debug 的「已拒絕」分類查看原因。若目前基準本身錯誤，可手動輸入正確 EXP；低於目前值的手動輸入會作為人工確認的新基準。

---

## 12. GitHub 更新流程

一般更新：

```bash
git add .
git commit -m "deploy ui 9.5"
git push
```

只更新 README：

```bash
git add README.md
git commit -m "deploy ui 9.4 background capture"
git push
```

遠端已有更新：

```bash
git pull --rebase origin main
git push origin main
```

發生衝突：

```bash
git status
# 修正衝突後
git add <resolved-files>
git rebase --continue
git push origin main
```

README 必須與每次功能更新同步，包括：

- 目前版本
- 新功能與修正
- 環境變數
- SQL／部署需求
- 使用方式
- 完整改版紀錄

---

## 13. 完整改版紀錄

### 初始版 / UI-0.1

```text
建立 Maple Raid Board 基礎功能：
- 場次清單
- 團詳細頁
- 報名資料
- Supabase raid_groups / raid_members
- Vercel 部署
```

### Fix 1～3

```text
修正 Vercel build 問題：
- TypeScript typecheck 導致 build exited with 2
- Supabase Database type 推導成 never
- 改用較寬鬆的 Supabase client 型別，避免部署卡住
```

### UI-0.2

```text
大幅重做 UI：
- 暖色楓葉風格
- 左側導覽
- Hero 區
- 統計卡
- 右側報名面板
```

### UI-0.3

```text
導覽分頁化：
- 首頁顯示突襲場次清單
- 我要報名顯示報名表單
```

### UI-0.4

```text
調整左側按鈕分工：
- 首頁：突襲場次清單
- 楓突襲：突襲詳細內容
- 我要報名：報名表單
```

### UI-0.5

```text
清理頁尾提示文字
移除多餘按鈕
新增難度選項：
- 簡單
- 困難
```

### UI-0.6

```text
隊伍配置改為 3 隊
報名表單隊伍選項限制為 1～3 隊
```

### UI-0.7

```text
替換 Boss 圖示：
- Zakum
- Horntail
- Pink Bean
- Papulatus
```

### UI-0.8

```text
Boss 小圖示加入 NORMAL / HARD 標示
依難易度顯示不同圖示標籤
```

### UI-0.9

```text
難度標籤不只顯示在圖示，也顯示在場次標題旁
建立突襲難度選項改為：
- NORMAL
- HARD
```

### UI-1.0

```text
Boss 與難度拆分顯示
場次清單加入 NORMAL / HARD 篩選
不同 Boss + 難度使用不同色系徽章與邊框
```

### UI-1.1

```text
新增招募狀態：
- 招募中
- 招募截止
- 已結束

支援：
- 團長手動切換
- 超過開團時間自動顯示已結束
```

### UI-1.2

```text
新增權限機制：
- 報名上限 30 改為 18
- 一般玩家只能報名
- 團長需要管理碼才能管理
- 管理操作改走 RPC
```

### UI-1.2 SQLFIX

```text
修正 pgcrypto / crypt() 問題：
- create extension if not exists pgcrypto
- 修正 search_path
```

### UI-1.3

```text
防止亂填與洗版：
- 報名邀請碼
- 停用匿名 direct insert
- 報名改走 RPC
- 同團同角色不可重複
- 欄位格式限制
- honeypot
- browser nonce
- 報名冷卻
```

### UI-1.3 SQLFIX2

```text
修正舊資料違反 check constraint 問題：
- title 清理
- leader 清理
- notice 清理
- member 欄位清理
- capacity > 18 修正
```

### UI-1.4

```text
新增通知中心：
- 開團提醒
- 1 小時內快開打提醒
- 招募截止
- 已結束
- 團狀態變更
- 候補轉正
- 本機通知已讀 / 清除
```

### UI-1.5

```text
團長複製團連結可帶邀請碼
玩家從連結進入時自動帶入報名邀請碼
```

### UI-1.6

```text
品牌改為 TSN
頁首顯示 TSN UI-1.6
左上主 Logo 文字調整
```

### UI-1.7

```text
Logo 改為楓葉 SVG
新增羅茱工具按鈕
設定頁顯示本機保存的：
- 團長管理碼
- 團邀請碼
- 帶邀請碼團連結
```

### UI-1.8

```text
收藏改名為團連結收藏
原羅茱工具內的團連結功能移到團連結收藏
保留羅茱工具按鈕
```

### UI-1.9

```text
羅茱工具初版：
- 左欄建立 / 加入房間
- 右欄路徑解謎工具
- 本機 localStorage 保存
```

### UI-2.0

```text
羅茱工具改為 Supabase 多人即時同步：
- 建立房間寫入 Supabase
- 加入房間讀取 Supabase
- Realtime 同步路徑
- 房間分享連結
- 角色顏色永久顯示
- 重置全清除
```

### UI-2.1

```text
羅茱工具風格改成跟主網站一致
移除 Artale - YzY公會文字
移除線上人數文字
不需按同步鍵，自動同步
每人只能擇一角色
房間代碼 / 密碼可手動輸入
可退出房間
```

### UI-2.2

```text
修正羅茱工具格子數字：
- 數字置中
- 數字變大
- 保留角色色塊顯示
```

### UI-2.3

```text
新增鍵盤快捷鍵：
- 1 / 2 / 3 / 4 填入下一層
新增響應式版面
```

### UI-2.4

```text
快捷鍵填滿 10 層後停止
羅茱工具強制左右欄
路徑顯示順序調整
```

### UI-2.5

```text
修正路徑邏輯：
- 我的路徑顯示 1 → 10
- 格子視覺維持 10 → 1
新增：
- 角色鎖定同步
- 上次路徑欄位
- 房間閒置 1 小時清空
```

### UI-2.6

```text
我的路徑不再顯示層數前綴
上次路徑改為自動保存
羅茱工具強制左右欄
```

### UI-2.7

```text
首頁內容也強制左右欄
小螢幕改為橫向捲動
```

### UI-2.8

```text
右上方重新整理按鈕改成重新整理 / 檢查新場次
重新讀取 Supabase 突襲場次資料
可顯示是否有新突襲場次
發現新場次時會提示數量與名稱，並自動選取第一個新場次
```

### UI-2.9

```text
首頁突襲場次新增招募中 / 招募截止 / 已結束分類
招募截止的突襲場次只出現在招募截止分類
已結束的突襲場次只出現在已結束分類
招募中的突襲場次只出現在招募中分類
```

### UI-3.0

```text
修正 UI-2.9 分類判斷使用錯誤欄位造成場次不顯示
改用 effectiveStatus 作為狀態分類 key
招募中 / 招募截止 / 已結束分類可正常互斥顯示
```

### UI-3.1

```text
我要報名角色定位改為打手 / 控時 / 火 / 煙霧機 / 輔助
隊伍配置依報名上限自動調整隊伍數
楓突襲隊伍名單可拖曳調整同隊先後順序
查看名單模式只列出已確認的人
```

### UI-3.2

```text
楓突襲新增隊伍角色定位需求設定
團長可設定每隊 6 格定位需求
我要報名只顯示目前需求內的角色定位
新增 Supabase role_requirements 欄位與 RPC 驗證
```

### UI-3.3

```text
修正隊伍角色定位需求未連動到隊伍配置顯示
隊伍配置空位會同步顯示團長設定的需求定位
報名頁只顯示需求內的角色定位，不再回退顯示全部定位
```

### UI-3.3 SQLFIX1

```text
修正 supabase/schema.sql demo seed insert 欄位數不一致
role_requirements 欄位加入後，demo seed rows 也補上預設 jsonb
on conflict update 同步更新 role_requirements
```

### UI-3.4

```text
新增突襲名額上限改為 1～18 下拉式選單
修正首頁手機瀏覽器無法左右滑動導致看不到右欄
修正羅茱工具手機瀏覽器無法左右滑動導致看不到右欄
```

### UI-3.5

```text
羅茱工具路徑格子縮小至比角色按鈕大一點
上次路徑欄位右側新增迷你路徑格子
迷你路徑格子會顯示已保存的上次路徑
```

### UI-3.6

```text
羅茱工具主路徑格子改為固定小尺寸，不再撐滿右欄
上次路徑迷你格子改為總共一個 10 × 4 總覽
迷你總覽可顯示所有角色的上次路徑顏色
```

### UI-3.7

```text
楓突襲隊伍角色定位需求區塊改為團長模式才顯示
一般玩家模式不顯示需求設定區
報名頁仍依照已設定需求限制可選角色定位
```

### UI-3.8

```text
左側導覽在羅茱工具下方新增練功效率按鈕
新增練功效率偵測頁面
統計面板仿練功分析工具呈現 EXP / 分、預估 10 / 60 分與升級時間
新增 EXP / 分趨勢圖並套用本站橘色風格
```

### UI-3.9

```text
修正練功效率偵測頁面 Field is not defined 錯誤
App.tsx 補上 Field import
練功效率偵測頁面可正常開啟
```

### UI-4.0

```text
練功效率偵測改為 OCR 自動辨識 EXP
新增螢幕擷取裁切區域設定
新增 OCR 自動加入 EXP 樣本
保留手動修正 EXP 備援
使用 tesseract.js CDN 前端 OCR
```

### UI-4.1

```text
開始分析會自動啟動畫面擷取與 OCR
OCR 裁切區域改為自動抓取
可重新自動抓取裁切區，也可關閉自動模式後手動微調
```

### UI-4.2

```text
OCR 裁切區域改為抓取左下 EXP 文字與綠色經驗條
移除啟動 OCR 與辨識一次按鈕
新增 Debug 勾選選項，未勾選時隱藏 OCR 除錯資訊
```

### UI-4.3

```text
OCR 裁切區域改為先抓左下綠色 EXP 經驗條再往上包含 EXP 文字
自動抓取失敗時套用更接近附圖的左下 EXP 預設裁切區
螢幕擷取對照與 OCR 裁切預覽縮小至接近 UI-3.9 尺寸
```

### UI-4.4

```text
OCR 裁切區域只掃描左下角並以最長綠色 EXP bar 作為定位
螢幕擷取對照移到手動修正目前 EXP 右邊
OCR 裁切預覽移到手動修正目前 EXP 右邊
兩個預覽欄位改為小型卡片
```

### UI-4.5

```text
練功效率 OCR 改為可在螢幕擷取對照上手動框選裁切區
框選後可儲存為預設裁切區
裁切區以原始擷取畫面百分比保存，不受網站視窗大小影響
移除不穩定的自動抓取裁切區流程
```

### UI-4.6

```text
改回自動 OCR 抓取裁切區流程
預設裁切區改為 X 50.4 / Y 93.6 / 寬 13 / 高 6.4
手動框選裁切區功能移到 Debug 勾選後顯示
手動框選時螢幕擷取對照會放大，方便使用者框選
```

### UI-4.7

```text
修正 tesseract.recognize is not a function 導致 OCR 無法辨識
兼容 tesseract.js CDN default / named export，並加入 createWorker 備援
練功效率頁面強制左右欄並支援手機橫向滑動
版號格式全面調整為 UI-0.1 / UI-1.0 / UI-4.7 格式
```

### UI-4.8

```text
最近 OCR / 手動紀錄改為 Debug 勾選後才顯示
統計時間欄位副資訊由 100% 改為顯示開始分析時間
```

### UI-4.9

```text
統計時間開始分析時間改為完整日期時間格式
練功效率的升級所需總 EXP 改為輸入當前等級
依照 Artale 經驗表的升下一级所需经验自動帶入升級所需總 EXP
內建 1～200 等級經驗表
```

### UI-5.0

```text
練功效率偵測新增擷取統計圖片按鈕
可輸出統計區數據圖片，方便分享
支援下載 PNG，瀏覽器支援時可直接開啟分享視窗
```

### UI-5.1

```text
統計區數據圖片支援複製到剪貼簿
可直接貼到其他軟體對話框
若瀏覽器不支援，則退回分享視窗或下載 PNG
```

### UI-5.2

```text
新增停止分析按鈕，停止 OCR 與計時
暫停分析改為暫停 / 繼續分析
新增 F8 開始、F9 暫停 / 繼續、F10 停止快捷鍵
手動修正目前 EXP 移到手動加入紀錄同一列
統計欄位新增 EXP 增量百分比與近 10 / 60 分、最高值顯示
```

### UI-5.3

```text
下方 EXP / 分趨勢圖改為折線圖呈現
OCR 辨識到與大多數經驗數值差異過大的極端值時不加入趨勢圖資料
折線圖額外過濾異常尖峰點，避免誤判值拉壞圖表比例
```

### UI-5.4

```text
趨勢圖顏色風格改為跟網站一致
擷取統計資訊圖片顏色風格改為跟網站一致
擷取圖片資訊內容盡量單行顯示，避免預估百分比換行
預估升級時間等級改為升級後等級
```

### UI-5.5

```text
左側導覽在團連結收藏下方新增隊伍收藏
已結束突襲場次的隊伍配置欄新增收藏隊伍名單功能
可依隊伍 1 / 2 / 3 分別收藏隊伍名單
隊伍收藏頁顯示收藏的場次與隊員名單
```

### UI-5.6

```text
新增突襲場次支援直接帶入隊伍收藏名單
可從新增突襲場次視窗選擇隊伍收藏
建立場次後自動加入收藏隊伍的成員名單
名額上限會依帶入人數自動調整
```

### UI-5.7

```text
練功效率偵測 Debug 移到狀態標籤右邊
Debug 位置在未啟動 / 統計中 / OCR 自動辨識中右側
Debug 原有功能維持不變
```

### UI-5.8

```text
練功效率偵測控制按鈕補上快捷鍵提示
開始分析顯示為開始分析(F8)
暫停 / 繼續分析顯示為暫停分析 (F9) / 繼續分析 (F9)
停止分析顯示為停止分析 (F10)
```

### UI-5.9

```text
新增遊戲 ID / 特徵碼角色條件紀錄
右上蘑菇 Logo 可開啟紀錄面板
我要報名可依已紀錄資料帶入角色名稱
建立場次時團長遊戲 ID 可用下拉選擇
新增角色定位條件擴充
```

### UI-5.9 SQLFIX1

```text
修正角色定位需求白名單
新增大法、清球、清魔靈
修正角色圖示 / Logo 相關顯示
```

### UI-6.0

```text
特徵碼上限改為 6 組
新增對應檢查與限制
```

### UI-6.1

```text
建立突襲時團長遊戲 ID 改為下拉選單
可直接選擇已紀錄的遊戲帳號
```

### UI-6.2

```text
新增練功效率統計紀錄匯入 / 匯出
可保存與轉移統計紀錄資料
```

### UI-6.3

```text
遊戲帳號無紀錄時新增提示
避免使用者不知道需先建立遊戲 ID / 特徵碼紀錄
```

### UI-6.4

```text
練功效率統計紀錄新增刪除功能
可移除不需要的歷史統計紀錄
```

### UI-6.5

```text
練功效率統計紀錄新增查看按鈕
可展開查看單筆統計紀錄內容
```

### UI-6.6

```text
練功效率統計紀錄支援匯出圖片
統計紀錄可輸出為分享用圖片
```

### UI-6.7

```text
羅茱格子可再次點擊清除顏色
新增對應 SQLFIX 支援 p_col_index null 清除單格
```

### UI-6.8

```text
練功效率統計資訊紀錄重整後不消失
統計紀錄保存到 localStorage
```

### UI-6.9

```text
左上 Logo 下方新增線上人數
使用 Supabase Realtime Presence 統計
Supabase 未設定時顯示本機人數 1
```

### UI-7.0

```text
左上 Logo 下方線上人數樣式調整
顯示順序改為線上人數、人像圖示、數字
```

### UI-7.1

```text
線上人數欄位改為網站橘色系風格
顯示更貼近主站設計
```

### UI-7.2

```text
右上新增 Artale 物價查詢小頁面
小頁面採白底橘色系卡片風格
當時仍以站內示範資料為主
```

### UI-7.2 READMEFIX

```text
修正 README conflict
移除重複歷史段落
整理歷代改版紀錄
```

### UI-7.3

```text
Artale 物價查詢移除參考網站按鈕
商品行情移除成交量
價格走勢改為折線圖
移除 1H / 3H / 6H，只保留 1D
改為準備讀取實際資料來源
```

### UI-7.4

```text
Artale 物價資料來源改為站長提供 Excel / CSV
新增 Vercel API /api/artale-prices
新增 Netlify Function 相容
支援 Google Sheet / CSV / JSON 正規化
```

### UI-7.4 VERCELFIX1

```text
移除 package-lock.json
新增 .npmrc 指定 public npm registry
修正 Vercel API function ESM export
修正 Vercel rewrite 避免 /api 被 SPA fallback 擋住
```

### UI-7.4 VERCELFIX2

```text
固定 Node.js 20.x
修正 Vercel npm install Exit handler never called
build log 顯示 node / npm 版本
```

### UI-7.4 CSVFIX1

```text
修正 Google Sheet CSV 讀取後沒有可用商品資料
支援 Google Sheet 分享連結 / pubhtml 自動轉 CSV
CSV / Excel 自動尋找欄位列
支援更多中文欄位名稱
```

### UI-7.5

```text
Artale 物價查詢不顯示資料源欄
移除資料來源說明字眼
1D / 3MA / 5MA / 20MA 移到 K線分析
日均(24H) 改為 30日均
新增 artale_price_daily_records
每日最後報價自動寫入 Supabase
走勢圖、7日均、30日均由資料庫歷史紀錄計算
```

### UI-7.5 VERCELFIX1

```text
移除 xlsx dependency
修正 Vercel npm ENOTEMPTY adler-32
Install Command 先清除 node_modules 與 package-lock.json
CSV / Google Sheet CSV 功能保留
```

### UI-7.5 VERCELFIX2

```text
Serverless API 改用 Supabase REST API
修正 Node.js 20 without native WebSocket support
不需要安裝 ws
前端既有 Supabase 功能不變
```

### UI-10.0

```text
練功效率偵測的 Debug 右側新增數據分析總控 👁 按鈕
總控可一次隱藏或顯示全部九個數據分析欄位
各數據分析卡片的 👁 可獨立控制該欄位
隱藏時主數值與附加數值顯示為 *****
僅改變畫面顯示，不影響 OCR、統計、快照與資料計算
不需要新增 Supabase SQL
目前最新版本
```

### UI-9.9

```text
WC換楓幣排行畫面固定顯示第 1～5 名
第 6～10 名保留在同一排行區塊，可透過垂直捲軸向下查看
仍只取分類為「商城道具」且 wcmc 大於 0 的前 10 名資料
wcmc 由大到小排序與點擊商品切換行情功能維持不變
不需要新增 Supabase SQL
```

### UI-9.8

```text
修正 WC換楓幣排行讀不到資料
分類條件由錯誤的「商城道具類」改為資料來源實際使用的「商城道具」
保留分類文字 NFKC 正規化與空白移除，避免全形或多餘空白影響匹配
依照 wcmc 由大到小顯示前 10 名
不需要新增 Supabase SQL
```

### UI-9.7

```text
Artale 物價查詢的我的自選清單右側新增 WC換楓幣排行
排行榜原先誤用商城道具類作為分類條件，已於 UI-9.8 修正
依照 wcmc 欄位由大到小排序並顯示前 10 名
點擊排行榜商品可直接切換下方商品行情與 K 線分析
Vercel API 與前端正規化層同步支援 wcmc 欄位
不需要新增 Supabase SQL
```

### UI-9.6

```text
EXP 辨識處理狀態改為只有勾選 Debug 時顯示
OCR 詳細訊息改為只有勾選 Debug 時顯示
關閉 Debug 時不保留狀態訊息空白區塊
OCR 判定、EXP 基準、計數、紀錄與統計邏輯維持不變
```

### UI-9.5

```text
修正初始 EXP 只有單一影像流程成功時持續被拒絕
同一畫面兩種流程一致時立即建立初始基準
單一流程成功時改為連續兩次合理結果確認
第二次允許 EXP 維持不變或合理增加
異常高值與升級後新基準保護維持不變
```

### UI-9.4

```text
修正分析頁退到背景後 EXP 重複上一張畫面的問題
改用 ImageCapture 直接讀取螢幕擷取 MediaStreamTrack 最新影格
OCR 不再依賴分析頁 video 元素持續重繪
新增 Web Worker 背景排程，降低背景分頁計時器節流
Debug 新增影格來源、排程模式與最近影格時間
```

### UI-9.3

```text
修正 EXP 變動需要等待數分鐘才更新
Tesseract Worker 改為開始分析時建立一次並持續重用
正常 EXP 只執行一種優先影像流程
初始、較低、失敗或衝突時才追加其他流程
預設辨識間隔由 3 秒改為 1 秒
Debug 新增 OCR 引擎狀態與單次辨識耗時
```

### UI-9.2

```text
修正後續錯誤 EXP 重複辨識後自動變成新基準
四種 EXP 影像流程改為全部完成後取一致群組
異常高值一律拒絕，不再自動建立新基準
較低 EXP 僅在等級提升一級、多流程一致且連續三次確認後重新建立基準
手動輸入低於目前值可人工設為新基準
```

### UI-9.1

```text
練功效率說明改為簡易 Debug 用途提示
最近 OCR / 手動紀錄新增七種分類按鈕與筆數
預估 10 分與預估 60 分最高值新增速率及離群值排除
避免切換畫面造成異常高的最高紀錄
分析初期短時間超大 EXP 跳升改為待確認兩次
```

### UI-9.0

```text
修正最近 OCR / 手動紀錄在重新建立基準後只剩開始與結束兩筆
OCR 操作紀錄與統計樣本改為分開保存
重新建立 EXP 基準不再刪除先前 OCR 紀錄
每次 OCR 記錄已加入、未變化、待確認、新基準、未辨識或已拒絕
Debug 顯示處理原因與原始 OCR 文字，最多保存 2,000 筆
```

### UI-8.9

```text
修正 EXP 正確辨識後只顯示未加入且拒絕原因被覆蓋
小於基準或與趨勢差異過大的 EXP 改為待確認 1/2
連續兩次相近辨識後設為新基準並重新起算
避免錯誤舊基準與正確新值形成巨大趨勢尖峰
OCR 狀態改為顯示已加入、未變化、待確認或重新建立基準
```

### UI-8.8

```text
修正開始分析時找不到完整狀態列而立即停止
狀態列辨識由三色條強制命中改為任兩色條符合排列即可
開始分析最多重試 10 次，等待最大化 / 全螢幕畫面完成
分析中短暫漏判最多沿用上一個有效位置 3 個週期
單次漏判只略過當次 OCR，不停止整個分析
```

### UI-8.7

```text
修正視窗最大化或全螢幕後 EXP 未辨識（Baty）
EXP 裁切區改為只保留上方文字列，不再包含經驗條
新增二值化140、白字抽取、原圖放大、二值化165四種辨識流程
Tesseract 改用單行文字模式
第一個成功取得 EXP 數字的流程立即採用
Debug 顯示實際辨識來源
```

### UI-8.6

```text
修正當前等級裁切位置正確但數字未辨識
等級預處理改為抽取橘色方塊內的白色數字筆畫
新增像素七段字型辨識，可辨識數字 0～9
像素辨識失敗時改用放大 10 倍的黑字白底 Tesseract 備援
Debug 顯示實際辨識來源
```

### UI-8.5

```text
初始定位改為先辨識完整 LV / HP / MP / EXP 狀態列
以紅色 HP、藍色 MP、綠色 EXP 水平條固定排列比例定位狀態列
確認完整狀態列後才建立當前等級與 EXP OCR 子裁切區
找不到完整狀態列時停止 OCR，不再沿用錯誤舊座標
螢幕擷取對照新增青色完整狀態列框
Debug 新增狀態列辨識參考圖
```

### UI-8.4

```text
修正 EXP 與當前等級初始裁切區位置錯誤
初始裁切改由螢幕擷取對照完整快照辨識
EXP 與等級改用獨立色彩連通區分析
避免同一水平線上的其他綠色或橘色物件被合併為錯誤框
初始定位直接採用截圖結果，後續追蹤才套用平滑
Debug 新增定位來源顯示
```

### UI-8.3

```text
練功效率 EXP OCR 裁切區改為持續自適應定位
遊戲視窗移動或縮放後會自動重新追蹤
當前等級改為自動辨識深色 LV. 區塊內的橘色數字
新增 EXP 與等級雙裁切預覽，橘框為 EXP、藍框為等級
等級範圍限制為 1～200，大幅跳號需連續辨識確認
保留當前等級手動修正與 EXP Debug 手動框選
```

### UI-8.2

```text
公告頁面改為只顯示本次版本實際改動
移除公告內舊版延續資訊
我的自選清單商品旁新增漲跌幅百分比
自選清單漲跌幅顏色同步商品行情折線圖，上漲紅色、下跌綠色
```

### UI-8.1

```text
修正我的自選清單關閉 Artale 物價查詢後回到預設的問題
自選清單改為保存到瀏覽器 localStorage
重新開啟 Artale 物價查詢時會讀取上次保存的自選商品
若商品 id 失效，會保留仍存在的項目，全部失效才回到預設前 2 項
```

### UI-8.0

```text
商品行情列表模式預設高度調整為約顯示前 8 項
其餘商品仍透過商品行情區塊內卷軸查看
首頁版本公告更新為 UI-8.0 內容
```

### UI-7.9

```text
自選清單移到列表模式上面
商品漲跌幅百分比顏色同步折線圖，上漲紅色、下跌綠色
K線分析折線圖右側顯示多個每日最後報價數字，盡量對應每個點
剛進首頁時跳出版本更新公告
公告最後顯示：若有問題可以聯絡作者DC:Mmumu0730
```

### UI-7.8 SQLFIX2

```text
修正 Supabase SQL Editor 執行 SQLFIX1 時 item_name ambiguous
重新建立 merge_artale_price_key_aliases_from_table()
欄位全數改用 table alias，避免 PL/pgSQL output column 衝突
```

### UI-7.8

```text
修正合併成功但 API 讀不到舊資料最後報價
歷史查詢改為 item_key 與正規化 item_name 雙重比對
修正 historyUpdatedAt 未定義導致歷史計算回退
新增 supabase/ui-7-8-sqlfix2-artale-history-read.sql
新增 merge_artale_price_key_aliases_for_items(p_items jsonb)
```

### UI-7.7

```text
修正 Artale 物價歷史 item_key 不穩定問題
支援 Google Sheet 固定 id 欄位作為 item_key
沒有 id 時改用商品名稱正規化 key，不再使用列順序 index
新增 supabase/ui-7-8-sqlfix2-artale-history-read.sql
新增 public.merge_artale_price_key_aliases() 舊 key 合併函式
Serverless API 每次更新報價後會嘗試呼叫 key 合併函式
可把舊的 商品名稱-index 歷史紀錄合併到新的固定 id
```

### UI-7.6

```text
商品行情旁新增狀態與資料庫更新時間
商品列表改為卷軸式，約顯示前 5 項
商品行情與 K線分析折線圖改為上漲紅色、下跌綠色
K線分析折線圖右側顯示最後報價點數字
Artale 物價查詢新增重新讀取報價按鈕
```

