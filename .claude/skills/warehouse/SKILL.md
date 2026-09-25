---
name: warehouse
description: >-
  Read and change Real Hibachi's 虚拟仓库 (workbench 仓库 tab) — the physical
  stock: how many packs of each ingredient are left, and which chef or event is
  holding each table, chair, grill or uniform. Use when the owner sends a
  receipt or online order to stock in, or says things like "入库", "鸡胸用了一盒半",
  "划掉", "还剩几包", "冰箱里还有什么", "库存还够吗", "Blu 领走了一套工服",
  "椅子拉去陈府那场了", "桌子还回来了", "该补什么货", "盘点", or asks what to buy.
  Contains the API shapes, the item keys, the idempotency rule and the traps.
---

# 虚拟仓库（物）

工作台 → **仓库** 页签。一句话分工：

- **`supplies` skill 记账** —— 这笔钱花了多少，进 `supply_purchases`，算每人成本。
- **本 skill 记物** —— 手上还剩几包、东西在谁手上，进 `warehouse_*`。

收到一张小票要**两个都做**（先 supplies 记账，再这里入库）。账能补录，物只能靠人看一眼，所以两边分开存，不互相推导。

## 0. 先决条件

```bash
KEY=$(grep '^ADMIN_DASH_KEY=' "D:/desktop/RealHibachi/realhibachi-marketing/.env.local" | cut -d= -f2- | tr -d '\r')
```

- 基址 `https://www.realhibachi.com/api/admin/warehouse`，请求头 `x-admin-key: $KEY`，写操作只有 owner 能做。
- **中文内容一律写进文件再 `--data-binary @文件`**，别塞进命令行参数（Windows 下会乱码，踩过）。

## 1. 先读一眼

```bash
curl -s -H "x-admin-key: $KEY" "https://www.realhibachi.com/api/admin/warehouse?view=agent"
```

回的是精简版：每个品项的 `item_key / name / unit / pack_label / remain / min / par / need / buy / aliases`，周转品另带 `total / out / in_stock / holders`，外加 `chefs`、`events`（近 10 天的单，出库目标）和最近 15 条流水。**动手前先读**——尤其是入库，要先确认这张票没录过。

## 2. 两类东西，两种记法

| | 消耗品 `cons` | 周转品 `ret` |
|---|---|---|
| 例子 | 鸡胸、酱油、餐盘、筷子 | 桌椅、烤台、桌布、工服、刀具 |
| 怎么记 | 按**包**，每包 1 / 0.5 / 0 | 按**件** + 在谁手上 |
| 入库 | `stock_in` 加包 | 不入库，`set_item` 改总数 |
| 消耗 | `consume` 划掉 | `move` 借出 / 归还 |

`remain` 是包数不是重量。"鸡胸剩 2.5 盒"不是"剩 40 oz"——重量那套在 `lib/prep-bom.ts` 里另算。

## 3. 入库（最常用）

老板发来一张小票 → 先走 `supplies` skill 记账 → 再来这里：

```json
{
  "action": "stock_in",
  "via": "agent",
  "source_ref": "walmart:2000152-83328181",
  "source_label": "Walmart #2108 · 线下小票 · 09-22",
  "items": [
    { "item_key": "chicken", "packs": 2 },
    { "match": "MARKETSIDE BROCCOLI FLRT 32OZ", "packs": 2 },
    { "match": "GV LG EGGS 36CT", "packs": 2 }
  ]
}
```

- **`source_ref` 必填，而且要和 `supplies` 用同一个串**（`walmart:<订单号>` / `instacart:<订单号>` / `rd:<日期>`）。同一张票重发只会 skip，不会翻倍——2026-09-22 在采购流水上踩过重试循环插 3 条的坑。
- `packs` 是**包装个数**，不是重量。3 lb 鸡胸 × 2 盒 → `packs: 2`。按重量买的散货（西葫芦 3 lb）也按"份"算一包。
- 每行要么给 `item_key`，要么给 `match`（小票原文，服务端按别名解析）。
- 返回 `results[]`，逐行说 added / skipped 和原因。**认不出的行会原样返回，不会猜一个最像的入库**——看到 `认不出这是什么` 就用 `add_alias` 教一次，然后重发（`source_ref` 不变，已入的行会自动跳过）。

**老板说"买了"≠东西到了**（2026-09-25 踩过：RD 09-24 下的单第二天还在车上，系统里却躺着 2 袋带子 1 袋沙拉 1 箱 pasta）。**Instacart / 网购单一律先下 `"arrived": false`**，到货当天再调：

```json
{ "action": "mark_arrived", "source_ref": "rd:2026-09-24" }
```

在途的包不算在库、不进备料账，页面上画成虚线格子并标"在途 N 包"——看得见它在路上，就不会重复买一遍。**线下小票（当场拿走）不用加这个标志**。

