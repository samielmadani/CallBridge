import { Component, OnInit } from '@angular/core';
import { FaceTimeService } from '../../services/facetime.service';
import { AlertController } from '@ionic/angular';
import {
  EffectOptions,
  VideoEffectsService,
  VideoFilter,
} from '../../services/video-effects.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
  userName: string = '';
  autoJoinEnabled: boolean = true;
  filters: VideoFilter[] = [];
  activeFilter: VideoFilter | null = null;
  filterOptions: EffectOptions = {
    blur: 0,
    brightness: 100,
    contrast: 100,
    saturate: 100,
    hueRotate: 0,
  };

  constructor(
    private faceTimeService: FaceTimeService,
    private videoEffectsService: VideoEffectsService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.faceTimeService.userName$.subscribe((name) => {
      this.userName = name;
    });

    this.faceTimeService.autoJoinEnabled$.subscribe((enabled) => {
      this.autoJoinEnabled = enabled;
    });
    this.filters = this.videoEffectsService.getAvailableFilters();
    this.videoEffectsService.activeFilter$.subscribe((filter) => {
      this.activeFilter = filter;
      this.filters = this.videoEffectsService.getAvailableFilters();
    });
    this.videoEffectsService.effectOptions$.subscribe((options) => {
      this.filterOptions = options;
    });
  }

  onUserNameChange(name: string) {
    this.faceTimeService.setUserName(name);
  }

  toggleAutoJoin(enabled: boolean) {
    this.autoJoinEnabled = enabled;
    this.faceTimeService.setAutoJoin(enabled);
  }

  selectFilter(value: string | number) {
    const name = String(value);
    const filter = this.videoEffectsService
      .getAvailableFilters()
      .find((item) => item.name === name);
    if (filter) this.videoEffectsService.setActiveFilter(filter);
  }

  updateEffect(
    key: keyof EffectOptions,
    value: number | { lower: number; upper: number }
  ) {
    this.videoEffectsService.updateEffect(
      key,
      typeof value === 'number' ? value : value.lower
    );
  }

  resetEffects() {
    this.videoEffectsService.resetEffects();
    this.selectFilter('Normal');
  }

  async clearHistory() {
    const alert = await this.alertController.create({
      header: 'Clear History',
      message: 'Are you sure you want to clear all call history? This cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Clear',
          role: 'destructive',
          handler: () => {
            this.faceTimeService.clearHistory();
          },
        },
      ],
    });
    await alert.present();
  }

}
