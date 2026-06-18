# Maple Raid Board — TSN UI-7.5

> GitHub 帳號：TSN269  
> 部署架構：GitHub + Supabase + Vercel  
> 專案用途：突襲報名看板、羅茱跳台協作、練功效率偵測、隊伍收藏、遊戲 id / 特徵碼紀錄、Artale 物價查詢。

---

## 1. UI-7.5 主要變更

```text
1. Artale 物價查詢頁首整理
   - 不顯示資料源欄
   - 移除「已改為讀取站長提供的 Excel / CSV...」說明字眼

2. 商品行情版面調整
   - 商品行情欄不再顯示 1D / 3MA / 5MA / 20MA
   - 商品行情只顯示最後報價、7日均、30日均
   - 保留價格走勢折線圖

3. K線分析欄調整
   - 1D / 3MA / 5MA / 20MA 移到 K線分析欄
   - 歷史最後報價、7日均、30日均 三欄排列
   - 原日均(24H) 改為 30日均，放在 7日均右邊

4. 自動保存每日最後報價
   - 新增 Supabase 表 artale_price_daily_records
   - /api/artale-prices 每次讀取 Excel / CSV 後會把當日最後報價 upsert 到資料庫
   - vercel.json 新增每日 Cron 呼叫 /api/artale-prices
   - 走勢圖資料由資料庫歷史紀錄產生
   - 7日均與30日均由資料庫歷史紀錄計算
```

UI-7.5 **需要新增 Supabase SQL**。

---

## 2. 環境變數

Vercel Project → Settings → Environment Variables 設定：

```env
VITE_SUPABASE_URL=https://你的-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=你的-anon-public-key

SUPABASE_SERVICE_ROLE_KEY=你的-service-role-key

ARTALE_PRICE_EXCEL_URL=
ARTALE_PRICE_EXCEL_SHEET=prices
ARTALE_PRICE_CSV_URL=https://docs.google.com/spreadsheets/d/e/xxxx/pub?gid=0&single=true&output=csv
ARTALE_PRICE_GOOGLE_SHEET_GID=
ARTALE_PRICE_DATA_AUTH_HEADER=

VITE_ARTALE_PRICE_ENDPOINT=/api/artale-prices
```

`SUPABASE_SERVICE_ROLE_KEY` 是 Serverless API 寫入每日物價歷史用的金鑰。不要加 `VITE_`，不要放到前端程式碼。

---

## 3. Supabase SQL

部署 UI-7.5 前，請先到 Supabase SQL Editor 執行：

```text
supabase/ui-7-5-artale-price-history.sql
```

這會建立：

```text
public.artale_price_daily_records
```

欄位：

```text
item_key      商品 key
price_date    每日日期
item_name     商品名稱
category      分類
last_price    每日最後報價
source        來源 URL
created_at
updated_at
```

主鍵：

```text
(item_key, price_date)
```

所以同一天重複抓資料時，會更新同一天的最後報價，不會重複新增。

---

## 4. Google Sheet CSV 欄位

Google Sheet 第一列建議：

```text
商品名稱,分類,最後報價
```

也可使用英文：

```text
name,category,latest
```

選填欄位：

```text
7日均
30日均
漲跌幅
```

但 UI-7.5 會以資料庫歷史紀錄重新計算 7日均、30日均與走勢圖，所以 Excel / CSV 最重要的是每日最新價格。

---

## 5. Vercel Cron

`vercel.json` 已新增：

```json
{
  "path": "/api/artale-prices",
  "schedule": "55 15 * * *"
}
```

這代表每天 UTC 15:55 呼叫一次 `/api/artale-prices`，約等於台灣時間 23:55，用來保存每日最後報價。

使用者打開 Artale 物價查詢時，也會呼叫同一支 API，並更新當日紀錄。

---

## 6. 部署

```bash
npm install
npm run build
```

推上 GitHub：

```bash
git add .
git commit -m "deploy ui 7.5"
git push
```

Vercel 建議設定：

```text
Node.js Version: 20.x
Install Command: npm install --no-package-lock --prefer-online --no-audit --no-fund
Build Command: node -v && npm -v && npm run build
```

---

## 7. 升級檢查

```text
1. Supabase 已執行 supabase/ui-7-5-artale-price-history.sql
2. Vercel 已設定 SUPABASE_SERVICE_ROLE_KEY
3. Vercel 已設定 ARTALE_PRICE_CSV_URL 或 ARTALE_PRICE_EXCEL_URL
4. 重新 Deploy 並 Clear Build Cache
5. 開啟右上 Artale物價查詢
6. 確認沒有顯示資料源欄
7. 確認 1D / 3MA / 5MA / 20MA 已移到 K線分析
8. 確認商品行情顯示最後報價、7日均、30日均
9. Supabase artale_price_daily_records 有新增當日資料
```

---

## 8. 歷代改版紀錄

### UI-7.5

```text
Artale 物價查詢隱藏資料源欄與說明字眼
1D / 3MA / 5MA / 20MA 移到 K線分析
日均(24H) 改為 30日均
每日最後報價自動寫入 Supabase
走勢圖、7日均、30日均由資料庫歷史紀錄計算
目前最新版本
```

### UI-7.4 CSVFIX1

```text
修正 Google Sheet CSV 讀取
支援 Google Sheet 分享連結 / pubhtml 自動轉 CSV
CSV / Excel 自動尋找欄位列
```

### UI-7.4 VERCELFIX2

```text
固定 Node.js 20.x
修正 Vercel npm install Exit handler never called
```

### UI-7.4

```text
物價資料來源改為站長提供 Excel / CSV 檔案位置
新增 Vercel API /api/artale-prices
```

### UI-7.3

```text
Artale 物價查詢移除參考網站按鈕
商品行情移除成交量
價格走勢改為折線圖
移除 1H / 3H / 6H
```

### UI-7.2

```text
新增 Artale 物價查詢小頁面
```

### UI-7.1

```text
線上人數欄位改為網站橘色系風格
```

### UI-7.0

```text
左上 Logo 下方線上人數樣式調整
```

### UI-6.9

```text
新增左上 Logo 下方線上人數
```
