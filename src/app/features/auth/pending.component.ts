import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-pending',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="pending-page">
      <mat-card class="pending-card">
        <mat-card-content>
          <mat-icon class="pending-icon">hourglass_empty</mat-icon>
          <h2>Aguardando aprovação</h2>
          <p>Sua conta foi criada com sucesso! Um administrador precisa aprovar seu acesso antes que você possa entrar no sistema.</p>
          <p class="hint">Você receberá acesso assim que for aprovado. Se precisar de urgência, entre em contato com o administrador da sua empresa.</p>
          <button mat-raised-button color="primary" (click)="logout()">Sair</button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .pending-page { min-height: 100vh; background: linear-gradient(135deg, #1a237e 0%, #283593 100%); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .pending-card { max-width: 420px; border-radius: 16px !important; text-align: center; padding: 32px 24px; }
    .pending-icon { font-size: 64px; width: 64px; height: 64px; color: #f9a825; margin-bottom: 16px; }
    h2 { margin: 0 0 12px; color: #1a237e; }
    p { color: #555; line-height: 1.6; margin-bottom: 12px; }
    .hint { font-size: 13px; color: #999; }
  `]
})
export class PendingComponent {
  private readonly authSvc = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  async logout(): Promise<void> { await this.authSvc.logout(); }
}
