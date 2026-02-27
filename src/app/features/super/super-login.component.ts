import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';

@Component({
  selector: 'app-super-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <div class="login-page">
      <div class="login-container">
        <div class="brand-header">
          <div class="brand-icon"><mat-icon>admin_panel_settings</mat-icon></div>
          <h1>PontoApp</h1>
          <p class="brand-sub">Painel SuperAdmin</p>
        </div>
        <mat-card class="login-card">
          <mat-card-content>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>E-mail</mat-label>
              <input matInput type="email" [(ngModel)]="email" (keyup.enter)="login()">
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Senha</mat-label>
              <input matInput [type]="showPass ? 'text' : 'password'" [(ngModel)]="password" (keyup.enter)="login()">
              <button mat-icon-button matSuffix (click)="showPass = !showPass">
                <mat-icon>{{ showPass ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>
            <p class="error-msg" *ngIf="error">{{ error }}</p>
            <button mat-raised-button color="primary" class="full-width"
                    (click)="login()" [disabled]="loading || !email || !password">
              <mat-spinner *ngIf="loading" diameter="18"></mat-spinner>
              {{ loading ? 'Entrando...' : 'Entrar' }}
            </button>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .login-page { min-height: 100vh; background: linear-gradient(135deg, #212121 0%, #424242 100%); display: flex; align-items: center; justify-content: center; }
    .login-container { width: 100%; max-width: 380px; padding: 16px; }
    .brand-header { text-align: center; margin-bottom: 24px; color: white; }
    .brand-icon { width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .brand-icon mat-icon { font-size: 36px; width: 36px; height: 36px; color: #ffb74d; }
    h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .brand-sub { margin: 4px 0 0; opacity: .6; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
    .login-card { border-radius: 16px !important; }
    .full-width { width: 100%; }
    .error-msg { color: #c62828; font-size: 13px; margin: -8px 0 8px; }
  `]
})
export class SuperLoginComponent {
  private readonly authSvc = inject(AuthService);
  private readonly router = inject(Router);
  email = ''; password = ''; showPass = false; loading = false; error = '';

  async login(): Promise<void> {
    this.loading = true; this.error = '';
    try {
      const user = await this.authSvc.loginWithEmail(this.email, this.password);
      if (user.role !== UserRole.SUPER_ADMIN) {
        await this.authSvc.logout();
        this.error = 'Acesso restrito a SuperAdmins.';
        return;
      }
      this.router.navigate(['/super']);
    } catch { this.error = 'Credenciais inválidas.'; }
    finally { this.loading = false; }
  }
}
