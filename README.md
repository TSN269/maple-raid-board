# Maple Raid Board — TSN UI-8.3

> React + TypeScript + Vite + Supabase + Vercel  
> GitHub：TSN269 / maple-raid-board  
> 最新版本：UI-8.3  
> 主要用途：楓之谷 / Artale 突襲報名、羅茱跳台協作、練功效率偵測、隊伍收藏、遊戲 ID 紀錄、Artale 物價查詢。

---

## 目錄

```text
1. 專案概要
2. 目前版本重點
3. 功能總覽
4. 技術架構
5. 環境變數
6. Supabase SQL
7. Artale 物價資料格式
8. Vercel 部署
9. 本機開發
10. 常見問題
11. GitHub 推送指令
12. UI-7.7 舊 key 合併修正
13. 歷代改版紀錄
```

---

## 1. 專案概要

Maple Raid Board 是一個 Artale / Maple 類型工具站，主要功能如下：

```text
1. 突襲報名看板
2. 羅茱跳台協作工具
3. 練功效率偵測
4. 隊伍收藏
5. 遊戲 ID / 特徵碼紀錄
6. Artale 物價查詢
```

專案使用 Supabase 作為資料庫與 Realtime 後端，使用 Vercel 部署前端與 Serverless API。

---

## 2. 目前版本重點

目前最新版本為 **UI-8.3**。

```text
1. 商品行情旁新增「狀態」
   - 顯示資料庫更新時間
   - 來源為 artale_price_daily_records.updated_at 的最新時間

2. 商品列表改成卷軸式
   - 預設高度約顯示前 5 項
   - 其餘商品可往下捲動查看

3. 折線圖顏色調整
   - 上漲：紅色
   - 下跌：綠色
   - 商品行情與 K線分析同步套用

4. K線分析折線圖
   - 右側顯示最後報價點數字
   - 方便直接查看最後一筆價格

5. Artale 物價查詢
   - 關閉按鈕左邊新增「重新讀取報價」
   - 按下後重新呼叫 /api/artale-prices
   - 立即刷新 Google Sheet CSV、資料庫歷史紀錄、7日均、30日均、走勢圖
```

---

## 3. 功能總覽

### 3.1 突襲報名看板

```text
1. 建立突襲場次
2. 場次可設定 NORMAL / HARD
3. 場次可設定招募人數 1～18
4. 人數會自動對應隊伍數：
   - 1～6 人：1 隊
   - 7～12 人：2 隊
   - 13～18 人：3 隊
5. 團長可設定角色需求
6. 玩家報名時只會看到團長設定的角色需求
7. 團長可拖曳調整隊伍
8. 團長可刪除成員、修改狀態、刪除團
9. 查看名單只顯示已確認成員
10. 支援管理碼、邀請碼、團連結
```

### 3.2 羅茱跳台協作工具

```text
1. 支援多人同步房間
2. 支援房間代碼與房間密碼
3. 每人只能選擇一個角色
4. 支援 1～4 快捷鍵
5. 支援 1 → 10 路徑格
6. 支援儲存上次路徑
7. 支援迷你上次路徑格
8. 支援清除與重置
9. 閒置 1 小時後可自動清空房間
10. 手機版強制左右欄與可滑動版面
```

### 3.3 練功效率偵測

```text
1. 按下開始分析後啟動 OCR
2. 自動抓取 EXP 區域
3. 支援手動框選 OCR 裁切區域
4. 支援儲存預設裁切區域
5. 支援暫停、繼續、停止
6. 顯示開始時間與統計時間
7. 顯示 EXP 增量與百分比
8. 顯示預估 10 分鐘 / 60 分鐘效率
9. 支援折線圖趨勢
10. 支援極端值排除
11. 支援統計紀錄保存
12. 支援統計紀錄刪除
13. 支援統計紀錄匯出圖片
14. 支援複製圖片到剪貼簿
```

### 3.4 隊伍收藏

```text
1. 可收藏團連結
2. 可建立常用隊伍名單
3. 建立場次時可匯入收藏隊伍
4. 支援角色定位與遊戲 ID
```

### 3.5 遊戲 ID / 特徵碼紀錄

