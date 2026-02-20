"use client"

export type AbExperimentName = "hero_headline" | "primary_cta_copy"

const STORAGE_PREFIX = "realhibachi_ab_"

const experimentVariants: Record<AbExperimentName, readonly string[]> = {
  hero_headline: ["control", "chef_story"],
  primary_cta_copy: ["control", "value_focused"],
}

function pickRandomIndex(max: number): number {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const random = new Uint32Array(1)
    window.crypto.getRandomValues(random)
    return random[0] % max
  }
  return Math.floor(Math.random() * max)
}

export function getOrAssignVariant(experiment: AbExperimentName): string {
  if (typeof window === "undefined") return experimentVariants[experiment][0]

  const storageKey = `${STORAGE_PREFIX}${experiment}`
  const existing = window.localStorage.getItem(storageKey)
  const variants = experimentVariants[experiment]

  if (existing && variants.includes(existing)) {
    return existing
  }

  const assigned = variants[pickRandomIndex(variants.length)]
  window.localStorage.setItem(storageKey, assigned)
  return assigned
}
