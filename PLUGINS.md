# Custom Capacitor Plugins for CallBridge

## Overview
While CallBridge primarily uses existing Capacitor plugins, here's how to extend it with custom functionality.

---

## 1. Deep Linking Plugin Enhancement

### Current Implementation (Built-in)
Uses `@capacitor/app` to handle deep links:

```typescript
App.addListener('appUrlOpen', (event: any) => {
  const url = event.url;
  if (url.includes('facetime.apple.com') || url.includes('facetime')) {
    // Handle FaceTime link
  }
});
```

### Custom Plugin: FaceTimeDeepLinkHandler

If you need advanced deep linking:

**Create file: `plugins/FaceTimeDeepLink/FaceTimeDeepLink.ts`**

```typescript
import { registerPlugin } from '@capacitor/core';

export interface FaceTimeLink {
  url: string;
  participantId?: string;
  timestamp: number;
}

export interface FaceTimeLinkPlugin {
  parseFaceTimeLink(options: { url: string }): Promise<FaceTimeLink>;
  autoJoinCall(options: { url: string; userName: string }): Promise<boolean>;
}

registerPlugin<FaceTimeLinkPlugin>('FaceTimeDeepLink');
```

### Implementation in Service

```typescript
// facetime.service.ts
import { FaceTimeLinkPlugin } from '@plugins/FaceTimeDeepLink/FaceTimeDeepLink';

export class FaceTimeService {
  private faceTimePlugin: FaceTimeLinkPlugin;

  constructor() {
    this.faceTimePlugin = FaceTimeLinkPlugin;
  }

  async handleAdvancedLink(url: string) {
    const linkData = await this.faceTimePlugin.parseFaceTimeLink({ url });
    return linkData;
  }
}
```

---

## 2. Video Filter Plugin

### Custom Native Filter Processing

**File: `plugins/VideoFilters/VideoFilters.ts`**

```typescript
export interface VideoFilter {
  name: string;
  intensity: number;
}

export interface VideoFiltersPlugin {
  applyFilter(options: { 
    filterId: string; 
    intensity: number;
  }): Promise<string>;
  
  processFrame(options: { 
    frameData: ArrayBuffer;
    width: number;
    height: number;
  }): Promise<ArrayBuffer>;
}
```

### Performance Benefits
- Offload filter processing to native code
- GPU acceleration for real-time filters
- Reduced CPU usage
- Better battery performance

---

## 3. Call Recording Plugin

### File: `plugins/CallRecorder/CallRecorder.ts`

```typescript
export interface RecordingOptions {
  audioOnly: boolean;
  quality: 'low' | 'medium' | 'high';
  maxDuration: number;
}

export interface CallRecorderPlugin {
  startRecording(options: RecordingOptions): Promise<void>;
  stopRecording(): Promise<string>;
  getRecordings(): Promise<RecordingFile[]>;
  deleteRecording(path: string): Promise<void>;
}

export interface RecordingFile {
  name: string;
  path: string;
  duration: number;
  size: number;
  createdAt: Date;
}
```

### Usage in Service

```typescript
export class CallRecordingService {
  async startRecording() {
    await CallRecorder.startRecording({
      audioOnly: false,
      quality: 'high',
      maxDuration: 3600,
    });
  }

  async stopAndSaveRecording() {
    const recordingPath = await CallRecorder.stopRecording();
    return recordingPath;
  }
}
```

---

## 4. Real-time Effects Plugin

### File: `plugins/RealTimeEffects/RealTimeEffects.ts`

```typescript
export interface EffectOptions {
  blur: number;
  brightness: number;
  contrast: number;
  beautify: number;
  faceDetection: boolean;
}

export interface RealTimeEffectsPlugin {
  updateEffects(options: EffectOptions): Promise<void>;
  enableBeautification(intensity: number): Promise<void>;
  detectFaces(): Promise<Face[]>;
  applyVirtualBackground(imageUrl: string): Promise<void>;
}

export interface Face {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}
```

---

## 5. Contact Integration Plugin

### File: `plugins/ContactSync/ContactSync.ts`

```typescript
export interface Contact {
  id: string;
  name: string;
  phones: string[];
  emails: string[];
  photo?: string;
}

export interface ContactSyncPlugin {
  getContacts(): Promise<Contact[]>;
  getContactById(id: string): Promise<Contact>;
  searchContacts(query: string): Promise<Contact[]>;
  watchContactChanges(callback: (contact: Contact) => void): Promise<void>;
}
```

