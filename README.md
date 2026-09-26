# CallBridge - Join FaceTime calls on Android

A modern Ionic/Capacitor app that makes it easy for Android users to join FaceTime calls with automated link handling.

## Features

✨ **Core Features**
- 🔗 **Deep Linking** - Click FaceTime links and open them directly in the app
- 🤖 **Auto-Join** - Automatically input your name and join calls
- 🎨 **Video Filters** - Apply beautiful filters and effects (Normal, Blur, Cool, Warm, Noir, Vivid)
- 📊 **Call Effects** - Adjust brightness, contrast, saturation, blur, and hue for real-time customization
- 📜 **Call History** - Track all your FaceTime calls with timestamps
- ⚙️ **Settings** - Customize your profile name and auto-join preferences
- 💾 **Local Storage** - All settings and history stored locally on your device

## Prerequisites

- Node.js 16+ and npm
- Android Studio (for Android development)
- Xcode (for iOS development, optional)
- Ionic CLI: `npm install -g @ionic/cli`
- Capacitor CLI: `npm install -g @capacitor/cli`

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd CallBridge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Sync the Android project:**
   ```bash
   npm run cap:sync
   ```
   The Capacitor Android project is included in this repository.

## Development

### Run in Browser
```bash
npm run ionic:serve
```

### Build for Production
```bash
npm run build
```

### Prepare for Android
```bash
npm run build
npm run cap:sync
cd android
./gradlew :app:assembleDebug
```
On Windows, run `gradlew.bat :app:assembleDebug` from `android/`. The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

### Open Android Studio
```bash
npm run cap:open
```

## Project Structure

```
CallBridge/
├── src/
│   ├── app/
│   │   ├── services/
│   │   │   ├── facetime.service.ts       # FaceTime link handling & deep linking
│   │   │   └── video-effects.service.ts  # Video filters and effects
│   │   ├── pages/
│   │   │   ├── home/                     # Main home page
│   │   │   ├── call/                     # Active call page with filters
│   │   │   ├── settings/                 # User settings
│   │   │   └── history/                  # Call history
│   │   ├── app-routing.module.ts
│   │   └── app.module.ts
│   ├── theme/
│   │   └── variables.scss                # Dark theme with cyan accents
│   ├── global.scss
│   ├── index.html
│   └── main.ts
├── android/                              # Capacitor Android project
├── capacitor.config.json
├── package.json
└── README.md
```

## Android Deep Links

The committed Android manifest registers both FaceTime URL schemes:

```xml
<activity>
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
   <data android:scheme="facetime" />
   <data android:scheme="https" android:host="facetime.apple.com" />
  </intent-filter>
</activity>
```

## Key Services

### FaceTimeService
- Handles deep linking for FaceTime URLs
- Manages auto-join functionality
- Stores user name and preferences
- Maintains call history

### VideoEffectsService
- Manages video filters (6 presets)
- Controls real-time effects (blur, brightness, contrast, saturation, hue)
- Persists filter preferences

## Feature Ideas to Implement

1. **Real-time WebRTC Integration**
   - Replace placeholder with actual WebRTC video stream
   - Implement local/remote stream handling

2. **Advanced Filters**
   - Background blur/replacement
   - Face detection and beautification
   - Custom filter creation

3. **Recording & Sharing**
   - Record calls locally
   - Share screenshots instantly
   - Video export functionality

4. **Contacts Integration**
   - Quick dial favorites
   - Contact sync from device
   - Call statistics per contact

5. **Accessibility Features**
   - Text-to-speech for accessibility
   - Closed captions support
   - Large text mode

6. **Performance Optimization**
   - Hardware acceleration
   - Adaptive bitrate streaming
   - Battery optimization modes

7. **Notifications**
   - Incoming call notifications
   - Missed call alerts
   - Do Not Disturb mode

8. **Screen Sharing**
   - Share screen during calls (if FaceTime supports)
   - App window sharing

9. **Call Quality Metrics**
   - Network stats display
   - Connection quality indicator
   - Bandwidth usage

10. **Dark/Light Theme Toggle**
    - Dynamic theming
    - Automatic theme based on system

## Security & Privacy

- All settings stored locally on device
- No data sent to external servers
- Permissions requested only when needed
- Transparent data handling

## Troubleshooting

### Deep Links Not Opening
1. Rebuild the app: `npm run cap:build`
2. Clear app cache in Android settings
3. Set the app as default for FaceTime links (if prompted)

### Video Stream Not Working
- Check camera permissions
- Verify WebRTC setup
- Enable mic/camera in app settings

### Performance Issues
- Reduce video resolution
- Disable heavy filters while on call
- Check device storage space

## Contributing

Contributions are welcome! Please follow the existing code style and submit pull requests for review.

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/samielmadani/CallBridge/issues)
- Email: support@example.com

## Changelog

### v1.0.0 (Initial Release)
- Auto-join FaceTime calls with deep linking
- 6 video filters and 5 adjustable effects
- Call history tracking
- User profile settings
- Modern dark UI with cyan accents
- Local storage for preferences

---

Made with ❤️ for Android users who want easy FaceTime calling experience.
