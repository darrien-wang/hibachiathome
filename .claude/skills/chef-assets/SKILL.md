---
name: chef-assets
description: >-
  Record company property handed to (or returned by) a Real Hibachi chef —
  uniform, knives, gear — so it shows on that chef's card in the workbench.
  Use whenever the owner says things like "Blu 领走了一套工服", "给 X 配了刀具",
  "X 把围裙还回来了", "帽子丢了", "登记一下工服", "谁手上有几套工服",
  "issued a chef coat", "he returned the apron". Contains the item catalog,
  the API shapes, and the rules for issue / return / correction.
---

# 厨师装备登记

老板说一句谁领了什么 → 我写进 `staff_assets` → 工作台 **厨师 → 资料 · 工价 → 公司资产** 那一栏就看得到。界面上没有录入表单（用户 2026-09-22 定，和采购录入同一个路子）。

## 0. 先决条件

```bash
KEY=$(grep '^ADMIN_DASH_KEY=' "D:/desktop/RealHibachi/realhibachi-marketing/.env.local" | cut -d= -f2- | tr -d '\r')
```

**中文内容必须写进文件再 `--data-binary @文件`**，不能塞进命令行参数（Windows 下会乱码）。

先拿厨师 id：`GET /api/admin/chefs` → `chefs[]` 里按名字找。名字对不上就**先问**，别猜是哪位师傅。

## 1. 品项目录（item_key）

定义在 `lib/staff-assets.ts`，改了那里这里也要改。

| 老板会说的 | item_key |
|---|---|
| 鸭舌帽 / 帽子 / cap | `cap` |
| 厨师服 / 白大褂 / coat | `chef_coat` |
| 围裙 / apron | `apron` |
| 工牌 | `name_tag` |
| 刀具 / 刀包 | `knife_set` |
| 铲子 | `spatula_set` |
| 酱料瓶 | `squeeze_bottles` |
| 喷枪 | `torch` |
| 铁板炉 | `griddle` |
| 煤气罐 | `propane_tank` |
| 保温箱 | `cooler` |

**"一套工服" = `cap` + `chef_coat` + `apron`**（`UNIFORM_SET`）。

目录里没有的也能记：带上 `item_key`（自己起个稳定的英文 key）**和** `label`（中文名），并顺手把它加进 `lib/staff-assets.ts`，下次就归得了类。

## 2. 领用

`POST https://www.realhibachi.com/api/admin/chefs`

```json
{
  "action": "issue_assets",
  "staff_member_id": "<uuid>",
  "issued_on": "2026-09-22",
  "items": [
    { "item_key": "cap", "size": "白" },
    { "item_key": "chef_coat", "size": "XL" },
    { "item_key": "apron", "qty": 1 }
  ],
  "note": "第一套"
}
```

- `issued_on` 不填就是今天（PT）。**老板说"上次"/"前几天"的，先问哪天**，日期错了对不上账。
- `qty` 默认 1；`unit_cost`（美元）、`note` 可选。
- **`size` 是"规格"，尺码和颜色都写这里**（厨师服 `XL`、鸭舌帽 `白`）——老板报了尺码/颜色就一定要记进去，下次补货照着买。
- 去重键是 **(厨师, item_key, issued_on)**：同一天同一件重发只会更新那一行，不会记成领了两件。真的一天发两顶帽子就写 `qty: 2`。

## 3. 归还 / 报废

```json
{ "action": "return_asset", "asset_id": "<uuid>", "returned_on": "2026-10-01", "condition": "正常" }
```

- 还回来、丢了、报废了，都用 `return_asset` 把这条关掉，`condition` 写清楚（`正常` / `破损` / `丢失`）。**别删记录**——删了就看不出这个人经手过多少件。
- 只有**记错了**（记错人、记错日期、记错件数）才用 `{"action":"delete_asset","asset_id":"<uuid>"}`。

## 4. 读

`GET /api/admin/chefs?id=<uuid>` → `assets[]`，每条含 `item_key / label / qty / size / issued_on / returned_on / condition / unit_cost_cents / note`。

- `returned_on` 为空 = 还在他手上。
- 坐席（没有 `chef_sensitive` 权限）看得到有什么，看不到采购价。

回答"谁手上有几套工服"这类问题：把每位厨师的详情拉一遍再汇总，**别直接查库**（权限和字段过滤都在接口里）。

## 5. 写操作都是老板级

这三个 action 在 `OWNER_ACTIONS` 里，只有 owner 能调。用 `ADMIN_DASH_KEY` 就是 owner。

## 6. 登记完汇报什么

一句话：谁、哪天、领了什么（几件）、现在他手上一共几件。估过的东西（尺码、成本）点名让老板核。
