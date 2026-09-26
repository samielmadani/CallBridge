import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class TabsPage {
  private swipeStart: { x: number; y: number } | null = null;
  private readonly pages = ['/tabs/call', '/tabs/history', '/tabs/settings'];

  constructor(private router: Router) {}

  recordSwipeStart(event: TouchEvent) {
    const touch = event.changedTouches[0];
    this.swipeStart = { x: touch.clientX, y: touch.clientY };
  }

  completeSwipe(event: TouchEvent) {
    if (!this.swipeStart) return;

    const touch = event.changedTouches[0];
    const horizontalDistance = touch.clientX - this.swipeStart.x;
    const verticalDistance = touch.clientY - this.swipeStart.y;
    this.swipeStart = null;

    if (
      Math.abs(horizontalDistance) < 70 ||
      Math.abs(horizontalDistance) < Math.abs(verticalDistance) * 1.3
    ) {
      return;
    }

    const currentPage = this.pages.findIndex((path) =>
      this.router.url.startsWith(path)
    );
    const nextPage = currentPage + (horizontalDistance < 0 ? 1 : -1);
    if (nextPage >= 0 && nextPage < this.pages.length) {
      void this.router.navigateByUrl(this.pages[nextPage]);
    }
  }
}