import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, MatProgressBarModule],
  template: `
    <div *ngIf="loading$ | async" class="global-loading">
      <mat-progress-bar mode="indeterminate" color="primary"></mat-progress-bar>
    </div>
    <router-outlet *ngIf="!(loading$ | async)"></router-outlet>
  `,
  styles: [`
    .global-loading {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 9999;
    }
  `]
})
export class AppComponent {
  private authService = inject(AuthService);
  loading$ = this.authService.loading$;
}
