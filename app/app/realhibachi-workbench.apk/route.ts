import { NextResponse } from "next/server"
import { MOBILE_APP } from "@/config/mobile-app"

export const dynamic = "force-dynamic"

// The Android workbench APK lives in Supabase storage (bucket "apps");
// this keeps a stable download link on our own domain for the in-app updater
// and for texting to a new phone. Publishing a build = upload the versioned
// object, bump config/mobile-app.ts, push.
export async function GET() {
  return NextResponse.redirect(MOBILE_APP.apkStorageUrl, 302)
}
