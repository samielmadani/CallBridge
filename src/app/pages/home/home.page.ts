import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FaceTimeService } from '../../services/facetime.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  userName: string = '';
  autoJoinEnabled: boolean = true;
  isOnCall: boolean = false;

  constructor(
    private faceTimeService: FaceTimeService,
    private router: Router
  ) {}

  ngOnInit() {
    this.faceTimeService.userName$.subscribe((name) => {
      this.userName = name;
    });

    this.faceTimeService.autoJoinEnabled$.subscribe((enabled) => {
      this.autoJoinEnabled = enabled;
    });

    this.faceTimeService.currentCall$.subscribe((call) => {
      this.isOnCall = !!call;
      if (call) {
        this.router.navigate(['/call']);
      }
    });
  }

  onUserNameChange(name: string) {
    this.faceTimeService.setUserName(name);
  }

  toggleAutoJoin() {
    this.faceTimeService.setAutoJoin(this.autoJoinEnabled);
  }

  navigateToSettings() {
    this.router.navigate(['/settings']);
  }

  navigateToHistory() {
    this.router.navigate(['/history']);
  }
}
