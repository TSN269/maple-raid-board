# Maple Raid Board — TSN UI-V39

> 版本基準：UI-V39  
> GitHub 帳號：TSN269  
> 專案用途：楓之谷 / Artale 類型突襲報名看板 + 羅茱跳台協作工具  
> 部署架構：GitHub + Supabase + Vercel

---

## 1. 專案概要

本專案是從「突襲報名看板」開始逐步改版而成，主要分成兩大功能：

### A. 突襲場次管理

提供 Boss 團報名、團長管理、邀請碼、狀態管理、通知中心與防洗版功能。

目前功能包含：

- 突襲場次清單
- 楓突襲詳細頁
- 我要報名頁
- 團長管理碼
- 報名邀請碼
- 帶邀請碼分享連結
- 團連結收藏
- 通知中心
- 一般玩家只能報名
- 團長才能刪除成員、改狀態、刪除團
- 報名上限 18 人
- 隊伍配置 3 隊
- Boss + NORMAL / HARD 難度標示
- 防亂填與防洗版機制

### B. 羅茱工具

提供羅茱跳台 / 路徑解謎協作功能。

目前功能包含：

- 建立房間
- 加入房間
- 手動輸入房間代碼 / 密碼
- 房間分享連結
- Supabase 多人即時同步
- 101 / 102 / 103 / 104 角色選擇
- 同房間角色選擇鎖定
- 路徑格子 10 層 × 4 格
- 格子視覺維持 10 → 1
- 「我的路徑」顯示為 1 → 10
- 按鍵盤 1 / 2 / 3 / 4 可快速填入下一層
- 10 層填滿後快捷鍵停止填入
- 每個角色顏色永久顯示在格子上
- 上次路徑自動保存
- 上次路徑可單獨清除
- 房間閒置超過 1 小時強制退出並清空紀錄

---

## 2. 技術架構

| 類型 | 使用技術 |
|---|---|
| 前端 | React + TypeScript + Vite |
| 樣式 | Tailwind CSS |
| 資料庫 | Supabase PostgreSQL |
| Realtime | Supabase Realtime |
| 部署 | Vercel |
| 原始碼 | GitHub |
| 權限 | Supabase RLS + RPC |
| 本機保存 | localStorage |

---

## 3. 目前 UI-V39 主要變更

UI-V39 是以 UI-V38 為基礎，修正：

```text
1. 修正練功效率偵測頁面開啟後空白 / crash
   - 原因：TrainingEfficiencyPanel 使用 Field 元件
   - 但 App.tsx 沒有從 components/ui 匯入 Field
   - UI-V39 已補上 Field import

2. 練功效率偵測功能維持 UI-V38 設計
   - 統計卡片
   - EXP / 分趨勢圖
   - 開始 / 暫停 / 重置
   - 本站橘色楓葉風格

3. 頁首版本顯示
   - TSN UI-V39
```

UI-V39 **沒有修改 Supabase schema / RPC**。  
如果已經執行過 UI-V33 SQLFIX1 的 SQL，升級 UI-V39 不需要重跑 SQL。

---

## 4. 環境變數

在本機 `.env.local` 或 Vercel Environment Variables 設定：

```env
VITE_SUPABASE_URL=https://你的-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=你的-anon-public-key
```

Vite 專案必須使用 `VITE_` 前綴，否則前端讀不到環境變數。

---

## 5. 本機啟動

```bash
npm install
npm run dev
```

預設本機網址通常是：

```text
http://localhost:5173
```

測試 build：

```bash
npm run build
```

---

## 6. Supabase 設定

如果是全新資料庫，或從 UI-V25 以前升級到 V27，請執行：

```text
supabase/schema.sql
```

操作流程：

```text
Supabase
→ SQL Editor
→ New query
→ 貼上 supabase/schema.sql
→ Run
```

如果你已經執行過 UI-V25 或之後的 SQL，UI-V27 不需要再重跑 SQL。

---

## 7. GitHub / Vercel 部署

### 第一次推到 GitHub

```bash
git init
git add .
git commit -m "deploy ui v39"
git branch -M main
git remote add origin https://github.com/TSN269/maple-raid-board.git
git push -u origin main --force
```

