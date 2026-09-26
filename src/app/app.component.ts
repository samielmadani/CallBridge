import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FaceTimeService } from './services/facetime.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  private callSubscription = new Subscription();

  constructor(
    private router: Router,
    private faceTimeService: FaceTimeService
  ) {}

  ngOnInit() {
    this.callSubscription = this.faceTimeService.currentCall$.subscribe((call) => {
      if (call) void this.router.navigateByUrl('/tabs/call');
    });
  }

  ngOnDestroy() {
    this.callSubscription.unsubscribe();
  }
}
