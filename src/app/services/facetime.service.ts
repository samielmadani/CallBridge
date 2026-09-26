import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';

export interface FaceTimeCallData {
  url: string;
  userName?: string;
  joinedAt?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class FaceTimeService {
  private currentCall = new BehaviorSubject<FaceTimeCallData | null>(null);
  public currentCall$ = this.currentCall.asObservable();

  private callHistory = new BehaviorSubject<FaceTimeCallData[]>([]);
  public callHistory$ = this.callHistory.asObservable();

  private userName = new BehaviorSubject<string>('');
  public userName$ = this.userName.asObservable();

  private autoJoinEnabled = new BehaviorSubject<boolean>(true);
  public autoJoinEnabled$ = this.autoJoinEnabled.asObservable();
  private settingsReady: Promise<void>;

  constructor() {
    this.settingsReady = this.loadUserSettings();
    this.initializeDeepLinking();
  }

  private initializeDeepLinking() {
    App.addListener('appUrlOpen', (event: any) => {
      const url = event.url;
      if (this.isFaceTimeLink(url)) {
        void this.handleFaceTimeLink(url);
      }
    });
  }

  private isFaceTimeLink(url: string): boolean {
    return url.includes('facetime.apple.com') || url.includes('facetime');
  }

  async handleFaceTimeLink(url: string) {
    await this.settingsReady;
    const callData: FaceTimeCallData = {
      url,
      userName: this.userName.value,
      joinedAt: new Date(),
    };

    this.currentCall.next(callData);
    this.addToHistory(callData);

    if (this.autoJoinEnabled.value && this.userName.value) {
      // Auto-join will be triggered by the CallPage component
    }
  }

  openCall(callData: FaceTimeCallData) {
    this.currentCall.next(callData);
  }

  setUserName(name: string) {
    this.userName.next(name);
    void Preferences.set({ key: 'callbridge_username', value: name });
  }

  setAutoJoin(enabled: boolean) {
    this.autoJoinEnabled.next(enabled);
    void Preferences.set({ key: 'callbridge_autojoin', value: String(enabled) });
  }

  private addToHistory(callData: FaceTimeCallData) {
    const history = this.callHistory.value;
    history.unshift(callData);
    if (history.length > 50) {
      history.pop();
    }
    this.callHistory.next([...history]);
    void Preferences.set({ key: 'callbridge_history', value: JSON.stringify(history) });
  }

  private async readPreference(key: string): Promise<string | null> {
    const stored = await Preferences.get({ key });
    if (stored.value !== null) return stored.value;

    const legacyValue = localStorage.getItem(key);
    if (legacyValue !== null) {
      await Preferences.set({ key, value: legacyValue });
      localStorage.removeItem(key);
    }
    return legacyValue;
  }

  private async loadUserSettings() {
    const [savedName, autoJoin, savedHistory] = await Promise.all([
      this.readPreference('callbridge_username'),
      this.readPreference('callbridge_autojoin'),
      this.readPreference('callbridge_history'),
    ]);

    if (savedName !== null) {
      this.userName.next(savedName);
    }

    if (autoJoin !== null) {
      this.autoJoinEnabled.next(autoJoin === 'true');
    }

    if (savedHistory) {
      try {
        this.callHistory.next(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error loading call history', e);
      }
    }
  }

  getCurrentCall(): FaceTimeCallData | null {
    return this.currentCall.value;
  }

  getCallHistory(): FaceTimeCallData[] {
    return this.callHistory.value;
  }

  clearHistory() {
    this.callHistory.next([]);
    void Preferences.remove({ key: 'callbridge_history' });
  }

  endCall() {
    this.currentCall.next(null);
  }
}
