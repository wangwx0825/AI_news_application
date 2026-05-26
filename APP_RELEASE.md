# AI News Native App Release

This project uses Capacitor to package the deployed web app as native iOS and Android apps.

## App Identity

- App name: `AI News`
- Bundle ID / package name: `com.wangwx0825.ainews`
- Web app URL: `https://ai-news-application.vercel.app`
- Vercel project: `ai-news-application`
- GitHub repository: `wangwx0825/AI_news_application`

## Local Setup

Install dependencies:

```bash
npm install
```

Sync web and native projects:

```bash
npm run cap:sync
```

## iOS

Requirements:

- macOS with full Xcode installed
- Apple Developer account
- App Store Connect app record for `AI News`

Open the iOS project:

```bash
npm run cap:open:ios
```

In Xcode:

1. Select the `App` target.
2. Choose your Apple developer team under Signing & Capabilities.
3. Confirm the bundle identifier is `com.wangwx0825.ainews`.
4. Set version and build number.
5. Use Product > Archive.
6. Upload the archive to App Store Connect.

## Android

Requirements:

- Android Studio
- Android SDK installed
- `ANDROID_HOME` configured or `android/local.properties` containing `sdk.dir`
- Google Play Console developer account

Build a debug APK:

```bash
npm run android:debug
```

Build a Play Store Android App Bundle:

```bash
npm run android:release
```

The release bundle is generated at:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

Before uploading to Google Play, configure release signing in Android Studio or Gradle.

## Updating The App

Most content and UI updates happen on the web app. Push to:

```text
wangwx0825/AI_news_application
```

Vercel deploys the web app automatically. The native app loads:

```text
https://ai-news-application.vercel.app
```

If you change native settings, icons, bundle ID, package name, permissions, or splash screens, run:

```bash
npm run cap:sync
```

Then rebuild and resubmit the native app.
