import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { FaceTimeService, FaceTimeCallData } from '../../services/facetime.service';
import { VideoEffectsService, VideoFilter } from '../../services/video-effects.service';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-call',
  templateUrl: './call.page.html',
  styleUrls: ['./call.page.scss'],
})
export class CallPage implements OnInit {
  @ViewChild('iframeContainer') iframeContainer!: ElementRef;

  currentCall: FaceTimeCallData | null = null;
  callDuration: number = 0;
  timerInterval: any;
  userName: string = '';
  showControls: boolean = true;
  controlsTimeout: any;
  isAutoJoined: boolean = false;

  filters: VideoFilter[] = [];
  activeFilter: VideoFilter | null = null;
  filterOptions = {
    blur: 0,
    brightness: 100,
    contrast: 100,
    saturate: 100,
    hueRotate: 0,
  };

  showFilterPanel: boolean = false;

  constructor(
    private faceTimeService: FaceTimeService,
    private videoEffectsService: VideoEffectsService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCallData();
    this.loadFilters();
    this.startCallTimer();
    this.loadVideoEffects();
    this.attemptAutoJoin();
  }

  private loadCallData() {
    this.currentCall = this.faceTimeService.getCurrentCall();
    this.faceTimeService.userName$.subscribe((name) => {
      this.userName = name;
    });
  }

  private loadFilters() {
    this.filters = this.videoEffectsService.getAvailableFilters();
    this.videoEffectsService.activeFilter$.subscribe((filter) => {
      this.activeFilter = filter;
    });
  }

  private loadVideoEffects() {
    this.videoEffectsService.effectOptions$.subscribe((options) => {
      this.filterOptions = options;
    });
  }

  private startCallTimer() {
    this.timerInterval = setInterval(() => {
      this.callDuration++;
    }, 1000);
  }

  private attemptAutoJoin() {
    // Simulate auto-join by opening the FaceTime link
    this.faceTimeService.autoJoinEnabled$.subscribe((enabled) => {
      if (enabled && this.currentCall && this.userName) {
        this.isAutoJoined = true;
        this.openFaceTimeLink();
      }
    });
  }

  async openFaceTimeLink() {
    if (this.currentCall?.url) {
      try {
        await Browser.open({ url: this.currentCall.url });
      } catch (error) {
        console.error('Error opening FaceTime link:', error);
      }
    }
  }

  onControlsClick() {
    clearTimeout(this.controlsTimeout);
    this.showControls = true;
    this.controlsTimeout = setTimeout(() => {
      this.showControls = false;
    }, 5000);
  }

  toggleFilterPanel() {
    this.showFilterPanel = !this.showFilterPanel;
  }

  setFilter(filter: VideoFilter) {
    this.videoEffectsService.setActiveFilter(filter);
  }

  updateFilter(key: string, value: any) {
    this.videoEffectsService.updateEffect(
      key as any,
      parseInt(value, 10)
    );
  }

  resetFilters() {
    this.videoEffectsService.resetEffects();
  }

  endCall() {
    clearInterval(this.timerInterval);
    this.faceTimeService.endCall();
    this.router.navigate(['/home']);
  }

  getFormattedTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(secs)}`;
  }

  private pad(num: number): string {
    return String(num).padStart(2, '0');
  }

  ngOnDestroy() {
    clearInterval(this.timerInterval);
    clearTimeout(this.controlsTimeout);
  }
}
