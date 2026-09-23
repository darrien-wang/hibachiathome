// 桌面主题目录：客户在 /rentals 选的东西，最终要一路走到装车清单和师傅的
// 备料单，所以三处必须读同一份定义，不能各写各的。
//
// 2026-09-23 上线（设计稿 4a704199 "Rentals Page"）。主题本身不加价——
// Full setup 一律 $15/人，选哪套都一样，选择只影响我们装哪箱盘子。
//
// 镜像：v0-real-hibachi-invoice-generator/lib/table-themes.ts（师傅备料单在
// 那个仓库）。改了这边记得同天改那边，和 prep-bom / pricing 一个规矩。
//
// 照片：三套主题的摆台图 2026-09-23 由用户提供并上线（public/gallery/，四档
// _opt WebP 已生成）。photo 仍是可选的——将来加新主题、照片还没拍时就退回
// swatch（同心圆色块：托盘/盘子/餐具）。色块不是临时方案：师傅在停车场看手机
// 认颜色比认照片快，所以两条路并行留着。

export type ThemeVariant = {
  id: string
  /** 客户看到的名字，也是写进订单备注的那个词 */
  name: string
  /** 实拍照片；没有就只出色块 */
  photo?: { src: string; alt: string; position?: string }
  /** 色块回退：从外到内 = 托盘 / 盘子 / 餐具 */
  swatch: { charger: string; plate: string; accent: string }
  /** 装车清单上的中文，师傅看的 */
  packLabel: string
}

export type TableTheme = {
  id: string
  name: string
  /** 这套主题配哪种桌布——桌布颜色跟着主题走，不单独选 */
  cloth: "black" | "white"
  desc: string
  /** "Great for ___" */
  fit: string
  variants: ThemeVariant[]
}

export const TABLECLOTHS = [
  { id: "black", name: "Black", swatch: "#232120" },
  { id: "white", name: "White", swatch: "#f7f4ee" },
] as const

export type ClothId = (typeof TABLECLOTHS)[number]["id"]

export const TABLE_THEMES: TableTheme[] = [
  {
    id: "goldrim",
    name: "Classic Gold Rim",
    cloth: "black",
    desc: "White gold-rim plates, gold cutlery, clear cups",
    fit: "birthdays, anniversaries, bridal showers",
    variants: [
      {
        id: "default",
        name: "Classic Gold Rim",
        photo: {
          src: "/gallery/real-hibachi-place-settings-hard-plastic-plates.jpg",
          alt: "Place settings on black tablecloths: white hard-plastic plates with a gold rim, gold cutlery, clear cups and sunflowers",
          position: "50% 65%",
        },
        swatch: { charger: "#c9a227", plate: "#f8f6f1", accent: "#c9a227" },
        packLabel: "金边白盘 + 金餐具",
      },
    ],
  },
  {
    id: "porcelain",
    name: "Blue & White",
    cloth: "white",
    desc: "Blue-and-white porcelain-style plates, silver cutlery, white napkins",
    fit: "family dinners, parents' birthdays, Mother's Day",
    variants: [
      {
        id: "default",
        name: "Blue & White",
        photo: {
          src: "/gallery/real-hibachi-place-settings-blue-white-porcelain.jpg",
          alt: "Blue-and-white porcelain-style plates with silver cutlery and a rolled white napkin on a white tablecloth",
        },
        // 托盘取青花的蓝：白盘压在白托上几乎看不见（09-23 手机实测）。
        swatch: { charger: "#2f5b96", plate: "#f8f9fb", accent: "#2f5b96" },
        packLabel: "青花盘 + 银餐具",
      },
    ],
  },
  {
    id: "hibachi",
    name: "Red Hibachi",
    cloth: "black",
    desc: "Red and black gold-rim plates, gold cutlery, white napkins",
    fit: "graduations, game nights, team events",
    variants: [
      {
        id: "red-on-black",
        name: "Red on black",
        photo: {
          src: "/gallery/real-hibachi-place-settings-red-plate-black-charger.jpg",
          alt: "A red plate on a black gold-rim charger with gold cutlery and a white napkin on a black tablecloth",
        },
        swatch: { charger: "#1b1a19", plate: "#b22222", accent: "#c9a227" },
        packLabel: "黑托红盘 + 金餐具",
      },
      {
        id: "black-on-red",
        name: "Black on red",
        photo: {
          src: "/gallery/real-hibachi-place-settings-black-plate-red-charger.jpg",
          alt: "A black plate on a red gold-rim charger with gold cutlery and a white napkin on a black tablecloth",
        },
        swatch: { charger: "#b22222", plate: "#1b1a19", accent: "#c9a227" },
        packLabel: "红托黑盘 + 金餐具",
      },
    ],
  },
]