### 已經有 remote 的情況

```bash
git add .
git commit -m "deploy ui v39"
git push
```

### remote 已存在但網址錯誤

```bash
git remote set-url origin https://github.com/TSN269/maple-raid-board.git
git push -u origin main --force
```

Vercel 連接 GitHub repo 後會自動部署。

---

## 8. 頁面結構

左側導覽列包含：

| 按鈕 | 功能 |
|---|---|
| 首頁 | 顯示突襲場次清單與目前選取團 |
| 楓突襲 | 顯示突襲詳細內容、公告、隊伍配置、團長管理 |
| 我要報名 | 顯示報名表單 |
| 團連結收藏 | 複製一般團連結 / 帶邀請碼團連結 |
| 通知 | 開團提醒、狀態變更、候補轉正 |
| 羅茱工具 | 跳台房間與路徑協作工具 |
| 設定 | 查看本機保存的團長管理碼、邀請碼、帶邀請碼連結 |

---

## 9. 權限設計

### 一般玩家

一般玩家只能：

```text
1. 查看場次
2. 使用邀請碼報名
```

一般玩家不能：

```text
1. 改成員狀態
2. 刪除成員
3. 刪除團
4. 修改招募狀態
5. 直接寫入資料表
```

### 團長

團長需要管理碼，才能：

```text
1. 修改招募狀態
2. 修改成員狀態
3. 刪除成員
4. 刪除團
5. 保存報名邀請碼
6. 複製帶邀請碼團連結
```

---

## 10. 報名防亂填與防洗版

目前防護包含：

```text
1. 報名邀請碼
2. 同團同角色名稱不可重複
3. 角色名稱長度限制
4. 等級範圍限制
5. 備註長度限制
6. 控制字元過濾
7. honeypot 隱藏欄位
8. browser nonce
9. 報名冷卻時間
10. 報名改走 Supabase RPC
11. 停用匿名 direct insert
```

---

## 11. 羅茱工具行為

### 房間

```text
1. 可建立房間
2. 可手動輸入 6 位房間代碼
3. 可手動輸入 4～8 位密碼
4. 留空時自動產生
5. 可用分享連結加入房間
```

分享連結格式類似：

```text
?tool=rojhu&rojhuRoom=123456&rojhuPass=1234
```

### 角色鎖定

```text
1. 每人只能選 101 / 102 / 103 / 104 其中一個角色
2. 同房間內，一個角色被選後，其他人不可再選
3. 退出房間會釋放角色
```

### 路徑顯示

```text
1. 格子視覺排列：10 → 1
2. 我的路徑顯示：1 → 10
3. 我的路徑不顯示前面層數
4. 例如：? → 2 → 1 → ? → ...
```

### 快捷鍵

```text
1. 按 1：填入下一層第 1 格
2. 按 2：填入下一層第 2 格
3. 按 3：填入下一層第 3 格
4. 按 4：填入下一層第 4 格
5. 10 層都填滿後停止填入
6. 游標在 input / textarea / select 內時，不觸發快捷鍵
```

### 上次路徑

```text
1. 不再需要手動按「保存當下路徑」
2. 每次路徑選擇後會自動保存目前路徑
3. 可用「清除此欄紀錄」只清除上次路徑
4. 清除上次路徑不影響目前路徑
```

### 閒置清理

```text
1. 房間超過 1 小時未更新
2. 自動強制退出
3. 清空目前路徑
4. 清空上次路徑
5. 清空角色鎖定
```

---

## 12. 歷代改版紀錄

### 初始版

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

### UI-V2

```text
大幅重做 UI：
- 暖色楓葉風格
- 左側導覽
- Hero 區
- 統計卡
- 右側報名面板
```

### UI-V3

```text
導覽分頁化：
- 首頁顯示突襲場次清單
- 我要報名顯示報名表單
```

### UI-V4

```text
調整左側按鈕分工：
- 首頁：突襲場次清單
- 楓突襲：突襲詳細內容
- 我要報名：報名表單
```

### UI-V5

```text
清理頁尾提示文字
移除多餘按鈕
新增難度選項：
- 簡單
- 困難
```

### UI-V6

