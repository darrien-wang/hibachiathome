---
name: supplies
description: >-
  Record a Real Hibachi grocery / supply purchase from a receipt the owner pastes
  or screenshots, so it lands in both the cost ledger and the pantry stock. Use
  this whenever the owner sends a Walmart, Instacart, Restaurant Depot or other
  supplier receipt, or says things like "这是一笔开销", "这是另外一笔", "帮我录入",
  "入库", "记一下这笔采购", "买了…", "补了货", or pastes an order/items list with
  prices. Also covers correcting a purchase (date, amount, lines), doing a stock
  count, and answering "冰箱里还有什么 / 明天还差什么". Contains the item mapping,
  pack conversions, API shapes and the traps that have already bitten us.
---

# 采购录入与入库

老板发收据 → 我解析 → 一次调用同时做两件事：**记成本**（supply_purchases）和**入库**（pantry_stock）。工作台只负责展示，界面上没有录入表单（用户 2026-09-22 定）。

## 0.0 还要做一件事：入库

本 skill 只记**账**（花了多少、每人成本）。同一张小票还要记**物**（手上还剩几包），
那在 `warehouse` skill 里。顺序：先这里记账 → 再调 `stock_in` 入库，
**两边用同一个 `source_ref`**（`walmart:<订单号>` / `instacart:<订单号>` / `rd:<日期>`）。
只记了账没入库，仓库页就会少算一批货。

## 0. 先决条件

```bash
KEY=$(grep '^ADMIN_DASH_KEY=' "D:/desktop/RealHibachi/realhibachi-marketing/.env.local" | cut -d= -f2- | tr -d '\r')
```

**中文内容必须写进文件再 `--data-binary @文件`**，不能塞进命令行参数（Windows 下会乱码，踩过）。

## 1. 从收据里抠出什么

| 要什么 | 从哪看 | 坑 |
|---|---|---|
| 订单号 | Walmart「Order number: #2000152-…」；Instacart 页面没有就自己编一个稳定串 | 没有订单号就没法去重 |
| 日期 | 下单日（PT） | 老板可能说"上次采购"——**先问哪天，别猜**；猜错的日期会落进错误的月份 |
| 实付金额 | **实际行项目合计 + 小费 + 服务费** | Walmart 邮件里的「Order total」和卡上「Temporary hold」都是下单时的估值，缺货和按实重下调后会变小。**以送达页的行项目为准** |
| 每行的量 | 包装规格；生鲜按 `金额 ÷ 单价` 倒推重量 | 例：鸡胸 $41.35 ÷ $2.57/lb = 16.1 lb |

## 2. 品项映射（item_key）

库存单位必须和备料清单一致，定义在 `lib/pantry.ts`（`STOCK_UNITS` / `STOCK_LABELS`）。常见对照：

| 收据上写的 | item_key | 单位 |
|---|---|---|
| Chicken Breast | `chicken` | oz |
| Top Sirloin / Steak | `steak` | oz |
| SHRP P&D 16-20 | `shrimp` | pcs |
| Zucchini / Broccoli / Onion / Carrots | 各自 | oz |
| Spring Mix / Spinach / Salad Blend | `salad` | 份 |
| 鸡蛋 | `eggs` | 个 |
| Tai Pei Potstickers | `gyoza` | pcs |
| Tai Pei Egg Rolls | `spring_rolls` | pcs |
| Edamame | `edamame` | 份 |
| Yum Yum Sauce | `ginger_sauce` | tbsp |
| Ginger Dressing | `ginger_dressing` | tbsp |
| 黄油 | `garlic_butter` | tbsp |
| 酱油 | `soy_sauce` | tbsp |
| 照烧汁 | `teriyaki` | tbsp |
| 大豆油 | `oil` | tbsp |
| 米 | `fried_rice` | oz（熟饭当量） |
| 蒜蓉 | `garlic` | oz |
| 清酒 | `sake` | L |

**换算表**在 `lib/pantry.ts` 的 `PACK_NOTES`，改了那里这里也要跟着改。要点：

- 1 lb = 16 oz；酱料 1 fl oz ≈ 2 tbsp；1 gal = 256 tbsp
- 沙拉菜 1 份 = **1 oz**；毛豆 12oz 袋 = **1 份**，1 份喂 3 人（09-24 定：份=袋，点几份带几袋；沙拉仍是老板定的）
- 煎饺 46.5oz ≈ 40 个、春卷 24.5oz ≈ 8 个、黄油 16oz 双包 = 32 tbsp
- 虾 16/20：1 袋 = 43 只（09-24 实数）；鸡蛋 36/盒；清酒 1 箱 = 18 L
- 三文鱼 Marketside 2lb 真空袋 = **5 块**（只能整袋买，入库 1 袋 = 32 oz，09-24 定）
- 平均盒重（没小票单价时用，09-24 定）：鸡胸盘 ≈**4.5 lb/盒**；西冷 Top Sirloin Family Pack ≈**1.6 lb/盒**，经验 1 盒 ≈ 4 个选牛排的客人（盒数 = 人数 ÷ 4）
- 生米 1 lb ≈ 3 lb 熟饭（50 lb 袋 ≈ 2400 oz）
- 大豆油 35 lb ≈ 1170 tbsp

