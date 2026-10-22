/**
 * A count with its noun, singular for exactly one: "1 adult", "2 adults",
 * "0 kids", "1 baby" / "2 babies". "1 adults" went out in the quote texts
 * and on the estimator cards until 2026-10-22.
 */
export function counted(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
