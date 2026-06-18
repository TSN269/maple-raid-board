# Maple Raid Board — TSN UI-7.4

> 版本基準：UI-7.4  
> GitHub 帳號：TSN269  
> 專案用途：楓之谷 / Artale 類型突襲報名看板 + 羅茱跳台協作工具 + 練功效率偵測 + 隊伍收藏 + 遊戲id / 特徵碼紀錄 + Artale 物價查詢  
> 部署架構：GitHub + Supabase + Vercel

---

## 1. 專案概要

本專案是 Maple / Artale 工具站，主要包含：

```text
1. 突襲場次管理
2. 羅茱跳台協作工具
3. 練功效率偵測
4. 隊伍收藏
5. 遊戲id / 特徵碼紀錄
6. Artale 物價查詢
```

---

## 2. 技術架構

| 類型 | 使用技術 |
|---|---|
| 前端 | React + TypeScript + Vite |
| 樣式 | Tailwind CSS |
| 資料庫 | Supabase PostgreSQL |
| Realtime | Supabase Realtime / Presence |
| 部署 | Vercel |
| 原始碼 | GitHub |
| 權限 | Supabase RLS + RPC |
| 本機保存 | localStorage |
| OCR | tesseract.js CDN |
| 圖片輸出 | Canvas / PNG |
| 圖片分享 | Clipboard API / Web Share API |
| 物價面板 | 站內示範資料，可後續串接實際來源 |

---

## 3. 目前 UI-7.4 主要變更

UI-7.4 是以 UI-7.3 為基礎，新增與調整：

```text
1. 物價資料來源改為站長提供 Excel / CSV 檔案位置
   - 支援 ARTALE_PRICE_EXCEL_URL
   - 支援 ARTALE_PRICE_CSV_URL
   - 支援指定 Excel 工作表 ARTALE_PRICE_EXCEL_SHEET
   - 保留舊 ARTALE_PRICE_DATA_URL JSON 相容模式

2. 新增 Vercel API 與 Netlify Function
   - Vercel：/api/artale-prices
   - Netlify：/.netlify/functions/artale-prices
   - 預設前端 endpoint 改為 /api/artale-prices

3. Serverless Function 會自動解析與正規化資料
   - Excel：讀取 xlsx 檔案
   - CSV：讀取 csv 檔案
   - JSON：相容舊資料來源
   - 輸出統一 items JSON 給前端使用

4. 商品行情維持 UI-7.3 調整
   - 無成交量欄位
   - 價格走勢使用折線圖
   - 只保留 1D，不顯示 1H / 3H / 6H

5. 頁首版本顯示
   - TSN UI-7.4
```

UI-7.4 **沒有修改 Supabase schema / RPC**。  
但需要設定 Excel / CSV 物價檔案來源環境變數。

---

## 4. 環境變數

在本機 `.env.local` 或 Vercel Environment Variables 設定：

```env
VITE_SUPABASE_URL=https://你的-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=你的-anon-public-key

# Artale 物價資料來源：站長提供 Excel / CSV 直接下載 URL
ARTALE_PRICE_EXCEL_URL=https://example.com/artale-price.xlsx
ARTALE_PRICE_EXCEL_SHEET=prices
ARTALE_PRICE_CSV_URL=
ARTALE_PRICE_DATA_AUTH_HEADER=

# Vercel 預設使用 /api/artale-prices
# Netlify 可改為 /.netlify/functions/artale-prices
VITE_ARTALE_PRICE_ENDPOINT=/api/artale-prices
```

Vite 專案必須使用 `VITE_` 前綴，否則前端讀不到環境變數。

---

## 5. 本機啟動

```bash
npm install
npm run dev
```

測試 build：

```bash
npm run build
```

---

## 6. Supabase 設定

全新資料庫請執行：

```text
supabase/schema.sql
```

如果是從 UI-6.6 或更舊版本升級，且尚未執行過 UI-6.7 SQLFIX，請在 Supabase SQL Editor 執行：

```text
supabase/ui-6-7-sqlfix-rojhu-toggle-cell.sql
```

UI-7.2 本身不需要新增 SQL。

---

## 7. GitHub / Vercel 部署

已經有 remote 的情況：