**替换品 / 称重商品还要填包装大小**（2026-09-25 加）：`warehouse_packs.covers`（这一包能顶多少份量表需求，BOM 单位）+ `size_note`（人看的规格，如 "1.7 lb Family Pack"）。不填就回退到目录的标准包装量——但同一个 item 同时有 3.5 lb 大盘和 0.6 lb 小盘时，不填 = 系统以为都一样大，师傅拿货也分不出。

教别名：

```json
{ "action": "add_alias", "item_key": "chicken", "alias": "ks chkn brst bnls" }
```

只想问"这几行分别是什么"：

```json
{ "action": "resolve", "texts": ["USDA CHOICE TOP SIRLOIN 6.1LB", "FOAM PLATE 10IN 125CT"] }
```

## 4. 用掉了（划掉）

老板说"今天陈府那场鸡胸用了一盒半，鸡蛋半盒"：

```json
{
  "action": "consume",
  "via": "agent",
  "quote": "今天陈府那场鸡胸用了一盒半，鸡蛋半盒",
  "items": [
    { "item_key": "chicken", "packs": 1.5 },
    { "item_key": "eggs", "packs": 0.5 }
  ]
}
```

- `packs` 支持 0.5 的倍数，从最早的包开始划。
- 库里不够时返回 `short`，**如实报缺多少，不会偷偷当用完**。看到 `short` 要告诉老板——"以为还有"正是这个系统要解决的问题。
- 把 `quote` 填上老板的原话，流水里会显示，以后能对账。

## 5. 借出 / 归还（桌椅、烤台、工服）

```json
{
  "action": "move",
  "via": "agent",
  "quote": "Blu 领走了一套工服",
  "moves": [
    { "item_key": "chair", "holder_key": "order:<uuid>", "holder_kind": "event", "holder_name": "陈府 22 人 · 09-25", "delta": 12 },
    { "item_key": "cap",  "holder_key": "chef:<uuid>",  "holder_kind": "chef",  "holder_name": "Blu", "delta": 1, "size_note": "白" }
  ]
}
```

- `delta` 正数 = 出库 / 发给，负数 = 归还。
- `holder_key` 从 `?view=agent` 的 `chefs` / `events` 里拿，别自己编。
- 出库不会超过在库、归还不会变负数——**多出来的那一件不是被谁拿了，是数错了**，这种时候改总数（下一节）而不是硬记。

## 6. 盘点与参数

```json
{ "action": "set_item", "item_key": "chair",   "total_qty": 40 }   // 周转品实盘总数（含外出的）
{ "action": "set_item", "item_key": "chicken", "min_qty": 2, "par_qty": 4, "buy_channel": "Costco" }
```

`counted_at` 为空表示这个总数还是**设计稿里的数、没实盘过**，页面上会标"待实盘"。别把没盘过的数当真。

## 7. 撤销

每次写操作都返回 `batch_id`：

```json
{ "action": "undo", "batch_id": "<uuid>" }
```

反着做一遍并删掉那批流水（撤销掉的动作不该在流水里留一对互相抵消的记录）。同一批只能撤一次。

## 8. item_key 速查

蛋白 `chicken steak shrimp salmon tofu filet scallops lobster`
蔬菜 `zucchini broccoli onion carrots`
主食前菜 `noodles gyoza spring edamame eggs rice`
酱料 `soy yumyum teriyaki oil butter sake ginger`
一次性 `plates chop napkin togo gloves`
器材 `grill table chair cloth_w cloth_b cooler propane`
工服厨具 `cap chef_coat apron name_tag knife_set spatula_set squeeze_bottles torch`

一套工服 = `cap` + `chef_coat` + `apron`。

## 9. 踩过的坑

1. **`source_ref` 不填就别入库**。没有它就没有去重，重试一次库存翻倍。
2. **别用 `packs` 装重量**。`packs: 16` 想表示 16 lb，结果记成 16 盒。
3. **周转品不走 `stock_in`**，买了新椅子是 `set_item` 改 `total_qty`。
4. **认不出就停下来问**，别挑一个最像的 item_key。宁可少入一行，也不能把餐巾记成打包盒。
5. `pantry_stock` / `equipment_stock` 是旧的一套（备料清单 `/api/admin/prep` 还在读），**和这里的数字目前各算各的**。改一边不会自动同步另一边——两套合一还没做，别假设它们一致。
6. 页面上没有入库表单是故意的（用户 2026-09-22 定）：入库只走 agent，人只负责点格子划掉。

## 10. 干完汇报什么

一句话：入了哪些、划了哪些、现在还差什么。缺口用表格（品项 / 剩 / 安全线 / 建议补），`short` 和认不出的行**必须点名**。