```text
1. 右上蘑菇 Logo 可開啟紀錄面板
2. 可紀錄遊戲 ID
3. 可紀錄特徵碼
4. 報名時可自動帶入已紀錄資料
5. 建立場次時團長欄位可用下拉選擇已紀錄遊戲 ID
```

### 3.6 Artale 物價查詢

```text
1. 右上 Artale 物價查詢按鈕開啟小頁面
2. 支援 Google Sheet CSV 作為物價來源
3. 支援搜尋商品
4. 支援分類篩選
5. 商品行情顯示：
   - 最後報價
   - 7日均
   - 30日均
6. 商品行情採卷軸式清單
7. 折線圖上漲紅色、下跌綠色
8. K線分析支援：
   - 1D
   - 3MA
   - 5MA
   - 20MA
9. K線分析右側顯示最後報價點數字
10. 重新讀取報價可立即刷新資料
11. 自動保存每日最後報價到資料庫
12. 走勢圖、7日均、30日均由資料庫歷史紀錄計算
```

---

## 4. 技術架構

| 類型 | 技術 |
|---|---|
| 前端框架 | React |
| 語言 | TypeScript |
| 建置工具 | Vite |
| 樣式 | Tailwind CSS |
| 資料庫 | Supabase PostgreSQL |
| 即時同步 | Supabase Realtime / Presence |
| 後端 API | Vercel Serverless Function |
| 部署 | Vercel |
| OCR | tesseract.js CDN |
| 圖片輸出 | Canvas |
| 圖片分享 | Clipboard API / Web Share API |
| 本機資料 | localStorage |
| 物價資料源 | Google Sheet CSV / CSV URL |
| 物價歷史 | Supabase REST API 寫入 |

---

## 5. 環境變數

### 5.1 Vercel Production 必填

到 Vercel：

```text
Project
→ Settings
→ Environment Variables
```

新增：

```env
VITE_SUPABASE_URL=https://你的-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=你的-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=你的-service-role-key

ARTALE_PRICE_CSV_URL=https://docs.google.com/spreadsheets/d/e/xxxx/pub?gid=0&single=true&output=csv
ARTALE_PRICE_GOOGLE_SHEET_GID=
ARTALE_PRICE_DATA_AUTH_HEADER=

VITE_ARTALE_PRICE_ENDPOINT=/api/artale-prices
```

### 5.2 注意事項

```text
1. SUPABASE_SERVICE_ROLE_KEY 不可加 VITE_
2. SUPABASE_SERVICE_ROLE_KEY 只給 Serverless API 使用
3. 不要把 service_role key 寫進前端程式碼
4. VITE_SUPABASE_ANON_KEY 是前端可用的 anon key
5. ARTALE_PRICE_CSV_URL 建議使用 Google Sheet 發布到網路後的 CSV 連結
```

---

## 6. Supabase SQL

UI-7.7 沿用 UI-7.5 的物價歷史資料表，並新增舊 key 合併 SQL。

尚未執行過者，請先到 Supabase SQL Editor 執行：

```text
supabase/ui-7-5-artale-price-history.sql
```

Google Sheet 已新增固定 id 欄位後，請再執行一次舊 key 合併 SQL：

```text
supabase/ui-7-8-sqlfix2-artale-history-read.sql
```

或執行獨立 SQL 檔：

```text
sqlfix-ui-7-5-artale-price-history.sql
```

此 SQL 會建立：

```text
public.artale_price_daily_records
```

資料表用途：

```text
1. 保存每日最後報價
2. 同一天同商品重複抓取時更新當天資料
3. 走勢圖從此表查詢
4. 7日均從此表最近 7 筆 / 7 日資料計算
5. 30日均從此表最近 30 筆 / 30 日資料計算
```

主要欄位：

| 欄位 | 說明 |
|---|---|
| item_key | 商品唯一鍵 |
| price_date | 價格日期 |
| item_name | 商品名稱 |
| category | 商品分類 |
| last_price | 每日最後報價 |
| source | 資料來源 |
| created_at | 建立時間 |
| updated_at | 更新時間 |

主鍵：

```text
(item_key, price_date)
```

---

## 7. Artale 物價資料格式

Google Sheet 建議第一列使用：

