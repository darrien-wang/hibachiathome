// Regional fee mapping table
export const regions: Record<string, number> = {
  // TX (Austin, Dallas, Houston, San Antonio)
  "737": 50,
  "750": 50,
  "751": 50,
  "752": 50,
  "770": 50,
  "771": 50,
  "772": 50,
  "782": 50,
  // NY, NJ, PA, DE
  "100": 50,
  "101": 50,
  "102": 50,
  "070": 50,
  "071": 50,
  "190": 50,
  "191": 50,
  "197": 50,
  // AZ (Phoenix Metropolitan)
  "850": 50,
  "851": 50,
  "852": 50,
  "853": 50,
  // VA, MD, Washington DC
  "200": 50,
  "201": 50,
  "220": 50,
  "221": 50,
  "208": 50,
  "209": 50,
  // FL (Miami, Orlando)
  "331": 50,
  "332": 50,
  "328": 50,
  "329": 50,
}

// Default travel fee
export const DEFAULT_TRAVEL_FEE = 50

/**
 * Calculate travel fee based on zipcode
 * @param zipcode Postal code
 * @returns Travel fee amount
 */
export const calculateTravelFee = (zipcode: string): number => {
  if (!zipcode || zipcode.length < 5) return 0

  const zipPrefix = zipcode.substring(0, 3)
  return regions[zipPrefix] || DEFAULT_TRAVEL_FEE
}
