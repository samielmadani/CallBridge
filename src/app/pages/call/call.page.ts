import { Component, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Capacitor } from '@capacitor/core';
import { Style, StatusBar } from '@capacitor/status-bar';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { FaceTimeCallData, FaceTimeService } from '../../services/facetime.service';

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
  isEmbeddedCallOpen = false;
  callFrame: SafeResourceUrl | null = null;
  private activeCallUrl = '';
  private autoJoinStarted = false;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private browserRef: EmbeddedBrowser | null = null;
  private subscriptions = new Subscription();

  constructor(
    private faceTimeService: FaceTimeService,
    private sanitizer: DomSanitizer,
    private toastController: ToastController
  ) {}

  ngOnInit() {
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
      'location=no,toolbar=yes,toolbarposition=top,toolbarcolor=#081820,closebuttoncaption=End,closebuttoncolor=#53e2cf,hidenavigationbuttons=yes,hideurlbar=yes,hardwareback=yes,mediaPlaybackRequiresUserAction=no,zoom=no'
    );
    this.isEmbeddedCallOpen = true;
    this.browserRef.addEventListener('loadstop', (event) => {
      if (event.url?.includes('facetime.apple.com')) this.attemptAutoJoin();
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
      await StatusBar.setBackgroundColor({ color: '#081820' });
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
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    if (this.timerInterval) clearInterval(this.timerInterval);
  }
}