```text
隊伍配置改為 3 隊
報名表單隊伍選項限制為 1～3 隊
```

### UI-V7

```text
替換 Boss 圖示：
- Zakum
- Horntail
- Pink Bean
- Papulatus
```

### UI-V8

```text
Boss 小圖示加入 NORMAL / HARD 標示
依難易度顯示不同圖示標籤
```

### UI-V9

```text
難度標籤不只顯示在圖示，也顯示在場次標題旁
建立突襲難度選項改為：
- NORMAL
- HARD
```

### UI-V10

```text
Boss 與難度拆分顯示
場次清單加入 NORMAL / HARD 篩選
不同 Boss + 難度使用不同色系徽章與邊框
```

### UI-V11

```text
新增招募狀態：
- 招募中
- 招募截止
- 已結束

支援：
- 團長手動切換
- 超過開團時間自動顯示已結束
```

### UI-V12

```text
新增權限機制：
- 報名上限 30 改為 18
- 一般玩家只能報名
- 團長需要管理碼才能管理
- 管理操作改走 RPC
```

### UI-V12 SQL Fix

```text
修正 pgcrypto / crypt() 問題：
- create extension if not exists pgcrypto
- 修正 search_path
```

### UI-V13

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

### UI-V13 SQL Fix 2

```text
修正舊資料違反 check constraint 問題：
- title 清理
- leader 清理
- notice 清理
- member 欄位清理
- capacity > 18 修正
```

### UI-V14

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

### UI-V15

```text
團長複製團連結可帶邀請碼
玩家從連結進入時自動帶入報名邀請碼
```

### UI-V16

```text
品牌改為 TSN
頁首顯示 TSN UI-V16
左上主 Logo 文字調整
```

### UI-V17

```text
Logo 改為楓葉 SVG
新增羅茱工具按鈕
設定頁顯示本機保存的：
- 團長管理碼
- 團邀請碼
- 帶邀請碼團連結
```

### UI-V18

```text
收藏改名為團連結收藏
原羅茱工具內的團連結功能移到團連結收藏
保留羅茱工具按鈕
```

### UI-V19

```text
羅茱工具初版：
- 左欄建立 / 加入房間
- 右欄路徑解謎工具
- 本機 localStorage 保存
```

### UI-V20

```text
羅茱工具改為 Supabase 多人即時同步：
- 建立房間寫入 Supabase
- 加入房間讀取 Supabase
- Realtime 同步路徑
- 房間分享連結
- 角色顏色永久顯示
- 重置全清除
```

### UI-V21

```text
羅茱工具風格改成跟主網站一致
移除 Artale - YzY公會文字
移除線上人數文字
不需按同步鍵，自動同步
每人只能擇一角色
房間代碼 / 密碼可手動輸入
可退出房間
```

### UI-V22

```text
修正羅茱工具格子數字：
- 數字置中
- 數字變大
- 保留角色色塊顯示
```

### UI-V23

```text
新增鍵盤快捷鍵：
- 1 / 2 / 3 / 4 填入下一層
新增響應式版面
```

### UI-V24

```text
快捷鍵填滿 10 層後停止
羅茱工具強制左右欄
路徑顯示順序調整
```

### UI-V25

```text
修正路徑邏輯：
- 我的路徑顯示 1 → 10
- 格子視覺維持 10 → 1
新增：
- 角色鎖定同步
- 上次路徑欄位
- 房間閒置 1 小時清空
```

### UI-V26

```text
我的路徑不再顯示層數前綴
上次路徑改為自動保存
羅茱工具強制左右欄
```

### UI-V27

```text
首頁內容也強制左右欄
小螢幕改為橫向捲動
```

### UI-V28

```text
右上方重新整理按鈕改成重新整理 / 檢查新場次
重新讀取 Supabase 突襲場次資料
可顯示是否有新突襲場次
發現新場次時會提示數量與名稱，並自動選取第一個新場次
```

### UI-V29

```text
首頁突襲場次新增招募中 / 招募截止 / 已結束分類
招募截止的突襲場次只出現在招募截止分類
已結束的突襲場次只出現在已結束分類
招募中的突襲場次只出現在招募中分類
```

### UI-V30

