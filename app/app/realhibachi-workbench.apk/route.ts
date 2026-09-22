import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// The Android workbench APK lives in Supabase storage (bucket "apps");
// this keeps a stable download link on our own domain for the in-app updater
// and for texting to a new phone.
const APK_URL = "https://sdhiamdprdeesokpemkq.supabase.co/storage/v1/object/public/apps/realhibachi-workbench.apk"

export async function GET() {
  return NextResponse.redirect(APK_URL, 302)
}
