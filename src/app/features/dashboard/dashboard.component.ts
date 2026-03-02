import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ShellComponent } from '../../shared/components/shell.component';
import { AuthService } from '../../core/services/auth.service';
import { TimesheetService } from '../../core/services/timesheet.service';
import { HolidayService } from '../../core/services/holiday.service';
import { AbsenceService } from '../../core/services/absence.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppUser, DailySummary, Holiday } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ShellComponent,
    MatCardModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <app-shell>
      <div class="dashboard" *ngIf="user">
        <div class="greeting-section">
          <div>
            <h2>{{ getGreeting() }}, {{ user.displayName.split(' ')[0] }}! 👋</h2>
            <p class="today-date">{{ getTodayFormatted() }}</p>
          </div>
          <button mat-raised-button color="primary" class="punch-btn"
                  [disabled]="punching" (click)="punch()">
            <mat-icon>fingerprint</mat-icon>
            {{ punching ? 'Registrando...' : 'Bater Ponto' }}
          </button>
        </div>

        <div class="stats-grid">
          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon-wrap blue"><mat-icon>timer</mat-icon></div>
              <div class="stat-info">
                <span class="stat-label">Trabalhado Hoje</span>
                <span class="stat-value">{{ formatMinutes(todaySummary?.workedMinutes ?? 0) }}</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon-wrap"
                   [class.green]="(todaySummary?.balanceMinutes ?? 0) >= 0"
                   [class.red]="(todaySummary?.balanceMinutes ?? 0) < 0">
                <mat-icon>{{ (todaySummary?.balanceMinutes ?? 0) >= 0 ? 'trending_up' : 'trending_down' }}</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-label">Saldo do Dia</span>
                <span class="stat-value"
                      [class.pos]="(todaySummary?.balanceMinutes ?? 0) >= 0"
                      [class.neg]="(todaySummary?.balanceMinutes ?? 0) < 0">
                  {{ timesheetSvc.formatMinutes(todaySummary?.balanceMinutes ?? 0) }}
                </span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon-wrap purple"><mat-icon>touch_app</mat-icon></div>
              <div class="stat-info">
                <span class="stat-label">Batidas Hoje</span>
                <span class="stat-value">{{ todaySummary?.entries?.length ?? 0 }}</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon-wrap"
                   [class.orange]="(todaySummary?.inconsistencies?.length ?? 0) > 0"
                   [class.grey]="(todaySummary?.inconsistencies?.length ?? 0) === 0">
                <mat-icon>warning</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-label">Inconsistências</span>
                <span class="stat-value">{{ todaySummary?.inconsistencies?.length ?? 0 }}</span>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <mat-card class="timeline-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>today</mat-icon>
            <mat-card-title>Batidas de Hoje</mat-card-title>
            <mat-card-subtitle>{{ formatDate(today) }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-progress-bar *ngIf="loadingToday" mode="indeterminate"></mat-progress-bar>
            <div *ngIf="!loadingToday">
              <div *ngIf="(todaySummary?.entries?.length ?? 0) === 0" class="empty-state">
                <mat-icon>fingerprint</mat-icon>
                <p>Nenhuma batida registrada hoje.</p>
                <button mat-stroked-button color="primary" (click)="punch()">Registrar Entrada</button>
              </div>
              <div *ngIf="(todaySummary?.entries?.length ?? 0) > 0" class="timeline">
                <div class="timeline-item" *ngFor="let entry of todaySummary?.entries">
                  <div class="timeline-dot" [class.entry-dot]="entry.type === 'entry'" [class.exit-dot]="entry.type === 'exit'">
                    <mat-icon>{{ entry.type === 'entry' ? 'login' : 'logout' }}</mat-icon>
                  </div>
                  <div class="timeline-content">
                    <span class="punch-type">{{ entry.type === 'entry' ? 'Entrada' : 'Saída' }}</span>
                    <span class="punch-time">{{ formatTime(entry.timestamp) }}</span>
                    <span class="punch-note" *ngIf="entry.note">{{ entry.note }}</span>
                  </div>
                </div>
              </div>
              <div *ngIf="(todaySummary?.inconsistencies?.length ?? 0) > 0" class="inconsistency-alert">
                <mat-icon>warning</mat-icon>
                <div>
                  <strong>Inconsistências detectadas:</strong>
                  <p *ngFor="let inc of todaySummary?.inconsistencies">{{ inc.description }}</p>
                </div>
              </div>
            </div>
          </mat-card-content>
          <mat-card-actions>
            <button mat-button color="primary" routerLink="/timesheet">Ver Histórico</button>
            <button mat-button color="accent" routerLink="/reports">Relatórios</button>
          </mat-card-actions>
        </mat-card>

        <mat-card class="progress-card" *ngIf="!todaySummary?.isWeekend && !todaySummary?.isHoliday">
          <mat-card-content>
            <div class="progress-header">
              <span>Progresso do dia ({{ user.workHoursPerDay }}h esperadas)</span>
              <span>{{ progressPercent.toFixed(0) }}%</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="progressPercent"
              [color]="progressPercent >= 100 ? 'accent' : 'primary'">
            </mat-progress-bar>
          </mat-card-content>
        </mat-card>

        <mat-card class="holiday-card" *ngIf="todaySummary?.isHoliday || todaySummary?.isWeekend">
          <mat-card-content class="holiday-content">
            <mat-icon>{{ todaySummary?.isHoliday ? 'celebration' : 'weekend' }}</mat-icon>
            <span>{{ todaySummary?.isHoliday ? 'Hoje é feriado! Bom descanso.' : 'É fim de semana! Aproveite.' }}</span>
          </mat-card-content>
        </mat-card>
      </div>
    </app-shell>
  `,
  styles: [`
    .dashboard { max-width: 1000px; }
    .greeting-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .greeting-section h2 { margin: 0; font-size: 24px; font-weight: 700; color: #1a237e; }
    .today-date { margin: 4px 0 0; color: #666; font-size: 14px; }
    .punch-btn { height: 48px; font-size: 16px; padding: 0 24px; }
    .punch-btn mat-icon { margin-right: 8px; }

    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card mat-card-content { display: flex; align-items: center; gap: 16px; padding: 20px !important; }
    .stat-icon-wrap { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .stat-icon-wrap mat-icon { color: white; font-size: 26px; width: 26px; height: 26px; }
    .blue   { background: linear-gradient(135deg, #1565c0, #1976d2); }
    .green  { background: linear-gradient(135deg, #2e7d32, #388e3c); }
    .red    { background: linear-gradient(135deg, #c62828, #d32f2f); }
    .purple { background: linear-gradient(135deg, #6a1b9a, #7b1fa2); }
    .orange { background: linear-gradient(135deg, #e65100, #f57c00); }
    .grey   { background: linear-gradient(135deg, #546e7a, #607d8b); }
    .stat-info { display: flex; flex-direction: column; }
    .stat-label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .stat-value { font-size: 22px; font-weight: 700; color: #1a237e; }
    .pos { color: #2e7d32 !important; }
    .neg { color: #c62828 !important; }

    .timeline-card, .progress-card, .holiday-card { margin-bottom: 24px; }
    .empty-state { text-align: center; padding: 32px; color: #999; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; }

    .timeline { padding: 16px 0; }
    .timeline-item { display: flex; align-items: center; gap: 16px; padding: 8px 0; }
    .timeline-item + .timeline-item { border-top: 1px solid #f0f0f0; }
    .timeline-dot { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .entry-dot { background: #e8f5e9; }
    .entry-dot mat-icon { color: #2e7d32; }
    .exit-dot { background: #fff3e0; }
    .exit-dot mat-icon { color: #e65100; }
    .timeline-content { display: flex; align-items: center; gap: 12px; flex: 1; }
    .punch-type { font-weight: 500; color: #333; min-width: 60px; }
    .punch-time { font-size: 18px; font-weight: 700; color: #1a237e; font-family: monospace; }
    .punch-note { color: #888; font-size: 13px; font-style: italic; }

    .inconsistency-alert { display: flex; gap: 12px; align-items: flex-start; background: #fff3e0; border-left: 4px solid #f57c00; border-radius: 0 8px 8px 0; padding: 12px 16px; margin-top: 16px; }
    .inconsistency-alert mat-icon { color: #f57c00; }
    .inconsistency-alert p { margin: 4px 0 0; font-size: 13px; color: #555; }

    .progress-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #555; }

    .holiday-content { display: flex; align-items: center; gap: 12px; background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 8px; padding: 16px !important; }
    .holiday-content mat-icon { color: #2e7d32; font-size: 28px; width: 28px; height: 28px; }

    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .greeting-section { flex-direction: column; align-items: flex-start; gap: 12px; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly authSvc: AuthService = inject(AuthService);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  slug = '';
  private readonly absenceSvc: AbsenceService = inject(AbsenceService);
  private readonly notifSvc: NotificationService = inject(NotificationService);
  readonly timesheetSvc: TimesheetService = inject(TimesheetService);
  private readonly holidaySvc: HolidayService = inject(HolidayService);
  private readonly snackBar: MatSnackBar = inject(MatSnackBar);

  user: AppUser | null = null;
  todaySummary: DailySummary | null = null;
  today = '';
  loadingToday = true;
  punching = false;

  get progressPercent(): number {
    if (!this.todaySummary || !this.user) return 0;
    const expected = this.user.workHoursPerDay * 60;
    if (expected === 0) return 0;
    return Math.min(100, (this.todaySummary.workedMinutes / expected) * 100);
  }

  async ngOnInit(): Promise<void> {
    this.slug = this.route.snapshot.params['slug'] ?? '';
    this.user = this.authSvc.currentUser;
    this.today = this.timesheetSvc.getTodayString();
    await this.loadTodaySummary();
    // Verifica inconsistências de ontem ao carregar o app
    if (this.user) {
      this.notifSvc.checkYesterdayInconsistencies(this.user);
    }
  }

  async loadTodaySummary(): Promise<void> {
    if (!this.user) return;
    this.loadingToday = true;
    try {
      const [holidays, absences] = await Promise.all([
        this.holidaySvc.getHolidays(this.user?.companyId ?? '', this.user?.companyCountry ?? 'BR'),
        this.absenceSvc.getApprovedAbsencesForPeriod(this.user.uid, this.today, this.today),
      ]);
      this.todaySummary = await this.timesheetSvc.getDailySummary(this.user, this.today, holidays, absences);
    } finally {
      this.loadingToday = false;
    }
  }

  async punch(): Promise<void> {
    if (!this.user) return;
    this.punching = true;
    try {
      const entry = await this.timesheetSvc.punch(this.user);
      const label = entry.type === 'entry' ? 'Entrada' : 'Saída';
      this.snackBar.open(`✅ ${label} registrada às ${this.formatTime(entry.timestamp)}`, 'OK', { duration: 4000 });
      await this.loadTodaySummary();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      this.snackBar.open('Erro ao registrar ponto: ' + msg, 'Fechar', { duration: 5000 });
    } finally {
      this.punching = false;
    }
  }

  getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  getTodayFormatted(): string {
    const d = new Date();
    const days = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  }

  formatMinutes(minutes: number): string {
    return this.timesheetSvc.formatMinutesSimple(minutes);
  }
}
