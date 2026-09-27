import { Component, OnDestroy, OnInit } from '@angular/core';
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
  private activeCallUrl = '';
  private autoJoinStarted = false;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private browserRef: EmbeddedBrowser | null = null;
  private subscriptions = new Subscription();
  private backButtonListener: PluginListenerHandle | null = null;

  constructor(
    private faceTimeService: FaceTimeService,
    private videoEffectsService: VideoEffectsService,
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
      window.location.assign(targetUrl);
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
    this.browserRef.addEventListener('message', (event) => {
      let message = event.data;
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
        } catch {
          return;
        }
      }
      if (message?.callBridgeAction === 'end-call') this.endCall();
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
      var observer;
      var poll;
      var timeout;
      var scanning = false;
      var visible = function(element) {
        if (!element || !element.getClientRects().length) return false;
        var style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      };
      var label = function(element) {
        return (element.getAttribute('aria-label') || element.innerText || element.textContent || '')
          .replace(/\\s+/g, ' ').trim();
      };
      var disabled = function(element) {
        return element.disabled || element.getAttribute('aria-disabled') === 'true' ||
          !!element.querySelector('button:disabled');
      };
      var action = function(pattern) {
        return Array.from(document.querySelectorAll('ui-button[role="button"], [role="button"], button'))
          .find(function(element) {
            return visible(element) && !disabled(element) && pattern.test(label(element));
          });
      };
      var finish = function(status) {
        window.__callBridgeJoinStatus = status;
        if (observer) observer.disconnect();
        if (poll) window.clearInterval(poll);
        if (timeout) window.clearTimeout(timeout);
      };
      var joinCall = function() {
        if (scanning) return;
        scanning = true;
        var nameInput = document.querySelector('#name-entry');
        if (visible(nameInput)) {
          var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          if (nameInput.value !== displayName) {
            setter.call(nameInput, displayName);
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            nameInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          var continueButton = action(/^continue$/i);
          if (continueButton) {
            continueButton.click();
            window.__callBridgeJoinStatus = 'continue-clicked';
            console.info('[CallBridge] FaceTime name step submitted.');
          }
          scanning = false;
          return;
        }
        var joinButton = document.querySelector('#callcontrols-join-button-session-banner');
        if (!visible(joinButton)) joinButton = action(/^join(?:\\s+as\\b.*)?$/i);
        if (joinButton && visible(joinButton) && !disabled(joinButton)) {
          joinButton.click();
          console.info('[CallBridge] FaceTime join request submitted.');
          finish('join-requested');
          scanning = false;
          return;
        }
        scanning = false;
        if (++attempts >= 267) {
          window.__callBridgeJoinTask = false;
          finish('timed-out');
          console.warn('[CallBridge] FaceTime join controls did not become available.');
        }
      };
      observer = new MutationObserver(joinCall);
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
      poll = window.setInterval(joinCall, 150);
      timeout = window.setTimeout(function() {
        window.__callBridgeJoinTask = false;
        finish('timed-out');
        console.warn('[CallBridge] FaceTime join timed out.');
      }, 40000);
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
              --system-green-rgb: 214, 239, 121 !important;
              --system-green: #d6ef79 !important;
              font-family: 'Aptos', 'Segoe UI Variable', 'Segoe UI', sans-serif !important;
            }
            html, body, #root, main {
              background-color: #111310 !important;
              color: #f3f2e7 !important;
            }
            *, *::before, *::after {
              font-family: 'Aptos', 'Segoe UI Variable', 'Segoe UI', sans-serif !important;
              letter-spacing: 0 !important;
            }
            #name-entry, input[type="text"] {
              appearance: none !important;
              -webkit-appearance: none !important;
              box-sizing: border-box !important;
              width: 100% !important;
              min-height: 54px !important;
              padding: 14px 16px !important;
              border: 1px solid rgba(255,255,255,.2) !important;
              border-radius: 14px !important;
              background: rgba(255,255,255,.065) !important;
              color: #f3f2e7 !important;
              font: 400 16px/1.35 'Aptos', 'Segoe UI Variable', 'Segoe UI', sans-serif !important;
            }
            ui-button[role="button"] {
              appearance: none !important;
              -webkit-appearance: none !important;
              box-sizing: border-box !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              width: max-content !important;
              min-width: 76px !important;
              max-width: calc(100vw - 32px) !important;
              min-height: 46px !important;
              height: auto !important;
              flex: 0 1 auto !important;
              padding: 12px 20px !important;
              overflow: hidden !important;
              border: 1px solid transparent !important;
              border-radius: 16px !important;
              background:
                linear-gradient(rgba(44,48,40,.64), rgba(44,48,40,.64)) padding-box,
                linear-gradient(135deg, rgba(255,255,255,.68), rgba(214,239,121,.38)) border-box !important;
              color: #f3f2e7 !important;
              box-shadow: 0 8px 24px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.18) !important;
              -webkit-backdrop-filter: blur(38px) saturate(150%) !important;
              backdrop-filter: blur(38px) saturate(150%) !important;
              font: 600 15px/1.2 'Aptos', 'Segoe UI Variable', 'Segoe UI', sans-serif !important;
              white-space: nowrap !important;
              transition: transform .14s ease, filter .14s ease !important;
            }
            ui-button.continue-button[role="button"], ui-button.cta[role="button"] {
              min-width: 160px !important;
              min-height: 52px !important;
              padding: 15px 28px !important;
              border-radius: 16px !important;
              background:
                linear-gradient(rgba(214,239,121,.18), rgba(214,239,121,.18)) padding-box,
                linear-gradient(135deg, rgba(255,255,255,.68), rgba(214,239,121,.58)) border-box !important;
              color: #d6ef79 !important;
              font-size: 16px !important;
              font-weight: 700 !important;
            }
            ui-button.destructive[role="button"] {
              background:
                linear-gradient(rgba(242,118,96,.2), rgba(242,118,96,.2)) padding-box,
                linear-gradient(135deg, rgba(255,255,255,.68), rgba(242,118,96,.5)) border-box !important;
              color: #ff9a84 !important;
            }
            ui-button[aria-disabled="true"] {
              opacity: .56 !important;
            }
            ui-toggle-button[role="button"], ui-button.icon-circle[role="button"] {
              width: 52px !important;
              min-width: 52px !important;
              height: 52px !important;
              min-height: 52px !important;
              flex: 0 0 52px !important;
              padding: 0 !important;
              border-radius: 50% !important;
              background:
                linear-gradient(rgba(44,48,40,.64), rgba(44,48,40,.64)) padding-box,
                linear-gradient(135deg, rgba(255,255,255,.68), rgba(214,239,121,.38)) border-box !important;
              color: #f3f2e7 !important;
              box-shadow: 0 8px 24px rgba(0,0,0,.28) !important;
              -webkit-backdrop-filter: blur(38px) saturate(150%) !important;
              backdrop-filter: blur(38px) saturate(150%) !important;
            }
            ui-toggle-button svg {
              width: 22px !important;
              height: 22px !important;
              fill: #f3f2e7 !important;
            }
            ui-button[role="button"]:active, ui-toggle-button[role="button"]:active {
              transform: scale(.96) !important;
              filter: brightness(1.12) !important;
            }
            .session-banner {
              position: fixed !important;
              top: auto !important;
              right: auto !important;
              bottom: calc(20px + env(safe-area-inset-bottom, 0px)) !important;
              left: 50% !important;
              width: min(560px, calc(100vw - 32px)) !important;
              max-width: calc(100vw - 32px) !important;
              margin: 0 !important;
              padding: 14px !important;
              display: flex !important;
              flex-direction: column !important;
              gap: 12px !important;
              box-sizing: border-box !important;
              border: 1px solid transparent !important;
              border-radius: 28px !important;
              transform: translateX(-50%) !important;
              background:
                linear-gradient(rgba(44,48,40,.72), rgba(44,48,40,.72)) padding-box,
                linear-gradient(135deg, rgba(255,255,255,.68), rgba(214,239,121,.38)) border-box !important;
              box-shadow: 0 8px 24px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.18) !important;
              -webkit-backdrop-filter: blur(38px) saturate(150%) !important;
              backdrop-filter: blur(38px) saturate(150%) !important;
              z-index: 2147483000 !important;
            }
            .top-tray, .gft-call-controls, .action-controls {
              position: static !important;
              width: 100% !important;
              margin: 0 !important;
            }
            .top-tray {
              display: flex !important;
              align-items: center !important;
              gap: 10px !important;
            }
            .action-controls {
              justify-content: space-around !important;
              padding: 0 !important;
            }
            .action-controls li {
              flex: 1 1 0 !important;
              display: flex !important;
              justify-content: center !important;
            }
            .callbridge-hide-leave {
              display: none !important;
            }
            .generic-toast {
              position: fixed !important;
              top: auto !important;
              right: auto !important;
              bottom: calc(192px + env(safe-area-inset-bottom, 0px)) !important;
              left: 50% !important;
              width: max-content !important;
              max-width: calc(100vw - 40px) !important;
              transform: translateX(-50%) !important;
              z-index: 2147482000 !important;
            }
            .generic-toast-wrapper {
              box-sizing: border-box !important;
              min-height: 46px !important;
              display: flex !important;
              align-items: center !important;
              padding: 10px 16px !important;
              border: 1px solid transparent !important;
              border-radius: 16px !important;
              background:
                linear-gradient(rgba(44,48,40,.78), rgba(44,48,40,.78)) padding-box,
                linear-gradient(135deg, rgba(255,255,255,.68), rgba(214,239,121,.38)) border-box !important;
              box-shadow: 0 8px 24px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.16) !important;
              -webkit-backdrop-filter: blur(38px) saturate(150%) !important;
              backdrop-filter: blur(38px) saturate(150%) !important;
            }
            .generic-toast-text {
              display: flex !important;
              align-items: center !important;
              gap: 9px !important;
              color: #f3f2e7 !important;
              font: 600 13px/1.35 'Aptos', 'Segoe UI Variable', 'Segoe UI', sans-serif !important;
            }
            .generic-toast-text::before {
              content: '' !important;
              width: 7px !important;
              height: 7px !important;
              flex: 0 0 7px !important;
              border-radius: 50% !important;
              background: #d6ef79 !important;
              box-shadow: 0 0 12px rgba(214,239,121,.5) !important;
            }
            #callbridge-end-call {
              position: static !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              min-width: 112px !important;
              min-height: 46px !important;
              margin-left: auto !important;
              padding: 12px 16px !important;
              flex: 0 0 auto !important;
              box-sizing: border-box !important;
              border: 1px solid transparent !important;
              border-radius: 16px !important;
              background:
                linear-gradient(rgba(242,118,96,.2), rgba(242,118,96,.2)) padding-box,
                linear-gradient(135deg, rgba(255,255,255,.68), rgba(242,118,96,.5)) border-box !important;
              color: #ff9a84 !important;
              box-shadow: 0 8px 24px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.18) !important;
              -webkit-backdrop-filter: blur(38px) saturate(150%) !important;
              backdrop-filter: blur(38px) saturate(150%) !important;
              font: 700 15px/1.2 'Aptos', 'Segoe UI Variable', 'Segoe UI', sans-serif !important;
              cursor: pointer !important;
            }
            #callbridge-end-call[hidden] {
              display: none !important;
            }
          `)};
          document.head.appendChild(style);
        }
        if (!document.getElementById('callbridge-end-call')) {
          var endButton = document.createElement('button');
          endButton.id = 'callbridge-end-call';
          endButton.type = 'button';
          endButton.textContent = 'End call';
          endButton.setAttribute('aria-label', 'End call');
          endButton.hidden = true;
          endButton.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            if (window.cordova_iab && typeof window.cordova_iab.postMessage === 'function') {
              window.cordova_iab.postMessage(JSON.stringify({ callBridgeAction: 'end-call' }));
              return;
            }
            var leaveButton = document.querySelector('#callcontrols-leave-button-session-banner');
            if (leaveButton) leaveButton.click();
          });
          document.body.appendChild(endButton);
        }
        if (!window.__callBridgeEndControlObserver) {
          var updateEndControl = function() {
            var button = document.getElementById('callbridge-end-call');
            if (!button) return;
            var topTray = document.querySelector('.top-tray');
            if (topTray && button.parentElement !== topTray) topTray.appendChild(button);
            var leaveButton = document.querySelector('#callcontrols-leave-button-session-banner');
            var pageText = document.body.innerText || '';
            var waiting = /waiting to be let in/i.test(pageText);
            var ended = /(?:call has ended|you left the call|call ended)/i.test(pageText);
            var active = !!leaveButton && !waiting && !ended;
            if (button.hidden === active) button.hidden = !active;
            if (leaveButton) leaveButton.classList.toggle('callbridge-hide-leave', active);
            if (active && !window.__callBridgeCallActive) {
              console.info('[CallBridge] FaceTime call is active.');
            }
            window.__callBridgeCallActive = active;
          };
          window.__callBridgeEndControlObserver = new MutationObserver(updateEndControl);
          window.__callBridgeEndControlObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });
          updateEndControl();
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
