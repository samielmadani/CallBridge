import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FaceTimeService } from '../../services/facetime.service';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
  userName: string = '';
  autoJoinEnabled: boolean = true;
  version: string = '1.0.0';

  constructor(
    private faceTimeService: FaceTimeService,
    private router: Router,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.faceTimeService.userName$.subscribe((name) => {
      this.userName = name;
    });

    this.faceTimeService.autoJoinEnabled$.subscribe((enabled) => {
      this.autoJoinEnabled = enabled;
    });
  }

  onUserNameChange(name: string) {
    this.faceTimeService.setUserName(name);
  }

  toggleAutoJoin(enabled: boolean) {
    this.autoJoinEnabled = enabled;
    this.faceTimeService.setAutoJoin(enabled);
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

  goBack() {
    this.router.navigate(['/home']);
  }
}
