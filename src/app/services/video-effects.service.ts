import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

export interface VideoFilter {
  name: string;
  cssClass: string;
  enabled: boolean;
}

export interface EffectOptions {
  blur: number;
  brightness: number;
  contrast: number;
  saturate: number;
  hueRotate: number;
}

@Injectable({
  providedIn: 'root',
})
export class VideoEffectsService {
  private effectOptions = new BehaviorSubject<EffectOptions>({
    blur: 0,
    brightness: 100,
    contrast: 100,
    saturate: 100,
    hueRotate: 0,
  });

  public effectOptions$ = this.effectOptions.asObservable();

  private availableFilters: VideoFilter[] = [
    { name: 'Normal', cssClass: 'filter-normal', enabled: true },
    { name: 'Blur', cssClass: 'filter-blur', enabled: false },
    { name: 'Cool', cssClass: 'filter-cool', enabled: false },
    { name: 'Warm', cssClass: 'filter-warm', enabled: false },
    { name: 'Noir', cssClass: 'filter-noir', enabled: false },
    { name: 'Vivid', cssClass: 'filter-vivid', enabled: false },
  ];

  private activeFilter = new BehaviorSubject<VideoFilter>(
    this.availableFilters[0]
  );
  public activeFilter$ = this.activeFilter.asObservable();

  constructor() {
    this.loadSavedSettings();
  }

  getAvailableFilters(): VideoFilter[] {
    return this.availableFilters;
  }

  setActiveFilter(filter: VideoFilter) {
    const updated = this.availableFilters.map((f) => ({
      ...f,
      enabled: f.name === filter.name,
    }));
    this.availableFilters = updated;
    const activeFilter = updated.find((item) => item.name === filter.name)!;
    this.activeFilter.next(activeFilter);

    this.applyFilterEffects(filter.name);
    void Preferences.set({ key: 'callbridge_filter', value: filter.name });
  }

  private applyFilterEffects(filterName: string) {
    const effects: Partial<EffectOptions> = {};

    switch (filterName) {
      case 'Blur':
        effects.blur = 5;
        break;
      case 'Cool':
        effects.hueRotate = 180;
        effects.saturate = 120;
        break;
      case 'Warm':
        effects.hueRotate = 30;
        effects.brightness = 110;
        break;
      case 'Noir':
        effects.contrast = 150;
        effects.saturate = 0;
        effects.brightness = 90;
        break;
      case 'Vivid':
        effects.saturate = 150;
        effects.contrast = 120;
        break;
      default:
        effects.blur = 0;
        effects.brightness = 100;
        effects.contrast = 100;
        effects.saturate = 100;
        effects.hueRotate = 0;
    }

    const currentEffects = this.effectOptions.value;
    this.effectOptions.next({ ...currentEffects, ...effects });
  }

  updateEffect(key: keyof EffectOptions, value: number) {
    const currentEffects = this.effectOptions.value;
    currentEffects[key] = value;
    this.effectOptions.next({ ...currentEffects });
    void Preferences.set({ key: 'callbridge_effects', value: JSON.stringify(currentEffects) });
  }

  resetEffects() {
    this.effectOptions.next({
      blur: 0,
      brightness: 100,
      contrast: 100,
      saturate: 100,
      hueRotate: 0,
    });
    void Preferences.remove({ key: 'callbridge_effects' });
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

  private async loadSavedSettings() {
    const [savedFilter, savedEffects] = await Promise.all([
      this.readPreference('callbridge_filter'),
      this.readPreference('callbridge_effects'),
    ]);
    if (savedFilter) {
      const filter = this.availableFilters.find((f) => f.name === savedFilter);
      if (filter) {
        this.setActiveFilter(filter);
      }
    }

    if (savedEffects) {
      try {
        this.effectOptions.next(JSON.parse(savedEffects));
      } catch (e) {
        console.error('Error loading effects', e);
      }
    }
  }

  getFilterStyle(): string {
    const effects = this.effectOptions.value;
    return `
      filter: blur(${effects.blur}px) 
              brightness(${effects.brightness}%) 
              contrast(${effects.contrast}%) 
              saturate(${effects.saturate}%) 
              hue-rotate(${effects.hueRotate}deg);
    `;
  }
}