```text
商品名稱,分類,最後報價
```

範例：

```csv
商品名稱,分類,最後報價
混沌卷軸 60%,卷軸,28500000
手套攻擊卷軸 60%,卷軸,16800000
白色藥水,消耗品,850
```

也可使用英文欄位：

```text
name,category,latest
```

支援常見欄位名稱：

```text
商品名稱
名稱
商品
道具名稱
物品名稱
品名
物品
道具
分類
類別
種類
最後報價
最新價格
價格
現價
成交價
目前價格
最新成交
最新成交價
市場價格
```

### Google Sheet CSV 取得方式

```text
Google Sheet
→ 檔案
→ 分享
→ 發布到網路
→ 選擇工作表
→ 格式選「逗號分隔值 .csv」
→ 發布
→ 複製產生的 CSV 連結
```

建議 URL 類型：

```text
https://docs.google.com/spreadsheets/d/e/xxxx/pub?gid=0&single=true&output=csv
```

---

## 8. Vercel 部署

### 8.1 Vercel 專案設定

建議：

```text
Framework Preset: Vite
Node.js Version: 20.x
Install Command:
rm -rf node_modules package-lock.json && npm install --no-package-lock --prefer-online --no-audit --no-fund

Build Command:
node -v && npm -v && npm run build

Output Directory:
dist
```

### 8.2 vercel.json

專案內已包含：

```json
{
  "framework": "vite",
  "installCommand": "rm -rf node_modules package-lock.json && npm install --no-package-lock --prefer-online --no-audit --no-fund",
  "buildCommand": "node -v && npm -v && npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/((?!api/.*).*)",
      "destination": "/"
    }
  ],
  "crons": [
    {
      "path": "/api/artale-prices",
      "schedule": "55 15 * * *"
    }
  ]
}
```

Cron 說明：

```text
55 15 * * *
```

代表每天 UTC 15:55 呼叫 `/api/artale-prices`，約等於台灣時間 23:55，用來保存每日最後報價。

---

## 9. 本機開發

安裝：

```bash
npm install
```

啟動：

```bash
npm run dev
```

Build：

```bash
npm run build
```

Type check：

```bash
npm run typecheck
```

Lint：

```bash
npm run lint
```

---

## 10. 常見問題

### 10.1 Vercel npm install：Exit handler never called

處理方式：

```text
1. 固定 Node.js 20.x
2. 清除 Build Cache
3. Install Command 使用：
   rm -rf node_modules package-lock.json && npm install --no-package-lock --prefer-online --no-audit --no-fund
```

### 10.2 Vercel npm install：ENOTEMPTY adler-32

UI-7.5 VERCELFIX1 已移除 `xlsx` 與 `adler-32` 相關依賴。

目前物價資料建議使用 Google Sheet CSV，不需要 xlsx parser。

### 10.3 Node.js 20 without native WebSocket support

UI-7.5 VERCELFIX2 已修正。

Serverless API 不再 import `@supabase/supabase-js`，改用 Supabase REST API 寫入與查詢 `artale_price_daily_records`。

### 10.4 物價資料讀取失敗：沒有可用商品資料

檢查：

```text
1. ARTALE_PRICE_CSV_URL 是否為 CSV 連結
2. Google Sheet 是否已發布到網路
3. 第一列是否有商品名稱與最後報價欄位
4. 價格欄位是否為數字
5. Vercel 是否重新部署
```

### 10.5 資料庫沒有寫入每日價格

檢查：

```text
1. 是否已執行 supabase/ui-7-5-artale-price-history.sql
2. Vercel 是否有 SUPABASE_SERVICE_ROLE_KEY
3. Vercel 是否有 VITE_SUPABASE_URL
4. /api/artale-prices 是否成功回傳資料
5. Supabase Table Editor 是否看到 artale_price_daily_records
```

---

## 11. GitHub 推送指令

一般更新：

```bash
git add .
git commit -m "deploy ui 8.3"
git push
```

如果遠端比較新：

```bash
git pull --rebase origin main
git push origin main
```

如果 README conflict：

```bash
git status
git add README.md
git rebase --continue
git push origin main
```

---

## 12. UI-7.7 舊 key 合併修正

