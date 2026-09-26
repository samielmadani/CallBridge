# CallBridge Setup Guide

## Quick Start (5 minutes)

### 1. Install Dependencies
```bash
cd CallBridge
npm install
```

### 2. Run Development Server
```bash
npm run ionic:serve
```
Opens at: `http://localhost:8100`

### 3. Build for Android
```bash
npm run cap:build
npm run cap:open
```

---

## Full Setup Instructions

### Prerequisites
- **Node.js**: v20+ ([Download](https://nodejs.org))
- **npm**: v8+ (comes with Node.js)
- **Java Development Kit (JDK)**: 17+ ([Download](https://www.oracle.com/java/technologies/downloads/))
- **Android Studio**: Latest version ([Download](https://developer.android.com/studio))
- **Ionic CLI**: `npm install -g @ionic/cli`
- **Capacitor CLI**: `npm install -g @capacitor/cli`

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd CallBridge
```

### Step 2: Install Node Modules
```bash
npm install
```

### Step 3: Sync Capacitor
```bash
npm run cap:sync
```
The Android project is committed in `android/`; `cap:add` is only needed if recreating the native platform.

### Step 4: Verify Deep Linking

The committed `android/app/src/main/AndroidManifest.xml` already registers FaceTime links. Its activity filter is:

```xml
<activity
    android:name=".MainActivity"
    android:theme="@style/AppTheme"
    android:label="@string/title_activity_main"
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale"
    android:windowSoftInputMode="adjustResize"
    android:launchMode="singleTask"
    android:exported="true">

    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>

    <!-- FaceTime Deep Linking -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="facetime" />
        <data android:scheme="https" android:host="facetime.apple.com" />
    </intent-filter>
</activity>
```

### Step 5: Set App Permissions

In `android/app/src/main/AndroidManifest.xml`, add inside `<manifest>`:

```xml
<!-- Required Permissions -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
```

### Step 6: Build and Run

#### Development (Web Browser)
```bash
npm run ionic:serve
```

#### Android Device/Emulator
```bash
npm run build
npm run cap:sync
cd android
./gradlew :app:assembleDebug
```
On Windows, use `gradlew.bat :app:assembleDebug`. The installable debug APK is created at `app/build/outputs/apk/debug/app-debug.apk`.
Run `npm run cap:open` from the repository root to open Android Studio.

In Android Studio:
1. Click the "Run" button (green play icon)
2. Select your device or emulator
3. The app will build and launch

---

## Development Workflow

### Making Changes

1. **Edit source code** in `src/` directory
2. **Save files** (auto-reload in browser)
3. **For Android changes:**
   ```bash
    npm run cap:build  # Build web app and sync native project
   ```
4. **Refresh in Android Studio** and run again

### Project Structure
```
CallBridge/
├── src/
│   ├── app/
│   │   ├── services/          # Business logic
│   │   │   ├── facetime.service.ts
│   │   │   └── video-effects.service.ts
│   │   ├── pages/             # Page components
│   │   │   ├── home/
│   │   │   ├── call/
│   │   │   ├── settings/
│   │   │   └── history/
│   │   ├── app.module.ts
│   │   └── app-routing.module.ts
│   ├── theme/
│   │   └── variables.scss     # Dark theme
│   ├── global.scss
│   └── index.html
├── android/                   # Capacitor Android project
├── package.json
├── capacitor.config.json
└── README.md
```

---

## Testing

### Browser Testing
```bash
npm run ionic:serve
```
- Open DevTools (F12)
- Test all pages and interactions
- Test localStorage persists

### Android Testing
```bash
npm run cap:open
```
- Run on emulator or device
- Test deep linking with:
  ```bash
  adb shell am start -W -a android.intent.action.VIEW \
    -d "https://facetime.apple.com/join/xyz123" \
    com.samielmadani.callbridge
  ```

### Debugging Android
In Android Studio:
1. Connect device via USB
2. Enable USB Debugging
3. Click "Debug 'app'"
4. Set breakpoints in Kotlin files
5. Use Logcat for console logs

---

## Build & Release

### Debug APK
```bash
npm run build
npx cap sync android
cd android
./gradlew :app:assembleDebug
```
The workflow publishes a debug-signed APK to GitHub Releases on pushes to `main`. It uses this repository's dedicated `android/app/debug.keystore`; it does not create release-signed builds.

### Release Checklist
- [ ] Review the Android base version in `android/app/build.gradle`
- [ ] Update `README.md` changelog
- [ ] Test all features on real device
- [ ] Run Lighthouse CI
- [ ] Check no console errors
- [ ] Verify deep linking works
- [ ] Test Settings > About

---

## Troubleshooting

### Issue: Deep Links Not Opening
**Solution:**
```bash
npm run cap:build
adb shell am start -W -a android.intent.action.MAIN \
  -n com.samielmadani.callbridge/.MainActivity
```

### Issue: Android Studio Can't Find Project
**Solution:**
1. File → Open
2. Navigate to `CallBridge/android`
3. Click OK

### Issue: Build Fails with Gradle Error
**Solution:**
```bash
cd android
./gradlew clean build
cd ..
npm run cap:sync
```

### Issue: Blank White Screen on Launch
**Solution:**
1. Check `src/index.html` exists
2. Check `src/main.ts` exists
3. Run: `npm run build`
4. Check browser console for errors

### Issue: Camera/Mic Not Working
**Solution:**
- Add permissions to `AndroidManifest.xml`
- Request runtime permissions in code
- Test with `adb shell pm grant` command

---

## Environment Variables

Create `.env` file in root:
```env
# API Configuration
API_URL=https://api.example.com
DEBUG=false

# Feature Flags
ENABLE_WEBRTC=true
ENABLE_FILTERS=true
ENABLE_RECORDING=false
```

Load in `app.module.ts`:
```typescript
import { environment } from '@env/environment';
```

---

## Performance Tips

1. **Lazy Loading**: Pages load on-demand
2. **OnPush Strategy**: Add to components
3. **Unsubscribe**: Use `takeUntil` pattern
4. **Images**: Optimize and compress
5. **Production Mode**: Run with `--prod` flag

---

## Resources

- [Ionic Getting Started](https://ionicframework.com/docs/intro/cli)
- [Capacitor Android Guide](https://capacitorjs.com/docs/android)
- [Angular Best Practices](https://angular.io/guide/styleguide)
- [FaceTime Link Format](https://support.apple.com/en-us/HT210999)

---

## Support

Need help? Check:
1. [GitHub Issues](https://github.com/samielmadani/CallBridge/issues)
2. [Ionic Forum](https://forum.ionicframework.com)
3. [Stack Overflow](https://stackoverflow.com/questions/tagged/ionic)

---

**Ready to build? Let's go! 🚀**

Questions? Create an issue or reach out on the repo!
