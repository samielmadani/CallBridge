import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs/call',
    pathMatch: 'full',
  },
  {
    path: 'home',
    redirectTo: 'tabs/call',
    pathMatch: 'full',
  },
  {
    path: 'call',
    redirectTo: 'tabs/call',
    pathMatch: 'full',
  },
  {
    path: 'settings',
    redirectTo: 'tabs/settings',
    pathMatch: 'full',
  },
  {
    path: 'history',
    redirectTo: 'tabs/history',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
    loadChildren: () =>
      import('./pages/tabs/tabs.module').then((m) => m.TabsPageModule),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