UI-7.7 針對 Artale 物價歷史資料的 `item_key` 進行修正。

舊版在 Google Sheet 沒有固定 `id` 欄位時，會用：

```text
商品名稱-列順序
```

例如：

```text
混沌卷軸 60%-0
手套攻擊卷軸 60%-1
```

只要 Google Sheet 排序變更、插入商品、刪除商品，列順序就可能改變，導致舊歷史資料看起來消失。

UI-7.7 修正：

```text
1. 優先使用 Google Sheet 的 id 欄位作為 item_key
2. 沒有 id 時，改用商品名稱正規化 key
3. 不再使用列順序 index 作為 item_key
4. 新增 SQLFIX 合併舊 key
```

建議欄位：

```csv
id,商品名稱,分類,最後報價
chaos_scroll_60,混沌卷軸 60%,卷軸,28500000
glove_att_60,手套攻擊卷軸 60%,卷軸,16800000
```

合併順序：

```text
1. 部署 UI-7.8
2. 開啟 Artale 物價查詢
3. 按「重新讀取報價」
4. 到 Supabase SQL Editor 執行 supabase/ui-7-8-sqlfix2-artale-history-read.sql
5. 再按一次「重新讀取報價」
```


---

## UI-7.8 舊資料讀取修正

UI-7.8 修正「合併成功但前端讀不到舊資料最後報價」問題。

原因：

```text
1. UI-7.7 合併 SQL 可能已把資料合併到新 key
2. 但 API 只用 item_key 精準查詢目前 Google Sheet 的 id
3. 如果舊資料 item_name 相同但 key 還沒完全對上，走勢圖 / 7日均 / 30日均仍可能讀不到
4. UI-7.7 API 也有 historyUpdatedAt 未定義問題，可能導致歷史資料計算回退
```

修正：

```text
1. 歷史資料查詢改為最近 365 天
2. API 讀取歷史資料時同時比對：
   - item_key
   - 正規化 item_name
3. 同一天多筆資料時保留 updated_at 較新的資料
4. 新增 merge_artale_price_key_aliases_for_items(p_items jsonb)
5. API 會把目前 Google Sheet 的固定 id / 商品名稱傳給 SQL function 合併
```

補救順序：

```text
1. 部署 UI-7.8
2. 按一次「重新讀取報價」
3. 到 Supabase SQL Editor 執行：
   supabase/ui-7-8-sqlfix2-artale-history-read.sql
4. 再按一次「重新讀取報價」
```


---

## UI-7.8 SQLFIX2

修正 Supabase SQL Editor 執行 `ui-7-8-artale-history-read-sqlfix1.sql` 時出現：

```text
ERROR: 42702: column reference "item_name" is ambiguous
```

原因是 PL/pgSQL `returns table` 裡有輸出欄位 `item_name`，function 內部又直接寫 `item_name`，PostgreSQL 無法判斷要用輸出變數還是資料表欄位。

SQLFIX2 已把相關欄位全部改成 table alias，例如：

```text
r.item_name
q.item_name
f.item_name
```

執行檔案：

```text
supabase/ui-7-8-sqlfix2-artale-history-read.sql
```


---

## UI-7.9 更新內容

```text
1. 自選清單移到列表模式上面
2. 商品漲跌幅百分比顏色同步折線圖
   - 上漲：紅色
   - 下跌：綠色
3. K線分析折線圖右側顯示多個每日最後報價數字
   - 盡量對應每個價格點
   - 點數太多時自動保留合理間距
4. 進入首頁時跳出版本更新公告
   - 公告列出當下版本更新內容
   - 最後顯示：若有問題可以聯絡作者DC:Mmumu0730
```

---

## UI-8.0 更新內容

```text
1. 商品行情列表模式預設高度調整為約顯示前 8 項
2. 其餘商品仍透過商品行情區塊內卷軸查看
3. 首頁版本公告已更新為 UI-8.0 內容
```

---

## UI-8.1 更新內容

```text
1. 修正我的自選清單關閉 Artale 物價查詢後會回到預設的問題
2. 自選清單改為保存到瀏覽器 localStorage
3. 重新開啟 Artale 物價查詢時會讀取上次保存的自選商品
4. 若 Google Sheet 商品 id 變動，會自動保留仍存在的自選商品；若全部失效才回到預設前 2 項
```

