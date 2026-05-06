import { isPreBranchDeployment } from "@/lib/runtime-env"

function readNonEmptyEnv(name: string): string | undefined {
  const raw = process.env[name]
  if (typeof raw !== "string") {
    return undefined
  }

  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
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
