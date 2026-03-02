import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ShellComponent } from '../../shared/components/shell.component';
import { AuthService } from '../../core/services/auth.service';
import { TimesheetService } from '../../core/services/timesheet.service';
import { HolidayService } from '../../core/services/holiday.service';
import { UserService } from '../../core/services/user.service';
import { AbsenceService } from '../../core/services/absence.service';
import { DailySummary, Holiday, AppUser, Inconsistency, Absence } from '../../core/models';
import { getDaysInMonth, formatDateToString } from '../../shared/utils/date.utils';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ShellComponent,
    MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatSelectModule, MatFormFieldModule,
    MatProgressBarModule, MatChipsModule, MatTooltipModule,
  ],
  template: `
    <app-shell>
      <div class="reports-page">
        <div class="page-header">
          <div>
            <h2>Relatórios de Ponto</h2>
            <p class="subtitle">Análise mensal de horas e inconsistências</p>
          </div>
        </div>

        <mat-card class="filters-card">
          <mat-card-content class="filters">
            <mat-form-field appearance="outline" *ngIf="isAdmin">
              <mat-label>Usuário</mat-label>
              <mat-select [(ngModel)]="selectedUserId" (ngModelChange)="loadReport()">
                <mat-option value="mine">Meu relatório</mat-option>
                <mat-option *ngFor="let u of allUsers" [value]="u.uid">{{ u.displayName }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Mês</mat-label>
              <mat-select [(ngModel)]="selectedMonth" (ngModelChange)="loadReport()">
                <mat-option *ngFor="let m of months; let i = index" [value]="i">{{ m }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Ano</mat-label>
              <mat-select [(ngModel)]="selectedYear" (ngModelChange)="loadReport()">
                <mat-option *ngFor="let y of years" [value]="y">{{ y }}</mat-option>
              </mat-select>
            </mat-form-field>
          </mat-card-content>
        </mat-card>

        <mat-progress-bar *ngIf="loading" mode="indeterminate" style="margin-bottom:16px"></mat-progress-bar>

        <div class="summary-grid" *ngIf="!loading && summaries.length > 0">
          <mat-card class="sum-card">
            <mat-card-content>
              <mat-icon class="sum-icon blue-icon">work_history</mat-icon>
              <div><p class="sum-label">Total Trabalhado</p><p class="sum-val">{{ formatMins(totalWorked) }}</p></div>
            </mat-card-content>
          </mat-card>
          <mat-card class="sum-card">
            <mat-card-content>
              <mat-icon class="sum-icon grey-icon">schedule</mat-icon>
              <div><p class="sum-label">Total Esperado</p><p class="sum-val">{{ formatMins(totalExpected) }}</p></div>
            </mat-card-content>
          </mat-card>
          <mat-card class="sum-card" [class.positive]="totalBalance >= 0" [class.negative]="totalBalance < 0">
            <mat-card-content>
              <mat-icon class="sum-icon">{{ totalBalance >= 0 ? 'trending_up' : 'trending_down' }}</mat-icon>
              <div><p class="sum-label">Banco de Horas</p><p class="sum-val">{{ timesheetSvc.formatMinutes(totalBalance) }}</p></div>
            </mat-card-content>
          </mat-card>
          <mat-card class="sum-card" [class.warn]="totalInconsistencies > 0">
            <mat-card-content>
              <mat-icon class="sum-icon">{{ totalInconsistencies > 0 ? 'warning' : 'check_circle' }}</mat-icon>
              <div><p class="sum-label">Inconsistências</p><p class="sum-val">{{ totalInconsistencies }}</p></div>
            </mat-card-content>
          </mat-card>
        </div>

        <mat-card *ngIf="!loading && allInconsistencies.length > 0" class="inconsistencies-card">
          <mat-card-header>
            <mat-icon mat-card-avatar color="warn">warning</mat-icon>
            <mat-card-title>Inconsistências do Mês</mat-card-title>
            <mat-card-subtitle>{{ allInconsistencies.length }} ocorrência(s)</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div *ngFor="let inc of allInconsistencies" class="inc-item">
              <div class="inc-date">{{ formatDate(inc.date) }}</div>
              <div [class]="getIncClass(inc.type)">{{ getIncLabel(inc.type) }}</div>
              <div class="inc-desc">{{ inc.description }}</div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card *ngIf="!loading && summaries.length > 0">
          <mat-card-header><mat-card-title>Detalhamento Diário</mat-card-title></mat-card-header>
          <mat-card-content>
            <table mat-table [dataSource]="workingDays" class="detail-table">
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Data</th>
                <td mat-cell *matCellDef="let d">
                  {{ formatDate(d.date) }}
                  <mat-chip *ngIf="d.isHoliday" class="holiday-chip">Feriado</mat-chip>
                </td>
              </ng-container>
              <ng-container matColumnDef="entries">
                <th mat-header-cell *matHeaderCellDef>Batidas</th>
                <td mat-cell *matCellDef="let d">
                  <span *ngFor="let e of d.entries" class="entry-tag" [class.entry-in]="e.type==='entry'" [class.entry-out]="e.type==='exit'">
                    {{ formatTime(e.timestamp) }}
                  </span>
                  <span *ngIf="d.entries.length === 0" class="no-entries">—</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="worked">
                <th mat-header-cell *matHeaderCellDef>Trabalhado</th>
                <td mat-cell *matCellDef="let d">{{ d.workedMinutes > 0 ? timesheetSvc.formatMinutesSimple(d.workedMinutes) : '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="expected">
                <th mat-header-cell *matHeaderCellDef>Esperado</th>
                <td mat-cell *matCellDef="let d">{{ d.expectedMinutes > 0 ? timesheetSvc.formatMinutesSimple(d.expectedMinutes) : '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="balance">
                <th mat-header-cell *matHeaderCellDef>Saldo</th>
                <td mat-cell *matCellDef="let d"
                    [class.pos]="d.balanceMinutes > 0" [class.neg]="d.balanceMinutes < 0">
                  {{ d.expectedMinutes > 0 ? timesheetSvc.formatMinutes(d.balanceMinutes) : '—' }}
                </td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let d">
                  <mat-icon *ngIf="d.inconsistencies.length > 0" class="warn-icon"
                            [matTooltip]="d.inconsistencies[0].description">warning</mat-icon>
                  <mat-icon *ngIf="d.inconsistencies.length === 0 && d.workedMinutes > 0" class="ok-icon">check_circle</mat-icon>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="tableColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: tableColumns;" [class.row-issue]="row.inconsistencies.length > 0"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      </div>
    </app-shell>
  `,
  styles: [`
    .reports-page { max-width: 1100px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h2 { margin: 0; font-size: 22px; font-weight: 700; color: #1a237e; }
    .subtitle { margin: 4px 0 0; color: #666; font-size: 14px; }
    .filters-card { margin-bottom: 24px; }
    .filters { display: flex; gap: 16px; flex-wrap: wrap; padding-top: 4px !important; }
    .filters mat-form-field { min-width: 160px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 24px; }
    .sum-card mat-card-content { display: flex; align-items: center; gap: 16px; padding: 20px !important; }
    .sum-icon { font-size: 32px; width: 32px; height: 32px; }
    .blue-icon { color: #1565c0; }
    .grey-icon { color: #607d8b; }
    .sum-card.positive .sum-icon { color: #2e7d32; }
    .sum-card.negative .sum-icon { color: #c62828; }
    .sum-card.warn .sum-icon { color: #f57c00; }
    .sum-label { margin: 0; font-size: 12px; color: #999; text-transform: uppercase; }
    .sum-val { margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #333; }
    .sum-card.positive .sum-val { color: #2e7d32; }
    .sum-card.negative .sum-val { color: #c62828; }
    .sum-card.warn .sum-val { color: #f57c00; }
    .inconsistencies-card { margin-bottom: 24px; }
    .inc-item { display: flex; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .inc-date { min-width: 80px; font-size: 13px; color: #555; font-weight: 500; }
    .inc-badge { border-radius: 12px; padding: 2px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; white-space: nowrap; }
    .badge-odd { background: #fce4ec; color: #c62828; }
    .badge-exit { background: #fff3e0; color: #e65100; }
    .badge-excessive { background: #f3e5f5; color: #7b1fa2; }
    .badge-interval { background: #e0f2f1; color: #00695c; }
    .badge-default { background: #e8eaf6; color: #3949ab; }
    .inc-desc { font-size: 13px; color: #555; flex: 1; }
    .detail-table { width: 100%; }
    .entry-tag { display: inline-block; border-radius: 4px; padding: 1px 6px; margin: 1px; font-size: 12px; font-weight: 500; font-family: monospace; }
    .entry-in { background: #e8f5e9; color: #2e7d32; }
    .entry-out { background: #fff3e0; color: #e65100; }
    .no-entries { color: #ccc; }
    .pos { color: #2e7d32; font-weight: 600; }
    .neg { color: #c62828; font-weight: 600; }
    .holiday-chip { font-size: 10px; height: 18px; background: #fff8e1; color: #f9a825; margin-left: 6px; }
    .warn-icon { color: #f57c00; font-size: 18px; width: 18px; height: 18px; }
    .ok-icon { color: #2e7d32; font-size: 18px; width: 18px; height: 18px; }
    .row-issue { background: #fff8f0; }
    @media (max-width: 768px) { .summary-grid { grid-template-columns: repeat(2,1fr); } }
  `]
})
export class ReportsComponent implements OnInit {
  private readonly authSvc: AuthService = inject(AuthService);
  readonly timesheetSvc: TimesheetService = inject(TimesheetService);
  private readonly holidaySvc: HolidayService = inject(HolidayService);
  private readonly userSvc: UserService = inject(UserService);
  private readonly absenceSvc: AbsenceService = inject(AbsenceService);

