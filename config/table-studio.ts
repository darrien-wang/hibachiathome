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
  { id: "black", label: "Matte Black", hex: "#26262a", available: true },
  { id: "white", label: "Classic White", hex: "#f7f4ec", available: true },
]

export const SALAD_PLATES: SwatchOption[] = [
  { id: "red", label: "Red", hex: "#a3272c", available: true },
  { id: "black", label: "Black", hex: "#202024", available: true },
  { id: "white", label: "White", hex: "#f6f3ea", available: true },
]

/** Every setup ships with these — no color choice needed (yet). */
export const INCLUDED_FIXED = ["Silver tableware", "Red napkins"]

/** Owner-defined signature default: black table & chairs (no covers), black
 * dinner plate, red salad plate, silver tableware, red napkin.
 * Chargers, runners, place cards, placemats, cups: guests bring their own —
 * we deliberately cover only the big pieces (owner call, 2026-09-02). */
export const STANDARD_SETUP = { cloth: "black", chairCovers: false, plate: "black", salad: "red" }
