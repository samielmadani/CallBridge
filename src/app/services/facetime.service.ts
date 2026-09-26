import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { App } from '@capacitor/app';

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

  constructor() {
    this.initializeDeepLinking();
    this.loadUserSettings();
  }

  private initializeDeepLinking() {
    App.addListener('appUrlOpen', (event: any) => {
      const url = event.url;
      if (this.isFaceTimeLink(url)) {
        this.handleFaceTimeLink(url);
      }
    });
  }

  private isFaceTimeLink(url: string): boolean {
    return url.includes('facetime.apple.com') || url.includes('facetime');
  }

  handleFaceTimeLink(url: string) {
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

  setUserName(name: string) {
    this.userName.next(name);
    localStorage.setItem('callbridge_username', name);
  }

  setAutoJoin(enabled: boolean) {
    this.autoJoinEnabled.next(enabled);
    localStorage.setItem('callbridge_autojoin', String(enabled));
  }

  private addToHistory(callData: FaceTimeCallData) {
    const history = this.callHistory.value;
    history.unshift(callData);
    if (history.length > 50) {
      history.pop();
    }
    this.callHistory.next([...history]);
    localStorage.setItem('callbridge_history', JSON.stringify(history));
  }

  private loadUserSettings() {
    const savedName = localStorage.getItem('callbridge_username');
    if (savedName) {
      this.userName.next(savedName);
    }

    const autoJoin = localStorage.getItem('callbridge_autojoin');
    if (autoJoin !== null) {
      this.autoJoinEnabled.next(autoJoin === 'true');
    }

    const history = localStorage.getItem('callbridge_history');
    if (history) {
      try {
        this.callHistory.next(JSON.parse(history));
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
    localStorage.removeItem('callbridge_history');
  }

  endCall() {
    this.currentCall.next(null);
  }
}
