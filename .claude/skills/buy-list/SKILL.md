---
name: buy-list
description: >-
  Real Hibachi's 常买清单 / 要买的 (workbench 仓库 → 下单 tab): products the owner
  has settled on buying again, with compared prices and the chosen order link.
  Use when the owner says "我缺 X", "X 没了", "帮我买 X", "给我链接", "以后都买这个",
  "放到采购数据库/采购列表", "买了", or asks where/what to buy for something already
  decided. Contains the API shapes and the price-comparison rules.
---

# 下单（常买清单 + 要买的）

工作台 → **仓库 → 下单**。表 `buy_items`（老板 2026-10-10 要的）：一行 = 一样**定下来以后都买这个**的东西，
带着比过价的候选商品和选定的下单链接（`chosen_url`）。`need_qty > 0` = 现在要买，页面按店分组给「去下单」按钮。

和别的 skill 的分工：
- **这里**：去哪买、买哪个、现在缺不缺。不记钱。
- `supplies`：买完的小票记账（钱）。
- `warehouse`：手上还剩几包（物）。

## 0. 先决条件

```bash
KEY=$(grep '^ADMIN_DASH_KEY=' "D:/desktop/RealHibachi/realhibachi-marketing/.env.local" | cut -d= -f2- | tr -d '\r')
```

基址 `https://www.realhibachi.com/api/admin/buy-list`，请求头 `x-admin-key: $KEY`。
**中文内容写进文件再 `--data-binary @文件`**（Windows 命令行参数会乱码）。

## 1. 老板说"缺 X"

1. `GET` 读全表，按 `label` 找。
2. **找到了** → `{"action":"need","id":"…","qty":1,"note":"10-12 说缺"}`，回复里直接给 `chosen_url` 和价格。
   价格的 `checked` 超过 30 天就重新看一眼页面（Amazon 用浏览器读 `#corePrice_feature_div .a-offscreen`），变了顺手 `upsert` 更新候选。
3. **没找到** → 比价（见第 3 节），给老板 2–3 个选项和推荐。**老板定了**再 `upsert` 新建，并按需要 `need`。

## 2. API

```jsonc
// 新建（不带 id）或改（带 id）。candidates 整组替换；chosen_url 不传时新建默认第一个候选。
{"action":"upsert","id":"(可选)","label":"干蒜粒","unit":"袋 5 lb","category":"调料",
 "buy_note":"怎么买/注意什么","chosen_url":"https://…",
 "candidates":[{"title":"…","url":"https://…","price":2599,"ship":0,"store":"Amazon","size":"5 lb","checked":"2026-10-10","note":"…"}]}
{"action":"need","id":"…","qty":2,"note":"…"}   // qty 0 = 不买了
{"action":"bought","id":"…"}                       // 清掉要买，记 last_bought_at
{"action":"archive","id":"…"}                      // 不再买这个（软删）
```

价格一律**分**（$25.99 → 2599）。`store` 决定"要买的"怎么分组，同一家店写法要一致：
`Amazon` / `Walmart` / `Restaurant Depot (Instacart)` / `WebstaurantStore` / `Total Wine`。

## 3. 比价规矩（10-10 那一轮定下来的）

- **比到手价**：标价 + 运费（加上要凑免运门槛的情况），按每磅/每升/每套算。
- 收货地址 **913 Ranlett Ave, La Puente 91744**。Amazon 用浏览器打开页面读价，搜索摘要的价格经常过时。
- 渠道（老板 09-24 定）：不去 Costco。Restaurant Depot 走 **Instacart**（有 Instacart+ 免运），Walmart 买生鲜/一次性/酒。
- 10-10 的结论：米、油、盐这种大宗 **RD 远比 Amazon 便宜**（整单便宜约 $100）；**汤盒在 Amazon 买**（Karat，老板定）。
- **点火用的酒**：老板要最便宜的。必须是食用酒，**绝不推荐外用酒精/异丙醇**。加州零售买不到 190 proof（最高 120），151 proof 的朗姆可以买。
- Instacart 没有稳定的商品直链，用店内搜索链接：`https://www.instacart.com/store/restaurant-depot/s?k=<关键词>`。
