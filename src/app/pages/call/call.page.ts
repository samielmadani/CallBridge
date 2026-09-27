import { Component, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { App } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { Style, StatusBar } from '@capacitor/status-bar';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { FaceTimeCallData, FaceTimeService } from '../../services/facetime.service';
import {
  EffectOptions,
  VideoEffectsService,
} from '../../services/video-effects.service';

interface EmbeddedBrowser {
  addEventListener(name: string, callback: (event: any) => void): void;
  executeScript(details: { code: string }): void;
  close(): void;
}

declare const cordova: {
  InAppBrowser: {
    open(url: string, target: string, options: string): EmbeddedBrowser;
  };
  plugins: {
    permissions: {
      CAMERA: string;
      RECORD_AUDIO: string;
      requestPermissions(
        permissions: string[],
        success: (status: { hasPermission: boolean }) => void,
        failure: () => void
      ): void;
    };
  };
};

@Component({
  selector: 'app-call',
  templateUrl: './call.page.html',
  styleUrls: ['./call.page.scss'],
})
export class CallPage implements OnInit, OnDestroy {
  callUrl = '';
  currentCall: FaceTimeCallData | null = null;
  callDuration = 0;
  userName = '';
  autoJoinEnabled = true;
  filterOptions: EffectOptions = {
    blur: 0,
    brightness: 100,
    contrast: 100,
    saturate: 100,
    hueRotate: 0,
  };
  isEmbeddedCallOpen = false;
  callFrame: SafeResourceUrl | null = null;
  private activeCallUrl = '';
  private autoJoinStarted = false;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private browserRef: EmbeddedBrowser | null = null;
  private subscriptions = new Subscription();
  private backButtonListener: PluginListenerHandle | null = null;

  constructor(
    private faceTimeService: FaceTimeService,
    private videoEffectsService: VideoEffectsService,
    private sanitizer: DomSanitizer,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    void App.addListener('backButton', ({ canGoBack }) => {
      if (this.currentCall) return;
      if (canGoBack) window.history.back();
      else void App.exitApp();
    }).then((listener) => {
      this.backButtonListener = listener;
    });

    this.subscriptions.add(
      this.faceTimeService.userName$.subscribe((name) => {
        this.userName = name;
      })
    );
    this.subscriptions.add(
      this.faceTimeService.autoJoinEnabled$.subscribe((enabled) => {
        this.autoJoinEnabled = enabled;
      })
    );
    this.subscriptions.add(
      this.videoEffectsService.effectOptions$.subscribe((options) => {
        this.filterOptions = options;
        this.applyCallEffects();
      })
    );
    this.subscriptions.add(
      this.faceTimeService.currentCall$.subscribe((call) => {
        this.currentCall = call;
        if (call) {
          this.callUrl = call.url;
          void this.openCallSurface(call);
        } else {
          this.resetCallSurface();
        }
      })
    );
  }

  async joinCall() {
    const url = this.callUrl.trim();
    if (!this.isFaceTimeLink(url)) {
      await this.showToast('Enter a valid FaceTime link to continue.');
      return;
    }
    await this.faceTimeService.handleFaceTimeLink(url);
  }

  endCall() {
    const browser = this.browserRef;
    this.browserRef = null;
    browser?.close();
    this.faceTimeService.endCall();
  }

  getFormattedTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(remainingSeconds)}`;
  }

  private async openCallSurface(call: FaceTimeCallData) {
    if (this.activeCallUrl === call.url) return;
    this.activeCallUrl = call.url;
    this.callDuration = 0;
    this.autoJoinStarted = false;
    this.timerInterval = setInterval(() => this.callDuration++, 1000);

    const targetUrl = this.toWebCallUrl(call.url);
    if (!Capacitor.isNativePlatform()) {
      this.callFrame = this.sanitizer.bypassSecurityTrustResourceUrl(targetUrl);
      return;
    }

    await this.setCallStatusBar();
    const permissionsGranted = await this.requestMediaPermissions();
    if (!permissionsGranted) {
      await this.showToast('Camera or microphone access was not granted.');
    }
    if (this.currentCall?.url !== call.url) return;

    if (typeof cordova === 'undefined' || !cordova.InAppBrowser) {
      await this.showToast('The in-app call view is unavailable on this device.');
      return;
    }

    this.browserRef = cordova.InAppBrowser.open(
      targetUrl,
      '_blank',
      'location=no,toolbar=yes,toolbarposition=top,toolbarcolor=#171a16,closebuttoncaption=End call,closebuttoncolor=#d6ef79,hidenavigationbuttons=yes,hideurlbar=yes,hardwareback=yes,fullscreen=yes,mediaPlaybackRequiresUserAction=no,zoom=no'
    );
    this.isEmbeddedCallOpen = true;
    this.browserRef.addEventListener('loadstop', (event) => {
      if (event.url?.includes('facetime.apple.com')) {
        this.applyCallPresentation();
        this.attemptAutoJoin();
        this.applyCallEffects();
      }
    });
    this.browserRef.addEventListener('loaderror', (event) => {
      void this.showToast(event.message || 'FaceTime could not be loaded.');
    });
    this.browserRef.addEventListener('exit', () => {
      this.browserRef = null;
      this.isEmbeddedCallOpen = false;
      this.faceTimeService.endCall();
    });
  }

  private attemptAutoJoin() {
    if (
      !this.autoJoinEnabled ||
      !this.userName ||
      !this.browserRef ||
      this.autoJoinStarted
    ) {
      return;
    }

    const name = JSON.stringify(this.userName);
    const script = `(function(){
      if (window.__callBridgeJoinTask) return true;
      window.__callBridgeJoinTask = true;
      var displayName = ${name};
      var attempts = 0;
      var joinCall = function() {
        var inputs = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
        var nameInput = inputs.find(function(input) {
          return /name|display/i.test([input.name, input.id, input.placeholder, input.getAttribute('aria-label')].join(' '));
        }) || inputs.find(function(input) { return input.type === 'text'; });
        if (nameInput) {
          var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(nameInput, displayName);
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          nameInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        var joinButton = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(function(button) {
          return /join/i.test(button.innerText || button.value || '');
        });
        if (nameInput && joinButton && !joinButton.disabled) {
          joinButton.click();
          return;
        }
        if (++attempts < 40) window.setTimeout(joinCall, 500);
        else window.__callBridgeJoinTask = false;
      };
      joinCall();
      return true;
    })();`;

    this.autoJoinStarted = true;
    this.browserRef.executeScript({ code: script });
  }

  private applyCallEffects() {
    if (!this.browserRef) return;
    const filter = this.getCallFilterStyle();
    this.browserRef.executeScript({
      code: `document.querySelectorAll('video').forEach(function(video) { video.style.filter = ${JSON.stringify(filter)}; });`,
    });
  }

  private applyCallPresentation() {
    if (!this.browserRef) return;
    this.browserRef.executeScript({
      code: `(function() {
        if (!document.getElementById('callbridge-call-style')) {
          var style = document.createElement('style');
          style.id = 'callbridge-call-style';
          style.textContent = ${JSON.stringify(`
            :root {
              color-scheme: dark !important;
              --accent-color: #d6ef79 !important;
              --tint-color: #d6ef79 !important;
              --system-green: #d6ef79 !important;
              font-family: 'Aptos', 'Segoe UI Variable', 'Segoe UI', sans-serif !important;
            }
            html, body, #root, main {
              background-color: transparent !important;
              color: #f3f2e7 !important;
            }
            *, *::before, *::after {
              font-family: 'Aptos', 'Segoe UI Variable', 'Segoe UI', sans-serif !important;
              letter-spacing: 0 !important;
            }
            button, [role="button"], input[type="button"], input[type="submit"] {
              appearance: none !important;
              -webkit-appearance: none !important;
              border: 1px solid rgba(255,255,255,.18) !important;
              border-radius: 16px !important;
              background: rgba(25,28,24,.82) !important;
              color: #f5f4ed !important;
              box-shadow: 0 8px 24px rgba(0,0,0,.24) !important;
              font: 600 14px/1.2 'Aptos', 'Segoe UI Variable', 'Segoe UI', sans-serif !important;
              transition: transform .14s ease, background-color .14s ease !important;
            }
            button:active, [role="button"]:active {
              transform: scale(.96) !important;
              background: rgba(214,239,121,.2) !important;
            }
            button[aria-label], [role="button"][aria-label] {
              border-radius: 50% !important;
              background: rgba(25,28,24,.74) !important;
              box-shadow: 0 5px 20px rgba(0,0,0,.3) !important;
            }
            button[aria-label*="join" i], [role="button"][aria-label*="join" i],
            button[type="submit"], input[type="submit"] {
              border: 0 !important;
              border-radius: 999px !important;
              background: #d6ef79 !important;
              color: #171a16 !important;
            }
            [class*="card"], [class*="panel"], [class*="container"] {
              border-color: transparent !important;
              box-shadow: none !important;
            }
          `)};
          document.head.appendChild(style);
        }
        if (!window.__callBridgeBackGuard) {
          window.__callBridgeBackGuard = true;
          var pinHistory = function() {
            try { history.pushState({ callBridgeActive: true }, '', location.href); } catch (_) {}
          };
          pinHistory();
          window.addEventListener('popstate', pinHistory);
        }
      })();`,
    });
  }

  getCallFilterStyle(): string {
    const effects = this.filterOptions;
    return `blur(${effects.blur}px) brightness(${effects.brightness}%) contrast(${effects.contrast}%) saturate(${effects.saturate}%) hue-rotate(${effects.hueRotate}deg)`;
  }

  private async requestMediaPermissions(): Promise<boolean> {
    if (typeof cordova === 'undefined' || !cordova.plugins?.permissions) return true;
    return new Promise((resolve) => {
      cordova.plugins.permissions.requestPermissions(
        [cordova.plugins.permissions.CAMERA, cordova.plugins.permissions.RECORD_AUDIO],
        (status) => resolve(status.hasPermission),
        () => resolve(false)
      );
    });
  }

  private async setCallStatusBar() {
    try {
      await StatusBar.hide();
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Dark });
    } catch {
      return;
    }
  }

  private async restoreStatusBar() {
    try {
      await StatusBar.show();
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: '#171a16' });
      await StatusBar.setStyle({ style: Style.Light });
    } catch {
      return;
    }
  }

  private isFaceTimeLink(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'facetime:' || url.hostname === 'facetime.apple.com';
    } catch {
      return false;
    }
  }

  private toWebCallUrl(value: string): string {
    const url = new URL(value);
    if (url.protocol !== 'facetime:') return value;
    const room = `${url.host}${url.pathname}`.replace(/^\/+/, '');
    return `https://facetime.apple.com/${room}`;
  }

  private async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2600,
      position: 'bottom',
    });
    await toast.present();
  }

  private resetCallSurface() {
    this.activeCallUrl = '';
    this.callFrame = null;
    this.isEmbeddedCallOpen = false;
    this.autoJoinStarted = false;
    this.callDuration = 0;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    void this.restoreStatusBar();
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    void this.backButtonListener?.remove();
    if (this.timerInterval) clearInterval(this.timerInterval);
  }
}
