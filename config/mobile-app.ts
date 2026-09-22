// The Android workbench app (realhibachi-order-management-system/mobile-android).
// Bump these when a new APK is published so phones prompt for the update;
// the app checks /api/admin/mobile/version on launch.
export const MOBILE_APP = {
  /** Phones below this versionCode are told to update before continuing. */
  minVersionCode: 2,
  latestVersionCode: 5,
  latestVersionName: "2.2.0",
  apkUrl: "https://www.realhibachi.com/app/realhibachi-workbench.apk",
  /** Where /app/realhibachi-workbench.apk redirects: a versioned object, so a new build is never served from a stale cache. */
  apkStorageUrl: "https://sdhiamdprdeesokpemkq.supabase.co/storage/v1/object/public/apps/realhibachi-workbench-2.2.0.apk",
  notes: "新工作台：手机号登录，新询盘和客户回复响铃提醒，213 号码在 App 里接打电话，通话自动出中英字幕。",
  /**
   * Twilio push credential (CR…) that rings the Android app through Firebase.
   * Empty until Firebase is set up for the project; then the credential is
   * created from the Firebase service-account JSON and its SID goes here.
   */
  twilioPushCredentialSid: "CR0cffc55d972a7abc0e0ca52f6ea6d27b",
} as const
