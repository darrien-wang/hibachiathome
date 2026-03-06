function readNonEmptyEnv(name: string): string | undefined {
  const raw = process.env[name]
  if (typeof raw !== "string") {
    return undefined
  }

  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeBranchName(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

export function isPreBranchDeployment(): boolean {
  const gitBranch = normalizeBranchName(process.env.VERCEL_GIT_COMMIT_REF)
  return gitBranch === "pre"
}

export function resolveStripeSecretKey(): string | undefined {
  if (isPreBranchDeployment()) {
    return readNonEmptyEnv("PRE_STRIPE_SECRET_KEY") ?? readNonEmptyEnv("STRIPE_SECRET_KEY")
  }
  return readNonEmptyEnv("STRIPE_SECRET_KEY")
}

export function resolveStripeWebhookSecret(): string | undefined {
  if (isPreBranchDeployment()) {
    return readNonEmptyEnv("PRE_STRIPE_WEBHOOK_SECRET") ?? readNonEmptyEnv("STRIPE_WEBHOOK_SECRET")
  }
  return readNonEmptyEnv("STRIPE_WEBHOOK_SECRET")
}
