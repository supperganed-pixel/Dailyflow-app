import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "DailyFlow",
  slug: "dailyflow",
  version: "1.0.2",
  scheme: "dailyflow",
  orientation: "default",
  userInterfaceStyle: "automatic",
  icon: "./assets/images/icon.png",
  android: {
    package: process.env.ANDROID_PACKAGE ?? "com.newflow1.dailyflow",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/images/icon.png",
      backgroundColor: "#102A29",
    },
    allowBackup: false,
    permissions: ["POST_NOTIFICATIONS"],
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_CONTACTS",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.SCHEDULE_EXACT_ALARM",
      "android.permission.USE_EXACT_ALARM",
    ],
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/images/icon.png",
  },
  plugins: [
    "expo-secure-store",
    "expo-notifications",
    [
      "expo-share-intent",
      { disableIOS: true, androidIntentFilters: ["text/*"] },
    ],
  ],
  extra: {
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID ?? "6b38a4ce-ccb3-4412-bb74-d6c14de170ed",
    },
  },
  owner: process.env.EXPO_OWNER ?? "newflow1",
};
export default config;