  summaries: DailySummary[] = [];
  holidays: Holiday[] = [];
  absences: Absence[] = [];
  allUsers: AppUser[] = [];
  loading = false;

  selectedUserId = 'mine';
  selectedMonth = new Date().getMonth();
  selectedYear = new Date().getFullYear();

  months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  tableColumns = ['date', 'entries', 'worked', 'expected', 'balance', 'status'];

  get isAdmin(): boolean { return this.authSvc.isAdmin(); }
  get totalWorked(): number { return this.summaries.reduce((s, d) => s + d.workedMinutes, 0); }
  get totalExpected(): number { return this.summaries.reduce((s, d) => s + d.expectedMinutes, 0); }
  get totalBalance(): number { return this.totalWorked - this.totalExpected; }
  get totalInconsistencies(): number { return this.summaries.reduce((s, d) => s + d.inconsistencies.length, 0); }
  get workingDays(): DailySummary[] { return this.summaries.filter(d => !d.isWeekend); }
  get allInconsistencies(): Inconsistency[] { return this.summaries.flatMap(d => d.inconsistencies); }

  async ngOnInit(): Promise<void> {
    this.holidays = await this.holidaySvc.getHolidays(this.authSvc.currentUser?.companyId ?? '', this.authSvc.currentUser?.companyCountry ?? 'BR');
    if (this.isAdmin) {
      const companyId = this.authSvc.currentUser?.companyId ?? '';
      this.allUsers = companyId
        ? await this.userSvc.getByCompany(companyId)
        : await this.userSvc.getAllUsers();
    }
    await this.loadReport();
  }

