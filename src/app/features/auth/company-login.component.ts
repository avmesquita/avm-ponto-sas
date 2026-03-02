import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { Company, UserStatus } from '../../core/models';

@Component({
  selector: 'app-company-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatDividerModule, MatProgressSpinnerModule],
  template: `
    <div class="login-page">
      <div class="login-container">

        <!-- Logo / header da empresa -->
        <div class="brand-header">
          <img *ngIf="company?.logoURL" [src]="company!.logoURL" class="company-logo" alt="Logo">
          <div class="brand-icon-fallback" *ngIf="!company?.logoURL">
            <mat-icon>schedule</mat-icon>
          </div>
          <h1>{{ company?.name || 'PontoApp' }}</h1>
          <p class="brand-sub" *ngIf="company">Controle de Ponto</p>
          <p class="brand-sub error" *ngIf="!loading && !company">Empresa não encontrada</p>
        </div>

        <mat-card *ngIf="company" class="login-card">
          <mat-card-content>

            <!-- Login com Google -->
            <button mat-raised-button class="google-btn" (click)="loginGoogle()" [disabled]="loading">
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" width="18" height="18">
              Entrar com Google
            </button>

            <mat-divider class="divider"><span>ou</span></mat-divider>

            <!-- Login com email/senha -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>E-mail</mat-label>
              <input matInput type="email" [(ngModel)]="email" (keyup.enter)="loginEmail()">
              <mat-icon matSuffix>email</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Senha</mat-label>
              <input matInput [type]="showPass ? 'text' : 'password'" [(ngModel)]="password" (keyup.enter)="loginEmail()">
              <button mat-icon-button matSuffix (click)="showPass = !showPass">
                <mat-icon>{{ showPass ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>

            <p class="error-msg" *ngIf="error">{{ error }}</p>

            <button mat-raised-button color="primary" class="full-width"
                    (click)="loginEmail()" [disabled]="loading || !email || !password">
              <mat-spinner *ngIf="loading" diameter="18"></mat-spinner>
              {{ loading ? 'Entrando...' : 'Entrar' }}
            </button>

            <div class="register-link">
              Não tem conta?
              <a [routerLink]="['/' + slug + '/register']">Criar conta</a>
            </div>
          </mat-card-content>
        </mat-card>

        <div class="powered-by">Powered by PontoApp</div>
      </div>
    </div>
  `,
  styles: [`
    .login-page { min-height: 100vh; background: linear-gradient(135deg, #1a237e 0%, #283593 100%); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .login-container { width: 100%; max-width: 400px; }
    .brand-header { text-align: center; margin-bottom: 24px; color: white; }
    .company-logo { width: 80px; height: 80px; border-radius: 16px; object-fit: cover; margin-bottom: 12px; }
    .brand-icon-fallback { width: 80px; height: 80px; border-radius: 16px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .brand-icon-fallback mat-icon { font-size: 40px; width: 40px; height: 40px; color: white; }
    .brand-header h1 { margin: 0; font-size: 26px; font-weight: 700; }
    .brand-sub { margin: 4px 0 0; opacity: .8; font-size: 14px; }
    .brand-sub.error { color: #ffab91; }
    .login-card { border-radius: 16px !important; box-shadow: 0 8px 40px rgba(0,0,0,0.3) !important; }
    .google-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: white !important; color: #333 !important; font-weight: 500; height: 44px; }
    .divider { margin: 20px 0 !important; }
    .divider span { font-size: 12px; color: #999; padding: 0 8px; background: white; }
    ::ng-deep .mat-divider { border-color: #e0e0e0 !important; }
    .full-width { width: 100%; }
    .error-msg { color: #c62828; font-size: 13px; margin: -8px 0 8px; }
    .register-link { text-align: center; font-size: 13px; color: #666; margin-top: 16px; }
    .register-link a { color: #1a237e; font-weight: 500; text-decoration: none; }
    .powered-by { text-align: center; color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 20px; }
  `]
})
export class CompanyLoginComponent implements OnInit {
  private readonly authSvc = inject(AuthService);
  private readonly companySvc = inject(CompanyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  slug = '';
  company: Company | null = null;
  email = ''; password = ''; showPass = false;
  loading = false; error = '';

  async ngOnInit(): Promise<void> {
    this.slug = this.route.snapshot.params['slug'];
    this.loading = true;
    try {
      this.company = await this.companySvc.getBySlug(this.slug);
    } finally { this.loading = false; }
  }

  async loginGoogle(): Promise<void> {
    if (!this.company?.id) return;
    this.loading = true; this.error = '';
    try {
      const user = await this.authSvc.loginWithGoogle(this.company.id, this.slug, this.company.country ?? 'BR');
      this.navigateAfterLogin(user.status);
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Erro ao entrar com Google.';
    } finally { this.loading = false; }
  }

  async loginEmail(): Promise<void> {
    if (!this.email || !this.password) return;
    this.loading = true; this.error = '';
    try {
      const user = await this.authSvc.loginWithEmail(this.email, this.password);
      this.navigateAfterLogin(user.status);
    } catch (e: unknown) {
      this.error = 'E-mail ou senha incorretos.';
    } finally { this.loading = false; }
  }

  private navigateAfterLogin(status: string): void {
    if (status === UserStatus.PENDING) {
      this.router.navigate([`/${this.slug}/pending`]);
    } else {
      this.router.navigate([`/${this.slug}/dashboard`]);
    }
  }
}
