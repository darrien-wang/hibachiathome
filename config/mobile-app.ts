// The Android workbench app (realhibachi-order-management-system/mobile-android).
// Bump these when a new APK is published so phones prompt for the update;
// the app checks /api/admin/mobile/version on launch.
export const MOBILE_APP = {
  /** Phones below this versionCode are told to update before continuing. */
  minVersionCode: 2,
  latestVersionCode: 2,
  latestVersionName: "2.0.0",
  apkUrl: "https://www.realhibachi.com/app/realhibachi-workbench.apk",
  notes: "新工作台：手机号登录，新询盘和客户回复响铃提醒。",
} as const
