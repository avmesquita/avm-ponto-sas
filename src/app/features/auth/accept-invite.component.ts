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
import { InviteService } from '../../core/services/invite.service';
import { Invite } from '../../core/models';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <div class="invite-page">
      <div class="invite-container">
        <div class="brand-header">
          <div class="brand-icon"><mat-icon>mail</mat-icon></div>
          <h1>Convite recebido</h1>
        </div>

        <mat-card class="invite-card">
          <mat-card-content>
            <div *ngIf="loading" class="center"><mat-spinner diameter="40"></mat-spinner></div>

            <div *ngIf="!loading && !invite" class="error-state">
              <mat-icon>error</mat-icon>
              <p>Este convite não é válido ou já expirou.</p>
              <a mat-button [routerLink]="['/' + slug + '/login']">Ir para o login</a>
            </div>

            <div *ngIf="!loading && invite">
              <p class="invite-text">
                Você foi convidado para <strong>{{ invite.companyName }}</strong>.<br>
                Crie sua senha para ativar o acesso.
              </p>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Nome completo</mat-label>
                <input matInput [(ngModel)]="displayName">
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Senha</mat-label>
                <input matInput [type]="showPass ? 'text' : 'password'" [(ngModel)]="password">
                <button mat-icon-button matSuffix (click)="showPass = !showPass">
                  <mat-icon>{{ showPass ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </mat-form-field>
              <p class="error-msg" *ngIf="error">{{ error }}</p>
              <button mat-raised-button color="primary" class="full-width"
                      (click)="accept()" [disabled]="saving || !displayName || password.length < 6">
                {{ saving ? 'Ativando...' : 'Ativar conta' }}
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .invite-page { min-height: 100vh; background: linear-gradient(135deg, #1a237e 0%, #283593 100%); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .invite-container { width: 100%; max-width: 400px; }
    .brand-header { text-align: center; margin-bottom: 24px; color: white; }
    .brand-icon { width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .brand-icon mat-icon { font-size: 40px; width: 40px; height: 40px; color: white; }
    .brand-header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .invite-card { border-radius: 16px !important; box-shadow: 0 8px 40px rgba(0,0,0,0.3) !important; }
    .invite-text { font-size: 14px; color: #555; margin-bottom: 16px; line-height: 1.6; }
    .full-width { width: 100%; }
    .error-msg { color: #c62828; font-size: 13px; }
    .error-state { text-align: center; padding: 16px; color: #c62828; }
    .error-state mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .center { display: flex; justify-content: center; padding: 32px; }
  `]
})
export class AcceptInviteComponent implements OnInit {
  private readonly authSvc = inject(AuthService);
  private readonly inviteSvc = inject(InviteService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  slug = ''; token = ''; invite: Invite | null = null;
  displayName = ''; password = ''; showPass = false;
  loading = true; saving = false; error = '';

  async ngOnInit(): Promise<void> {
    this.slug = this.route.snapshot.params['slug'];
    this.token = this.route.snapshot.params['token'];
    try {
      const inv = await this.inviteSvc.getByToken(this.token);
      this.invite = inv && this.inviteSvc.isValid(inv) ? inv : null;
    } finally { this.loading = false; }
  }

  async accept(): Promise<void> {
    if (!this.invite) return;
    this.saving = true; this.error = '';
    try {
      await this.authSvc.registerWithEmail(
        this.invite.email, this.password, this.displayName,
        this.invite.companyId, this.invite.companySlug
      );
      await this.inviteSvc.accept(this.invite.id!);
      // Usuário convidado já nasce ativo (diferente do auto-registro)
      await this.authSvc.approveUser(this.authSvc.currentUser!.uid);
      this.router.navigate([`/${this.slug}/dashboard`]);
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Erro ao ativar conta.';
    } finally { this.saving = false; }
  }
}