```text
修正 UI-V29 分類判斷使用錯誤欄位造成場次不顯示
改用 effectiveStatus 作為狀態分類 key
招募中 / 招募截止 / 已結束分類可正常互斥顯示
```

### UI-V31

```text
我要報名角色定位改為打手 / 控時 / 火 / 煙霧機 / 輔助
隊伍配置依報名上限自動調整隊伍數
楓突襲隊伍名單可拖曳調整同隊先後順序
查看名單模式只列出已確認的人
```

### UI-V32

```text
楓突襲新增隊伍角色定位需求設定
團長可設定每隊 6 格定位需求
我要報名只顯示目前需求內的角色定位
新增 Supabase role_requirements 欄位與 RPC 驗證
```

### UI-V33

```text
修正隊伍角色定位需求未連動到隊伍配置顯示
隊伍配置空位會同步顯示團長設定的需求定位
報名頁只顯示需求內的角色定位，不再回退顯示全部定位
目前最新版本
```
### UI-V33 SQLFIX1

```text
修正 supabase/schema.sql demo seed insert 欄位數不一致
role_requirements 欄位加入後，demo seed rows 也補上預設 jsonb
on conflict update 同步更新 role_requirements
```

### UI-V34

```text
新增突襲名額上限改為 1～18 下拉式選單
修正首頁手機瀏覽器無法左右滑動導致看不到右欄
修正羅茱工具手機瀏覽器無法左右滑動導致看不到右欄
```

### UI-V35

```text
羅茱工具路徑格子縮小至比角色按鈕大一點
上次路徑欄位右側新增迷你路徑格子
迷你路徑格子會顯示已保存的上次路徑
```

### UI-V36

```text
羅茱工具主路徑格子改為固定小尺寸，不再撐滿右欄
上次路徑迷你格子改為總共一個 10 × 4 總覽
迷你總覽可顯示所有角色的上次路徑顏色
```

### UI-V37

```text
楓突襲隊伍角色定位需求區塊改為團長模式才顯示
一般玩家模式不顯示需求設定區
報名頁仍依照已設定需求限制可選角色定位
```

### UI-V38

```text
左側導覽在羅茱工具下方新增練功效率按鈕
新增練功效率偵測頁面
統計面板仿練功分析工具呈現 EXP / 分、預估 10 / 60 分與升級時間
新增 EXP / 分趨勢圖並套用本站橘色風格
目前最新版本
```

### UI-V39

```text
修正練功效率偵測頁面 Field is not defined 錯誤
App.tsx 補上 Field import
練功效率偵測頁面可正常開啟
目前最新版本
```

## 13. 注意事項

```text
1. 團長管理碼與報名邀請碼明碼只保存在本機瀏覽器
2. Supabase 只保存 hash 或資料庫狀態
3. 換裝置或清除瀏覽器資料後，需要重新輸入管理碼 / 邀請碼
4. 羅茱工具多人同步依賴 Supabase Realtime
5. 若 Realtime 未啟用，路徑可能需要重新整理才看得到更新
6. UI-V27 沒改 SQL，但從舊版升級時仍需確認 schema.sql 已執行到最新版
```

---

## 14. 常用測試項目

部署後建議測試：

```text
1. 首頁是否強制左右欄
2. 羅茱工具是否強制左右欄
3. 新增突襲是否能建立 18 人上限場次
4. 一般玩家是否只能報名
5. 團長管理碼是否能解鎖管理功能
6. 邀請碼連結是否能自動帶入報名邀請碼
7. 通知中心是否顯示開團提醒與候補轉正
8. 羅茱工具建立房間是否成功
9. 其他瀏覽器加入羅茱房間是否即時同步
10. 角色被選後，其他人是否不能再選
11. 快捷鍵 1 / 2 / 3 / 4 是否能填入下一層
12. 10 層填滿後快捷鍵是否停止
13. 上次路徑是否自動保存
14. 閒置 1 小時是否強制退出並清空
```

---

## 15. 常用指令

```bash
npm install
npm run dev
npm run build
```

```bash
git add .
git commit -m "deploy ui v39"
git push
```

如需強制覆蓋遠端：

```bash
git push -u origin main --force
```