**估不准的一律往少了估**（库存宁可显示不够，也别显示够——少买很麻烦，这是老板的硬规则）。袋子上印了真实个数就用真实的，并顺手改 `PACK_NOTES`。

## 3. 写进去

`POST https://www.realhibachi.com/api/admin/supplies`

```json
{
  "action": "add",
  "order_ref": "walmart:2000152-83328181",
  "purchased_on": "2026-09-22",
  "channel": "walmart",
  "category": "fresh",
  "amount": 175.03,
  "tip": 5.00,
  "note": "Walmart 15 件送达 · 实际行项目 $170.03 + 小费 $5.00",
  "lines": [
    { "label": "鸡胸 3 盘（$2.57/lb，实重 16.1 lb）", "qty": 3, "amount": 41.35, "item_key": "chicken", "stock_qty": 257.4 }
  ]
}
```

- `channel`：`walmart` / `instacart` / `other`。**用户 09-24 定：不去 Costco；RD 走 Instacart 下单，channel 记 `instacart`，note 写 Restaurant Depot**
- `category`：`fresh` 生鲜 · `frozen` 冻品 · `pantry` 仓库大宗 · `sake` 清酒 · `other`
  **分类决定它算不算"大宗"**：`pantry` 和 `sake` 会从"不含大宗每人成本"里剔除，因为能用好几个月。
- `order_ref` **必带**：同一张收据重发只会更新成本，不会重复进货（`stockIn` 返回空就是已经入过了）。
- 只有带 `item_key` + `stock_qty` 的行才进库存；`label`/`amount` 只是存档。

改金额、改日期、补行项目 → **用同一个 order_ref 再发一次**，不要新建。

## 4. 库存的两类（老板 2026-09-22 定）

- **按量型**（蛋白、蔬菜、鸡蛋、沙拉、煎饺/春卷/毛豆、面）：备料清单算需求、比在库、报"还差多少"。
- **补货型**（`RESTOCK_ITEMS`：米、油、酱油、各种酱、蒜、清酒、青柠）：**没有固定标准，没有就补**。清单只显示在库量，不算缺口。老板原话"前期不需要那么精确的库存，后期稳定之后按照平均值来准备就行"。

将来要升级成按量型，用 supply_purchases + orders 反推（两次采购之间接待了多少人 ÷ 包装量），**别现在拍标准**。

## 5. 其它写操作

```bash
# 盘点：把某个食材的在库改成实际数
{"action":"set_pantry","item_key":"salad","qty":27}          # POST /api/admin/prep
# 装备盘点（桌椅桌布餐具气罐）
{"action":"set_stock","item_key":"chairs","qty":30}          # POST /api/admin/prep
# 办完之后扣当天用量（按日期幂等，扣不出负数）
{"action":"consume","date":"2026-09-23","items":[{"item_key":"steak","qty":126}]}
# 删一笔采购（只在录错且没法 upsert 时用）
{"action":"delete","id":"<uuid>"}                             # POST /api/admin/supplies
```

## 6. 读

- `GET /api/admin/supplies` → 90 天流水、`pantry` 在库、`stats`（rolling30 / month / prevMonth，各含 `perGuestExBulkCents` 不含大宗、`perGuestCents` 全口径）
- `GET /api/admin/prep?date=YYYY-MM-DD` → 当天需求、`pantry` 在库、装备库存、菜单未定警告

## 7. 踩过的坑

1. **写接口部署完再开始 POST**。曾在部署完成前跑重试循环，同一笔 Walmart 插了 3 条（老代码不认 order_ref）。先探测新字段确认部署完，再写。
2. **金额以实际扣款为准**，不是下单估值，也不是卡上预授权。
3. **`event_start` 是墙上时间存 UTC**：日期取 ISO 前 10 位，别做时区换算。
4. **Instacart 的收据不进 Gmail**（只有 Walmart 的订单确认邮件到），所以自动任务 `receipt-ingest` 只覆盖 Walmart；Instacart/RD 要老板贴给我，或从 Instacart Business → Reports 导。
5. Walmart **没有给买家的开发者 API**；逐行明细只能走 Walmart Business 后台的 itemized order detail report（CSV）。
6. 份量表改动要**两个仓库同天改**：`realhibachi-marketing/lib/prep-bom.ts` 是 `v0-real-hibachi-invoice-generator/lib/pricing.ts` 的镜像。

## 8. 录完汇报什么

一句话说清：记了多少钱、入了哪些库、明天还差什么。缺口用表格（品项 / 要 / 在库 / 还差），估算过的换算要点名让老板核。
