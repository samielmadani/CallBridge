import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FaceTimeService, FaceTimeCallData } from '../../services/facetime.service';

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage implements OnInit {
  callHistory: FaceTimeCallData[] = [];

  constructor(
    private faceTimeService: FaceTimeService,
    private router: Router
  ) {}

  ngOnInit() {
    this.faceTimeService.callHistory$.subscribe((history) => {
      this.callHistory = history;
    });
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Unknown';
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (d.toDateString() === yesterday.toDateString()) {
      return (
        'Yesterday ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      );
    } else {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  }

  extractCallId(url: string): string {
    const match = url.match(/[\w-]{20,}/);
    return match ? match[0].substring(0, 10) + '...' : 'Call';
  }

  openCall(call: FaceTimeCallData) {
    // In a real app, you'd navigate to the call with this URL
    this.router.navigate(['/call'], { state: { callData: call } });
  }
}
