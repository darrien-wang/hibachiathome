function readNonEmptyEnv(name: string): string | undefined {
  const raw = process.env[name]
  if (typeof raw !== "string") {
    return undefined
  }

  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeLowercase(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

function readBooleanFlag(name: string): boolean {
  const normalized = normalizeLowercase(readNonEmptyEnv(name))
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

export function getDeploymentBranch(): string | null {
  return normalizeLowercase(readNonEmptyEnv("VERCEL_GIT_COMMIT_REF"))
}

export function isPreBranchDeployment(): boolean {
  return getDeploymentBranch() === "pre"
}

export function isPreviewDeployment(): boolean {
  return normalizeLowercase(readNonEmptyEnv("VERCEL_ENV")) === "preview" || isPreBranchDeployment()
}

export function getRuntimeEnvironmentTag(): "pre" | "production" {
  return isPreBranchDeployment() ? "pre" : "production"
}

export function shouldSuppressExternalNotifications(): boolean {
  return readBooleanFlag("SUPPRESS_EXTERNAL_NOTIFICATIONS") || isPreviewDeployment()
}
