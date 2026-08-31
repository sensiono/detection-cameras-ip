import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('light');

  constructor() {
    const saved = localStorage.getItem('vision_theme') as ThemeMode | null;
    const initial = saved === 'dark' ? 'dark' : 'light';
    this.setTheme(initial);
  }

  toggle(): void {
    const next = this.mode() === 'light' ? 'dark' : 'light';
    this.setTheme(next);
  }

  setTheme(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem('vision_theme', mode);
    if (mode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
}