---

## Building Custom Plugins

### Step 1: Create Plugin Structure
```
MyPlugin/
├── src/
│   ├── MyPlugin.ts        # TypeScript interface
│   └── MyPlugin.web.ts    # Web implementation
├── android/
│   ├── MyPlugin.kt        # Android implementation
│   └── MyPlugin.java
├── ios/
│   └── MyPlugin.swift     # iOS implementation
└── package.json
```

### Step 2: Implement Android Layer

**File: `android/src/main/java/com/callbridge/plugin/MyPlugin.kt`**

```kotlin
package com.samielmadani.callbridge.plugin

import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "MyPlugin")
class MyPlugin : Plugin() {
    private lateinit var context: Context

    override fun load() {
        context = activity.baseContext
    }

    @PluginMethod
    fun myMethod(call: PluginCall) {
        val value = call.getString("value")
        val result = JSObject()
        result.put("result", "Hello $value")
        call.resolve(result)
    }

    @PluginMethod
    fun myAsyncMethod(call: PluginCall) {
        Thread {
            try {
                // Do async work
                val result = JSObject()
                result.put("success", true)
                call.resolve(result)
            } catch (e: Exception) {
                call.reject(e.message)
            }
        }.start()
    }
}
```

### Step 3: Implement Web Layer

**File: `src/MyPlugin.web.ts`**

```typescript
import { WebPlugin } from '@capacitor/core';
import { MyPluginPlugin } from './definitions';

export class MyPluginWeb extends WebPlugin implements MyPluginPlugin {
  myMethod(options: { value: string }): Promise<{ result: string }> {
    return Promise.resolve({
      result: `Hello ${options.value}`,
    });
  }

  async myAsyncMethod(): Promise<{ success: boolean }> {
    return { success: true };
  }
}
```

### Step 4: Register Plugin

**In your Capacitor app:**

```typescript
import { registerPlugin } from '@capacitor/core';
import { MyPluginWeb } from './plugins/MyPlugin/MyPlugin.web';

const MyPlugin = registerPlugin<MyPluginPlugin>('MyPlugin', {
  web: () => new MyPluginWeb(),
});
```

---

## Testing Custom Plugins

### Unit Tests

```typescript
// my-plugin.spec.ts
describe('MyPlugin', () => {
  it('should return hello message', async () => {
    const result = await MyPlugin.myMethod({ value: 'World' });
    expect(result.result).toBe('Hello World');
  });
});
```

### Integration Tests

```typescript
describe('MyPlugin Integration', () => {
  beforeEach(async () => {
    // Setup
  });

  it('should work on Android', async () => {
    if (getPlatform() !== 'android') return;
    // Test Android-specific functionality
  });
});
```

---

## Publishing Custom Plugins

### Create package.json

```json
{
  "name": "@callbridge/facetime-deeplink",
  "version": "1.0.0",
  "description": "Custom Capacitor plugin for FaceTime deep linking",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist/",
    "android/",
    "ios/"
  ],
  "scripts": {
    "build": "tsc",
    "publish": "npm publish"
  }
}
```

### Install in Main App

```bash
npm install @callbridge/facetime-deeplink
npx cap sync
```

---

## Performance Considerations

### Optimization Tips

1. **Offload to Native**: Heavy computations
   ```typescript
   // ❌ Bad: JavaScript processing
   const filtered = processFrameJS(frame);
   
   // ✅ Good: Native processing
   const filtered = await VideoFilters.processFrame(frame);
   ```

2. **Use Threads**: Async operations
   ```kotlin
   Thread {
       // Long-running task
       call.resolve(result)
   }.start()
   ```

3. **Memory Management**: Release resources
   ```kotlin
   override fun onDestroy() {
       // Cleanup
   }
   ```

---

## Resources

- [Capacitor Plugin Development](https://capacitorjs.com/docs/plugins/creating-plugins)
- [Kotlin Documentation](https://kotlinlang.org/docs/)
- [Android Native Development](https://developer.android.com/guide)
- [Performance Best Practices](https://developer.android.com/training/articles/perf-anr)

---

## Next Steps

1. Start with simple **Bridge Plugins** for native access
2. Progress to **Feature Plugins** for specific functionality
3. Optimize with **Performance Plugins** for heavy operations
4. Share and publish useful plugins to the community!

---

**Happy plugin development! 🔌**
