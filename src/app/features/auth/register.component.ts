import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { Company } from '../../core/models';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <div class="login-page">
      <div class="login-container">
        <div class="brand-header">
          <div class="brand-icon-fallback">
            <mat-icon>schedule</mat-icon>
          </div>
          <h1>{{ company?.name || 'PontoApp' }}</h1>
          <p class="brand-sub">Criar conta</p>
        </div>

        <mat-card class="login-card" *ngIf="company">
          <mat-card-content>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nome completo</mat-label>
              <input matInput [(ngModel)]="displayName">
              <mat-icon matSuffix>person</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>E-mail</mat-label>
              <input matInput type="email" [(ngModel)]="email">
              <mat-icon matSuffix>email</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Senha</mat-label>
              <input matInput [type]="showPass ? 'text' : 'password'" [(ngModel)]="password">
              <button mat-icon-button matSuffix (click)="showPass = !showPass">
                <mat-icon>{{ showPass ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Confirmar senha</mat-label>
              <input matInput [type]="showPass ? 'text' : 'password'" [(ngModel)]="confirmPassword">
            </mat-form-field>

            <p class="error-msg" *ngIf="error">{{ error }}</p>

            <button mat-raised-button color="primary" class="full-width"
                    (click)="register()" [disabled]="loading || !isValid">
              <mat-spinner *ngIf="loading" diameter="18"></mat-spinner>
              {{ loading ? 'Criando conta...' : 'Criar conta' }}
            </button>

            <div class="notice">
              <mat-icon>info</mat-icon>
              Sua conta precisará ser aprovada por um administrador antes do primeiro acesso.
            </div>

            <div class="register-link">
              Já tem conta? <a [routerLink]="['/' + slug + '/login']">Entrar</a>
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
    .brand-icon-fallback { width: 80px; height: 80px; border-radius: 16px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .brand-icon-fallback mat-icon { font-size: 40px; width: 40px; height: 40px; color: white; }
    .brand-header h1 { margin: 0; font-size: 26px; font-weight: 700; }
    .brand-sub { margin: 4px 0 0; opacity: .8; font-size: 14px; }
    .login-card { border-radius: 16px !important; box-shadow: 0 8px 40px rgba(0,0,0,0.3) !important; }
    .full-width { width: 100%; }
    .error-msg { color: #c62828; font-size: 13px; margin: -8px 0 8px; }
    .notice { display: flex; align-items: flex-start; gap: 8px; background: #e8f5e9; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #2e7d32; margin: 8px 0; }
    .notice mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }
    .register-link { text-align: center; font-size: 13px; color: #666; margin-top: 12px; }
    .register-link a { color: #1a237e; font-weight: 500; text-decoration: none; }
    .powered-by { text-align: center; color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 20px; }
  `]
})
export class RegisterComponent implements OnInit {
  private readonly authSvc = inject(AuthService);
  private readonly companySvc = inject(CompanyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  slug = ''; company: Company | null = null;
  displayName = ''; email = ''; password = ''; confirmPassword = '';
  showPass = false; loading = false; error = '';

  get isValid(): boolean {
    return !!this.displayName && !!this.email && this.password.length >= 6 && this.password === this.confirmPassword;
  }

  async ngOnInit(): Promise<void> {
    this.slug = this.route.snapshot.params['slug'];
    this.company = await this.companySvc.getBySlug(this.slug);
  }

  async register(): Promise<void> {
    if (!this.isValid || !this.company?.id) return;
    if (this.password !== this.confirmPassword) { this.error = 'As senhas não coincidem.'; return; }
    this.loading = true; this.error = '';
    try {
      await this.authSvc.registerWithEmail(this.email, this.password, this.displayName, this.company.id, this.slug, this.company.country ?? 'BR');
      this.router.navigate([`/${this.slug}/pending`]);
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Erro ao criar conta.';
    } finally { this.loading = false; }
  }
}
