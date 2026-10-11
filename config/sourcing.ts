// What we actually buy, in the words on the packaging.
//
// Rules for this file:
//  - Grades and certifications only. Never name the retailer — "USDA Choice
//    Angus" sells, "we shop at a supermarket" does not, and both are true.
//  - Every line has to be checkable against a label we can produce. If a spec
//    changes because we switched supplier, change it here the same week.
//  - Allergen text belongs in `sourcingAllergenNote`, and it stays
//    conservative. 2026-10-11 (owner): both sauces are now made in house,
//    every party - no more bottled Terry Ho's, so the "made in a plant that
//    also handles peanuts" advisory went with it. Yum yum: mayonnaise,
//    orange / pineapple / lemon juice, sugar, garlic powder, paprika, black
//    pepper (egg). Ginger dressing: onion, carrot, ginger, celery, orange,
//    lemon, pineapple juice, applesauce, white vinegar, ketchup, soy sauce,
//    oil, sugar, mayonnaise (egg, soy, wheat - so NOT gluten free). The
//    gyoza contain sesame and wheat (verified 2026-08-27). The recipes live
//    in config/house-sauces.ts; change both when a recipe changes.

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
    spec: "House-made yum yum sauce and ginger dressing",
    note: "Made by us, fresh every week — the ginger dressing from fresh onion, carrot, ginger, orange and lemon. Both contain egg; the ginger dressing also contains soy and wheat.",
  },
]

export const sourcingAllergenNote =
  "Our standard soy sauce is not gluten free, so a gluten-free guest should have their own gluten-free soy and " +
  "teriyaki on hand and we'll cook their portion with it; our ginger dressing is made with regular soy sauce, " +
  "so their salad comes without it. We can't promise a nut- or sesame-free table — the gyoza are a commercial " +
  "product and contain sesame, and our house-made sauces use store-bought ingredients. Both sauces contain egg. " +
  "Tell us the allergy when you book and we'll check the labels in use for your date."