---

## UI-8.2 更新內容

```text
1. 公告頁面改為只顯示本次版本實際改動
2. 移除公告內舊版延續資訊，避免和當前版本更新內容混在一起
3. 我的自選清單商品旁新增漲跌幅百分比
4. 自選清單漲跌幅顏色同步商品行情折線圖：
   - 上漲：紅色
   - 下跌：綠色
```

---

## UI-8.3 更新內容

```text
1. 練功效率 EXP OCR 裁切區改為持續自適應
   - 每次 OCR 週期重新偵測畫面錨點
   - 遊戲視窗移動、縮放後自動重新定位
   - 偵測不到時沿用上次成功位置，不會立刻跳回固定預設

2. 當前等級改為自動辨識
   - 尋找深色 LV. 區塊內的橘色數字
   - 例如附圖「LV. 136」會辨識為 136 等
   - 辨識範圍限制為 1～200
   - 大幅跳號需連續兩次辨識一致才套用

3. 新增雙裁切預覽與框線
   - 橘框：EXP OCR
   - 藍框：等級 OCR

4. 保留手動備援
   - 當前等級仍可手動修正
   - Debug 可手動框選 EXP 區域
   - 等級區域維持自適應定位
```

---

## 13. 歷代改版紀錄

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

### UI-8.3

```text
練功效率 EXP OCR 裁切區改為持續自適應定位
遊戲視窗移動或縮放後會自動重新追蹤
當前等級改為自動辨識深色 LV. 區塊內的橘色數字
新增 EXP 與等級雙裁切預覽，橘框為 EXP、藍框為等級
等級範圍限制為 1～200，大幅跳號需連續辨識確認
保留當前等級手動修正與 EXP Debug 手動框選
目前最新版本
```

### UI-8.2

```text
公告頁面改為只顯示本次版本實際改動
移除公告內舊版延續資訊
我的自選清單商品旁新增漲跌幅百分比
自選清單漲跌幅顏色同步商品行情折線圖，上漲紅色、下跌綠色
目前最新版本
```

### UI-8.1

```text
修正我的自選清單關閉 Artale 物價查詢後回到預設的問題
自選清單改為保存到瀏覽器 localStorage
重新開啟 Artale 物價查詢時會讀取上次保存的自選商品
若商品 id 失效，會保留仍存在的項目，全部失效才回到預設前 2 項
目前最新版本
```

### UI-8.0

```text
商品行情列表模式預設高度調整為約顯示前 8 項
其餘商品仍透過商品行情區塊內卷軸查看
首頁版本公告更新為 UI-8.0 內容
目前最新版本
```

### UI-7.9

```text
自選清單移到列表模式上面
商品漲跌幅百分比顏色同步折線圖，上漲紅色、下跌綠色
K線分析折線圖右側顯示多個每日最後報價數字，盡量對應每個點
剛進首頁時跳出版本更新公告
公告最後顯示：若有問題可以聯絡作者DC:Mmumu0730
目前最新版本
```

### UI-7.8 SQLFIX2

```text
修正 Supabase SQL Editor 執行 SQLFIX1 時 item_name ambiguous
重新建立 merge_artale_price_key_aliases_from_table()
欄位全數改用 table alias，避免 PL/pgSQL output column 衝突
目前最新版本
```

### UI-7.8

```text
修正合併成功但 API 讀不到舊資料最後報價
歷史查詢改為 item_key 與正規化 item_name 雙重比對
修正 historyUpdatedAt 未定義導致歷史計算回退
新增 supabase/ui-7-8-sqlfix2-artale-history-read.sql
新增 merge_artale_price_key_aliases_for_items(p_items jsonb)
目前最新版本
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
目前最新版本
```

### UI-7.6

```text
商品行情旁新增狀態與資料庫更新時間
商品列表改為卷軸式，約顯示前 5 項
商品行情與 K線分析折線圖改為上漲紅色、下跌綠色
K線分析折線圖右側顯示最後報價點數字
Artale 物價查詢新增重新讀取報價按鈕
目前最新版本
```