```bash
git add .
git commit -m "deploy ui 7.4"
git push
```

Vercel 連接 GitHub repo 後會自動部署。

---

## 8. 頁面結構

| 頁面 / 入口 | 功能 |
|---|---|
| 首頁 | 顯示突襲場次清單與目前選取團 |
| 楓突襲 | 顯示突襲詳細、公告、隊伍配置、團長管理、隊伍收藏 |
| 我要報名 | 顯示報名表單，支援遊戲id#特徵碼下拉選單 |
| 團連結收藏 | 保存與複製一般團連結 / 帶邀請碼團連結 |
| 隊伍收藏 | 顯示已保存隊伍名單 |
| 通知 | 開團提醒、狀態變更、候補轉正 |
| 羅茱工具 | 跳台房間與路徑協作工具 |
| 練功效率偵測 | OCR EXP 分析、統計卡、折線圖、統計紀錄與圖片擷取 |
| 設定 | 匯入 / 匯出團長管理碼、邀請碼、帶邀請碼團連結 |
| 右上蘑菇 Logo | 遊戲id / 特徵碼紀錄 |
| 右上 Artale物價查詢 | 開啟站內物價查詢小頁面 |

---

## 9. 權限與資料保存

```text
1. 團長管理碼與報名邀請碼明碼只保存在本機瀏覽器。
2. Supabase 只保存 hash 或資料庫狀態。
3. 隊伍收藏保存於目前瀏覽器 localStorage。
4. 遊戲id / 特徵碼紀錄保存於目前瀏覽器 localStorage。
5. 練功效率統計資訊紀錄保存於目前瀏覽器 localStorage。
6. Artale 物價查詢透過 Netlify Function 讀取 ARTALE_PRICE_DATA_URL，避免前端直接暴露授權資訊。
```

---

## 10. Boss / 角色定位規則

目前角色定位選項：

```text
打手
火
煙霧機
輔助
大法
控時
清球
清魔靈
```

條件顯示規則：

```text
1. 控時：只在困難鐘王顯示
2. 清球：只在鐘王顯示
3. 清魔靈：只在殘暴炎魔顯示
4. 大法：一般可選角色定位
```

---

## 11. 羅茱工具行為

```text
1. 可建立 / 加入房間
2. 支援分享連結
3. 每人只能選 101 / 102 / 103 / 104 其中一個角色
4. 路徑格子視覺排列為 10 → 1
5. 我的路徑顯示為 1 → 10
6. 快捷鍵 1 / 2 / 3 / 4 可填入下一層
7. 點擊同一格可取消選取
8. 上次路徑自動保存
9. 房間閒置超過 1 小時會強制退出並清空紀錄
```

---

## 12. 練功效率偵測行為

```text
1. 開始分析(F8)
2. 暫停 / 繼續分析(F9)
3. 停止分析(F10)
4. OCR 自動辨識 EXP
5. Debug 模式顯示 OCR 裁切與辨識資訊
6. 輸入當前等級後自動帶入 Artale 經驗表
7. EXP / 分折線圖
8. OCR 極端誤判值過濾
9. 擷取統計資訊圖片
10. 紀錄統計資訊，最多保存最近 10 次
11. 統計資訊紀錄重整後仍保留
12. 統計資訊紀錄可單筆清除
13. 統計資訊紀錄小頁面可擷取歷史紀錄圖片
```

---

## 13. Artale 物價查詢

右上「Artale物價查詢」會開啟站內小頁面。

目前功能：

```text
1. 商品搜尋
2. 商品分類篩選
3. 時間區間切換 1H / 3H / 6H / 1D
4. 均線切換 3MA / 5MA / 20MA
5. 商品行情列表
6. 歷史最後報價
7. 日均(24H)
8. 7日均
9. 迷你趨勢圖
10. 溢價 / 折價監控
11. 價差套利交叉分析
12. 我的自選清單
13. 衝捲期望造價試算
14. 可開啟參考站
```

注意：

```text
目前已改為透過 `ARTALE_PRICE_DATA_URL` 串接實際 JSON 物價資料來源；若未設定資料來源，頁面會顯示讀取失敗提示。
```

---


## 14. Artale 物價 Excel / CSV 欄位格式

