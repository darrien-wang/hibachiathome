// Table Studio SKU catalog — display-only for now (V0, hidden route).
// Every option here reflects real stock the team can actually deliver
// (owner-confirmed 2026-09-02; gear sourced from lustrerentals.com).
// When an option sells out or a new color arrives, edit this file only.

export interface ClothOption {
  id: string
  label: string
  photo: string
  /** per-guest price, tables + chairs + this linen */
  pricePerGuest: number
  /** per-guest price when spandex chair covers are added */
  priceWithChairCovers: number
  /** hex used by the place-setting preview backdrop */
  hex: string
  available: boolean
}

export interface SwatchOption {
  id: string
  label: string
  hex: string
  available: boolean
}

export const CLOTHS: ClothOption[] = [
  {
    id: "black",
    label: "Black Skirting",
    photo: "/images/table-studio/cloth-black.jpg",
    pricePerGuest: 10,
    priceWithChairCovers: 15,
    hex: "#181818",
    available: true,
  },
  {
    id: "white",
    label: "White Skirting",
    photo: "/images/table-studio/cloth-white.jpg",
    pricePerGuest: 20,
    priceWithChairCovers: 25,
    hex: "#f4f1ea",
    available: true,
  },
]

export const PLATES: SwatchOption[] = [
  { id: "white", label: "Classic White", hex: "#f7f4ec", available: true },
  { id: "black", label: "Matte Black", hex: "#26262a", available: true },
]

export const CHARGERS: SwatchOption[] = [
  { id: "black", label: "Black", hex: "#141414", available: true },
  { id: "red", label: "Red", hex: "#8e1f24", available: true },
]

/** Full-set styling pieces we plan to offer — reserved display slots for now. */
export const COMING_SOON_SET = ["Table runner", "Placemats", "Cups", "Silverware"]