  async loadReport(): Promise<void> {
    this.loading = true;
    try {
      const uid = this.selectedUserId === 'mine' ? this.authSvc.currentUser!.uid : this.selectedUserId;
      const user = await this.userSvc.getUserById(uid) ?? this.authSvc.currentUser!;
      const days = getDaysInMonth(this.selectedYear, this.selectedMonth);
      const startDate = formatDateToString(days[0]!);
      const endDate = formatDateToString(days[days.length - 1]!);
      const [entries, absences] = await Promise.all([
        this.timesheetSvc.getEntriesForPeriod(uid, startDate, endDate),
        this.absenceSvc.getApprovedAbsencesForPeriod(uid, startDate, endDate),
      ]);
      this.absences = absences;

      const byDate = new Map<string, typeof entries>();
      for (const e of entries) {
        if (!byDate.has(e.date)) byDate.set(e.date, []);
        byDate.get(e.date)!.push(e);
      }

      this.summaries = days.map((day: Date) => {
        const dateStr = formatDateToString(day);
        const dayEntries = byDate.get(dateStr) ?? [];
        return this.timesheetSvc.calculateDailySummary(dateStr, dayEntries, user.workHoursPerDay, this.holidays, this.absences);
      });
    } finally {
      this.loading = false;
    }
  }

  formatMins(mins: number): string {
    const h = Math.floor(Math.abs(mins) / 60);
    const m = Math.abs(mins) % 60;
    return `${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}min`;
  }

  formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  }

  getIncClass(type: string): string {
    const map: Record<string, string> = {
      ODD_PUNCHES: 'inc-badge badge-odd',
      MISSING_EXIT: 'inc-badge badge-exit',
      MISSING_ENTRY: 'inc-badge badge-exit',
      EXCESSIVE_HOURS: 'inc-badge badge-excessive',
      INSUFFICIENT_INTERVAL: 'inc-badge badge-interval',
    };
    return map[type] ?? 'inc-badge badge-default';
  }

  getIncLabel(type: string): string {
    const map: Record<string, string> = {
      ODD_PUNCHES: 'Batida Ímpar',
      MISSING_EXIT: 'Sem Saída',
      MISSING_ENTRY: 'Sem Entrada',
      EXCESSIVE_HOURS: 'Excesso',
      INSUFFICIENT_INTERVAL: 'Intervalo Curto',
    };
    return map[type] ?? type;
  }
}