站長提供的 Excel / CSV 建議欄位：

```text
name        商品名稱，必填
category    分類，必填
latest      最後報價，必填
avg24h      日均，選填
avg7d       7日均，選填
change      漲跌幅，選填
trend1      走勢點1，選填
trend2      走勢點2，選填
trend3      走勢點3，選填
trend4      走勢點4，選填
trend5      走勢點5，選填
trend6      走勢點6，選填
trend7      走勢點7，選填
```

也支援常見中文欄位：

```text
商品名稱 / 名稱 / 商品
分類 / 類別 / 種類
最後報價 / 最新價格 / 價格 / 現價 / 成交價
日均 / 24H均價 / 24小時均價
7日均 / 七日均 / 7天均價 / 週均價
漲跌幅 / 漲跌 / 變化率
走勢1 ～ 走勢30
```

---


## 15. 常用測試項目

```text
1. 右上 Artale物價查詢是否可開啟小頁面
2. Artale 物價查詢是否可搜尋、切換分類、切換區間與均線
3. Artale 物價查詢是否能從 ARTALE_PRICE_DATA_URL 讀取實際資料
4. Artale 物價查詢是否已移除參考網站按鈕
5. Artale 物價查詢商品行情是否移除成交量
6. Artale 物價查詢價格走勢是否顯示折線圖
7. Artale 物價查詢是否只保留 1D，不顯示 1H / 3H / 6H
8. Artale 物價查詢自選清單與衝捲計算是否可操作
4. 羅茱工具是否可點同一格取消
5. 102 格子是否為整格填滿色
6. 練功效率統計資訊紀錄重整後是否仍存在
7. 左上線上人數是否顯示橘色系樣式
8. 遊戲id / 特徵碼紀錄是否可匯入 / 匯出
9. 報名角色定位條件是否依 Boss 正確顯示
10. Vercel build 是否通過
```

---

## 16. README conflict 處理

若 `git pull` 顯示 README conflict，可直接使用本 README 覆蓋 `README.md` 後提交：

```bash
git status
copy /Y README-UI-7-2-conflict-fixed.md README.md
git add README.md
git commit -m "resolve readme conflict for ui 7.2"
git push
```

如果在 Git Bash / macOS / Linux：

```bash
cp README-UI-7-2-conflict-fixed.md README.md
git add README.md
git commit -m "resolve readme conflict for ui 7.2"
git push
```

---

## 17. 常用指令

```bash
npm install
npm run dev
npm run build
```

推上 GitHub：

```bash
git add .
git commit -m "deploy ui 7.4"
git push
```

---

## 18. 歷代改版紀錄

### UI-4.7

```text
整合早期突襲報名看板、羅茱工具、練功效率偵測、隊伍配置與 README 修正。
```

### UI-4.8

```text
練功效率 Debug 區塊改為勾選後才顯示。
統計時間副資訊改顯示開始分析時間。
```

### UI-4.9

```text
統計時間開始分析時間改完整日期時間。
升級所需總 EXP 改為輸入當前等級。
內建 Artale 1～200 等級經驗表。
```

### UI-5.0

```text
練功效率新增擷取統計圖片。
可把統計區數據輸出 PNG 分享圖片。
```

### UI-5.1

```text
擷取統計圖片優先複製 PNG 到剪貼簿。
按鈕文字改為複製統計圖片。
```

### UI-5.2

```text
練功效率新增停止分析。
暫停分析改為暫停 / 繼續分析。
新增 F8 / F9 / F10 快捷鍵。
複製統計圖片改名為擷取統計資訊。
EXP 增量與預估數值補百分比。
```

### UI-5.3

```text
下方 EXP / 分趨勢改折線圖。
OCR 極端誤判值不加入趨勢圖資料。
```

### UI-5.4

```text
趨勢圖與統計圖片改為網站一致的白底暖色風格。
預估升級時間顯示升級後等級。
```

### UI-5.5

```text
左側新增隊伍收藏。
已結束場次可收藏隊伍名單。
同一場次同一隊重複收藏會覆蓋舊收藏。
```

### UI-5.6

```text
新增突襲場次可帶入隊伍收藏名單。
建立場次後自動加入收藏隊伍成員。
名額上限依帶入人數自動調整，最多 18。
```