// 场合 → 推荐主题。客户点"什么场合"我们就把那套顶到第一位并打标，
// 不是筛选：三套永远都在，只是顺序和推荐标变。
export const OCCASIONS: { name: string; themeId: string }[] = [
  { name: "Birthday", themeId: "goldrim" },
  { name: "Family gathering", themeId: "porcelain" },
  { name: "Anniversary", themeId: "goldrim" },
  { name: "Graduation", themeId: "hibachi" },
  { name: "Team event", themeId: "hibachi" },
]

export const DEFAULT_OCCASION = "Birthday"

export function findTheme(id: string | null | undefined): TableTheme | undefined {
  return TABLE_THEMES.find((t) => t.id === id)
}

export function findVariant(theme: TableTheme | undefined, id: string | null | undefined): ThemeVariant | undefined {
  if (!theme) return undefined
  return theme.variants.find((v) => v.id === id) ?? theme.variants[0]
}

/** 客户选的一整套，存进 leads/orders.setup_selection 的就是这个形状。 */
export type SetupSelection = {
  /** "tables" = 只要桌椅桌布；"full" = 加盘具，才有主题 */
  pkg: "tables" | "full"
  /** 只要桌椅时客户自己选桌布颜色；full 时跟着主题走 */
  cloth: ClothId
  themeId?: string
  variantId?: string
  guests: number
  source?: string
  chosenAt?: string
}

/**
 * /rentals 的 CTA 把选择编成 URL 参数带到 /quote。这里是唯一的解析口——
 * 参数是客户可改的,所以一律拿目录校验,不认就当没选。
 */
export function parseSetupParams(params: URLSearchParams): SetupSelection | null {
  const pkg = params.get("setup")
  if (pkg !== "tables" && pkg !== "full") return null

  const guestsRaw = Number.parseInt(params.get("guests") ?? "", 10)
  const guests = Number.isFinite(guestsRaw) ? Math.max(1, Math.min(200, guestsRaw)) : 0
  if (!guests) return null

  const clothParam = params.get("cloth")
  const cloth = (TABLECLOTHS.find((c) => c.id === clothParam)?.id ?? "black") as ClothId

  if (pkg === "tables") return { pkg, cloth, guests, source: "rentals_page" }

  const theme = findTheme(params.get("theme"))
  if (!theme) return null
  const variant = findVariant(theme, params.get("variant"))
  return {
    pkg,
    cloth: theme.cloth, // 主题自带桌布,参数说了不算
    themeId: theme.id,
    variantId: variant?.id,
    guests,
    source: "rentals_page",
  }
}

/** 一行人话，写进订单备注和线索时间线用。 */
export function describeSetup(sel: SetupSelection): string {
  const cloth = TABLECLOTHS.find((c) => c.id === sel.cloth)?.name ?? sel.cloth
  if (sel.pkg !== "full") return `Tables & chairs · ${cloth} tablecloths · ${sel.guests} guests`
  const theme = findTheme(sel.themeId)
  if (!theme) return `Full setup · ${sel.guests} guests`
  const variant = findVariant(theme, sel.variantId)
  const name = theme.variants.length > 1 && variant ? `${theme.name} (${variant.name})` : theme.name
  return `Full setup · ${name} · ${cloth} tablecloths · ${sel.guests} guests`
}

/** 装车清单上的中文一行。 */
export function packLabelFor(sel: SetupSelection): string | null {
  if (sel.pkg !== "full") return null
  const theme = findTheme(sel.themeId)
  const variant = findVariant(theme, sel.variantId)
  return variant?.packLabel ?? null
}
