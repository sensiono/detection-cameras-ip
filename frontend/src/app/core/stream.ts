import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';

export interface StreamEvent {
  kind: string;
  result?: any;
  camera_id?: string;
  id?: number;
}

interface PulseResponse {
  revision: number;
  unseen_alerts: number;
  today_presences: number;
  today_accesses: number;
}

@Injectable({ providedIn: 'root' })
export class StreamService {
  private http = inject(HttpClient);
  readonly updates$ = new Subject<StreamEvent>();
  private lastState = '';
  private timer: any = null;

  constructor() {
    this.startAdaptivePulse();
  }

  private startAdaptivePulse(): void {
    // 1. Initial check
    this.checkPulse();

    // 2. Window focus trigger: instantly check when user returns to the tab
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.checkPulse());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkPulse();
        }
      });
    }

    // 3. Relaxed 6-second heartbeat only while active
    this.timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        this.checkPulse();
      }
    }, 6000);
  }

  checkPulse(): void {
    this.http.get<PulseResponse>('/api/events/pulse/').subscribe({
      next: (resp) => {
        const stateKey = `${resp.revision}-${resp.unseen_alerts}-${resp.today_presences}-${resp.today_accesses}`;
        if (this.lastState && this.lastState !== stateKey) {
          this.updates$.next({ kind: 'update' });
        }
        this.lastState = stateKey;
      },
      error: () => {},
    });
  }
}
