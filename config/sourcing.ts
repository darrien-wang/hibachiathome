// What we actually buy, in the words on the packaging.
//
// Rules for this file:
//  - Grades and certifications only. Never name the retailer — "USDA Choice
//    Angus" sells, "we shop at a supermarket" does not, and both are true.
//  - Every line has to be checkable against a label we can produce. If a spec
//    changes because we switched supplier, change it here the same week.
//  - Allergen text belongs in `sourcingAllergenNote`, and it stays
//    conservative. Verified 2026-08-27 against the products in use: both
//    sauces contain egg, the yum yum sauce is made in a plant that also
//    handles peanuts, and the gyoza contain sesame and wheat.

export type SourcingSpec = {
  item: string
  spec: string
  note: string
}

export const sourcing: SourcingSpec[] = [
  {
    item: "Beef",
    spec: "USDA Choice Angus top sirloin",
    note: "Choice is the grade above Select. We buy Angus program beef rather than whatever is cheapest that week.",
  },
  {
    item: "Shrimp",
    spec: "BAP-certified",
    note: "Best Aquaculture Practices — an independent certification covering the farm, the hatchery, the feed and the processing plant.",
  },
  {
    item: "Salmon",
    spec: "Atlantic salmon fillet, skinless",
    note: "Portioned fillet, not trim or belly offcuts.",
  },
  {
    item: "Chicken",
    spec: "Boneless, skinless breast",
    note: "Hatched, raised and harvested in the USA. Breast meat only — no thigh substitution.",
  },
  {
    item: "Lobster tail",
    spec: "Wild-caught Caribbean spiny lobster",
    note: "Our premium upgrade. Wild-caught, not farmed.",
  },
  {
    item: "Sauces",
    spec: "Terry Ho’s yum yum sauce and Japanese ginger dressing",
    note: "The ones you already recognise from the restaurant. Both contain egg.",
  },
]

export const sourcingAllergenNote =
  "Our standard soy sauce is not gluten free, so a gluten-free guest should have their own gluten-free soy and " +
  "teriyaki on hand and we'll cook their portion with it. We can't promise a nut- or sesame-free table — the " +
  "sauces and gyoza are commercial products, the gyoza contain sesame, and one sauce is made in a plant that " +
  "also handles peanuts. Tell us the allergy when you book and we'll check the labels in use for your date."