### UI-5.7

```text
練功效率 Debug 移到狀態標籤右側。
原標題下方 Debug 獨立區塊移除。
```

### UI-5.8

```text
練功效率按鈕補快捷鍵提示。
開始分析(F8)、暫停 / 繼續分析(F9)、停止分析(F10)。
```

### UI-5.9

```text
右上蘑菇 Logo 新增遊戲id / 特徵碼紀錄小頁面。
我要報名角色名稱若有紀錄會改為下拉式選單。
角色定位新增清球、清魔靈、大法。
控時只在困難鐘王出現。
清球只在 Boss 為鐘王時出現。
清魔靈只在 Boss 為殘暴炎魔時出現。
```

### UI-5.9 SQLFIX1

```text
Supabase 角色定位需求白名單新增大法、清球、清魔靈。
修正不支援的角色定位需求：大法。
遊戲id / 特徵碼紀錄入口改到右上蘑菇 Logo。
```

### UI-6.0

```text
特徵碼限制由剛好 6 位改為 1～6 位英數字元。
```

### UI-6.1

```text
新增突襲場次的團長角色名與遊戲id#特徵碼紀錄連動。
有紀錄時團長角色名改為下拉選單。
```

### UI-6.2

```text
遊戲id / 特徵碼紀錄頁面新增匯入 / 匯出。
練功效率新增紀錄統計資訊。
設定頁面新增匯入 / 匯出管理碼、邀請碼與帶邀請碼團連結紀錄。
```

### UI-6.3

```text
新增突襲場次與我要報名提示改為無遊戲id / 特徵碼紀錄時才顯示。
有紀錄時顯示目前使用已紀錄的遊戲id#特徵碼下拉選單。
```

### UI-6.4

```text
統計資訊紀錄小頁面新增單筆清除。
清除目前查看的紀錄後自動切到下一筆或關閉。
```

### UI-6.5

```text
紀錄統計資訊按鈕右側新增檢視之前統計資訊。
紀錄統計資訊只保留紀錄功能，不再自動彈出紀錄小頁面。
```

### UI-6.6

```text
統計資訊紀錄小頁面新增擷取統計資訊。
可針對目前選取的歷史統計紀錄輸出圖片。
圖片副標題顯示該筆紀錄時間。
```

### UI-6.7

```text
羅茱工具格子支援重複點擊選取 / 取消。
修正 102 格子顏色為整格填滿角色顏色。
新增 Supabase SQLFIX 讓遠端房間支援清除單格。
```

### UI-6.8

```text
修正練功效率偵測的統計資訊紀錄重整頁面後消失。
統計資訊紀錄改為保存到瀏覽器 localStorage。
清除單筆紀錄時同步更新 localStorage。
```

### UI-6.9

```text
左上 Logo 下方新增線上人數。
線上人數使用 Supabase Realtime Presence 統計。
Supabase 未設定時顯示本機人數 1。
```

### UI-7.0

```text
左上 Logo 下方線上人數改為深色底樣式。
顯示順序改為：線上人數 + 人像圖示 + 數字。
```

### UI-7.1

```text
線上人數欄位顏色風格改為本站一致的橘色系。
樣式與 TSN UI 版本標籤一致。
```

### UI-7.2

```text
右上複製團連結按鈕改為 Artale物價查詢。
新增 Artale 物價查詢小頁面。
小頁面參考 Artale 楓之股的列表模式、K線分析、價差套利、衝捲計算與自選清單。
Artale 物價查詢 UI 改成符合本站白底 / 橘色系風格。
```

### UI-7.3

```text
Artale 物價查詢移除參考網站按鈕
新增 Netlify Function 串接實際 JSON 物價資料來源
商品行情移除成交量欄位
商品行情價格走勢改為折線圖
時間區間移除 1H / 3H / 6H，只保留 1D
```

### UI-7.4

```text
物價資料來源改由站長提供 Excel / CSV 檔案位置
新增 Vercel API /api/artale-prices
保留 Netlify Function /.netlify/functions/artale-prices
Serverless Function 自動解析 xlsx / csv / json 並轉成前端物價資料格式
前端預設 endpoint 改為 /api/artale-prices
目前最新版本
```
