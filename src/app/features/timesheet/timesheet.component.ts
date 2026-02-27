import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { ShellComponent } from '../../../shared/components/shell.component';
import { AuthService } from '../../../core/services/auth.service';
import { TimesheetService } from '../../../core/services/timesheet.service';
import { HolidayService } from '../../../core/services/holiday.service';
import { UserService } from '../../../core/services/user.service';
import { ActivatedRoute } from '@angular/router';
import { AbsenceService } from '../../../core/services/absence.service';
import { Absence } from '../../../core/models';
import { AppUser, DailySummary, Holiday } from '../../../core/models';
import { getDaysInMonth, formatDateToString } from '../../../shared/utils/date.utils';
import { EditDayDialogComponent, EditDayDialogData } from './edit-day-dialog.component';

@Component({
  selector: 'app-timesheet',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ShellComponent,
    MatCardModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatFormFieldModule,
    MatProgressBarModule, MatTooltipModule,
    MatDialogModule, MatDividerModule,
  ],
  template: `
    <app-shell>
      <div class="timesheet-page">

        <div class="page-header">
          <div>
            <h2>Registro de Ponto</h2>
            <p class="subtitle" *ngIf="!isAdmin">Visualize e edite suas batidas mensais</p>
            <p class="subtitle" *ngIf="isAdmin">Visualize e edite batidas — modo administrador</p>
          </div>
          <div class="header-actions">

            <!-- Seletor de usuário — apenas para Admin -->
            <mat-form-field appearance="outline" class="user-select" *ngIf="isAdmin">
              <mat-label>Usuário</mat-label>
              <mat-select [(ngModel)]="selectedUserId" (ngModelChange)="onUserChange()">
                <mat-option *ngFor="let u of allUsers" [value]="u.uid">
                  <span class="user-option">
                    <span>{{ u.displayName }}</span>
                    <small>{{ u.email }}</small>
                  </span>
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="month-select">
              <mat-label>Mês</mat-label>
              <mat-select [(ngModel)]="selectedMonth" (ngModelChange)="loadSummaries()">
                <mat-option *ngFor="let m of months; let i = index" [value]="i">{{ m }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="year-select">
              <mat-label>Ano</mat-label>
              <mat-select [(ngModel)]="selectedYear" (ngModelChange)="loadSummaries()">
                <mat-option *ngFor="let y of years" [value]="y">{{ y }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- Banner quando admin está visualizando outro usuário -->
        <div class="viewing-banner" *ngIf="isAdmin && viewingUser && viewingUser.uid !== loggedUser?.uid">
          <mat-icon>manage_accounts</mat-icon>
          <span>Visualizando registros de <strong>{{ viewingUser.displayName }}</strong> ({{ viewingUser.email }})</span>
          <button mat-button (click)="resetToSelf()">Voltar para minha conta</button>
        </div>

        <div class="summary-banner" *ngIf="!loading">
          <div class="summary-item">
            <mat-icon>work_history</mat-icon>
            <div><span class="s-label">Trabalhado</span><span class="s-value">{{ formatMins(totalWorked) }}</span></div>
          </div>
          <div class="summary-item">
            <mat-icon>schedule</mat-icon>
            <div><span class="s-label">Esperado</span><span class="s-value">{{ formatMins(totalExpected) }}</span></div>
          </div>
          <div class="summary-item" [class.positive]="totalBalance >= 0" [class.negative]="totalBalance < 0">
            <mat-icon>{{ totalBalance >= 0 ? 'trending_up' : 'trending_down' }}</mat-icon>
            <div><span class="s-label">Saldo</span><span class="s-value">{{ timesheetSvc.formatMinutes(totalBalance) }}</span></div>
          </div>
          <div class="summary-item" [class.has-issues]="totalInconsistencies > 0">
            <mat-icon>{{ totalInconsistencies > 0 ? 'warning' : 'check_circle' }}</mat-icon>
            <div><span class="s-label">Inconsistências</span><span class="s-value">{{ totalInconsistencies }}</span></div>
          </div>
        </div>

        <mat-progress-bar *ngIf="loading" mode="indeterminate" style="margin-bottom:16px"></mat-progress-bar>

        <div class="legend" *ngIf="!loading">
          <span class="legend-item"><span class="dot dot-manual"></span>Editado manualmente</span>
          <span class="legend-item"><span class="dot dot-imported"></span>Importado</span>
          <span class="legend-item" *ngIf="!isAdmin"><span class="dot dot-edit"></span>Editável (mês atual)</span>
          <span class="legend-item"><span class="dot dot-absence"></span>Ausência aprovada</span>
          <span class="legend-item" *ngIf="isAdmin"><span class="dot dot-edit"></span>Editável (admin — qualquer mês)</span>
        </div>

        <div class="calendar-grid" *ngIf="!loading">
          <div *ngFor="let day of summaries"
               class="day-card"
               [class.weekend]="day.isWeekend"
               [class.holiday]="day.isHoliday"
               [class.today]="day.date === todayStr && viewingUser?.uid === loggedUser?.uid"
               [class.has-inconsistency]="day.inconsistencies.length > 0"
               [class.has-manual]="hasManualEntries(day)"
               [class.has-imported]="hasImportedEntries(day)"
               [class.is-absence]="day.isAbsence"
               [style.border-color]="day.isAbsence ? (day.absenceTypeColor ?? '#4caf50') : null">

            <div class="day-header">
              <span class="day-num">{{ getDayNum(day.date) }}</span>
              <span class="day-name">{{ getDayNameShort(day.date) }}</span>
              <mat-icon *ngIf="day.isHoliday" class="icon-holiday" matTooltip="Feriado">celebration</mat-icon>
              <mat-icon *ngIf="day.inconsistencies.length > 0" class="icon-warn"
                        [matTooltip]="day.inconsistencies[0].description">warning</mat-icon>
              <mat-icon *ngIf="hasManualEntries(day)" class="icon-manual"
                        matTooltip="Contém batidas manuais">edit</mat-icon>
            </div>

            <!-- Banner de ausência aprovada -->
            <div class="absence-banner" *ngIf="day.isAbsence"
                 [style.background]="day.absenceTypeColor + '22'"
                 [style.color]="day.absenceTypeColor">
              <mat-icon>event_busy</mat-icon>
              <span>{{ day.absenceTypeName }}</span>
            </div>

            <div class="day-entries" *ngIf="day.entries.length > 0">
              <div class="entry-pill" *ngFor="let e of day.entries"
                   [class.entry-type]="e.type === 'entry'"
                   [class.exit-type]="e.type === 'exit'"
                   [class.manual-pill]="e.manual"
                   [class.imported-pill]="e.imported"
                   [matTooltip]="getPillTooltip(e)">
                <mat-icon>{{ e.type === 'entry' ? 'login' : 'logout' }}</mat-icon>
                {{ formatTime(e.timestamp) }}
              </div>
            </div>

            <div class="day-footer" *ngIf="day.workedMinutes > 0">
              <span class="worked-time">{{ timesheetSvc.formatMinutesSimple(day.workedMinutes) }}</span>
              <span class="balance-time" [class.pos]="day.balanceMinutes >= 0" [class.neg]="day.balanceMinutes < 0">
                {{ timesheetSvc.formatMinutes(day.balanceMinutes) }}
              </span>
            </div>

            <div class="day-empty" *ngIf="day.entries.length === 0 && !day.isWeekend && !day.isHoliday">
              <span>Sem registros</span>
            </div>

            <button
              *ngIf="canEditDay(day.date)"
              mat-icon-button
              class="edit-day-btn"
              (click)="openEditDialog(day)"
              matTooltip="Editar batidas deste dia">
              <mat-icon>edit_note</mat-icon>
            </button>
          </div>
        </div>

      </div>
    </app-shell>
  `,
  styles: [`
    .timesheet-page { max-width: 1100px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; font-size: 22px; font-weight: 700; color: #1a237e; }
    .subtitle { margin: 4px 0 0; color: #666; font-size: 14px; }
    .header-actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    .user-select { min-width: 220px; }
    .month-select { width: 150px; }
    .year-select { width: 100px; }

    ::ng-deep .user-option { display: flex; flex-direction: column; line-height: 1.3; }
    ::ng-deep .user-option small { color: #999; font-size: 11px; }

    .viewing-banner {
      display: flex; align-items: center; gap: 10px;
      background: #e8eaf6; border-left: 4px solid #3949ab;
      border-radius: 0 8px 8px 0; padding: 10px 16px;
      margin-bottom: 16px; font-size: 14px; color: #1a237e;
    }
    .viewing-banner mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .viewing-banner button { margin-left: auto; color: #3949ab; }

    .summary-banner { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 16px; background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .summary-item { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 8px; }
    .summary-item mat-icon { color: #1a237e; font-size: 28px; width: 28px; height: 28px; }
    .summary-item.positive mat-icon { color: #2e7d32; }
    .summary-item.negative mat-icon { color: #c62828; }
    .summary-item.has-issues mat-icon { color: #f57c00; }
    .s-label { display: block; font-size: 11px; color: #999; text-transform: uppercase; }
    .s-value { font-size: 18px; font-weight: 700; color: #333; }
    .positive .s-value { color: #2e7d32; }
    .negative .s-value { color: #c62828; }
    .has-issues .s-value { color: #f57c00; }

    .legend { display: flex; gap: 16px; margin-bottom: 16px; font-size: 12px; color: #666; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 3px; }
    .dot-manual { background: #bbdefb; border: 1px solid #90caf9; }
    .dot-imported { background: #e1bee7; border: 1px solid #ce93d8; }
    .dot-edit { background: #f5f5f5; border: 1px dashed #1a237e; }
    .dot-absence { background: #c8e6c9; border: 1px solid #4caf50; }

    .calendar-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 8px; }
    .day-card { position: relative; background: white; border-radius: 10px; padding: 10px 10px 28px; min-height: 120px; border: 2px solid transparent; box-shadow: 0 1px 4px rgba(0,0,0,.06); transition: box-shadow 0.15s; }
    .day-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.1); }
    .day-card.weekend { background: #fafafa; opacity: .75; }
    .day-card.holiday { background: #fff8e1; border-color: #ffca28; }
    .day-card.today { border-color: #1a237e; box-shadow: 0 0 0 3px rgba(26,35,126,.15); }
    .day-card.has-inconsistency { border-color: #f57c00; }
    .day-card.has-manual { background: #e3f2fd; }
    .day-card.has-imported { background: #f3e5f5; }
    .day-card.is-absence { border-width: 2px; border-style: solid; }

    .absence-banner { display: flex; align-items: center; gap: 4px; border-radius: 6px;
      padding: 4px 8px; font-size: 11px; font-weight: 700; margin-bottom: 6px; }
    .absence-banner mat-icon { font-size: 13px; width: 13px; height: 13px; }

    .day-header { display: flex; align-items: center; gap: 3px; margin-bottom: 8px; }
    .day-num { font-weight: 700; font-size: 16px; color: #333; }
    .day-name { font-size: 11px; color: #999; text-transform: uppercase; flex: 1; }
    .icon-holiday, .icon-warn, .icon-manual { font-size: 14px; width: 14px; height: 14px; }
    .icon-holiday { color: #f9a825; }
    .icon-warn { color: #f57c00; }
    .icon-manual { color: #1565c0; }

    .day-entries { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; }
    .entry-pill { display: flex; align-items: center; gap: 4px; border-radius: 6px; padding: 2px 6px; font-size: 12px; font-weight: 500; font-family: monospace; cursor: default; }
    .entry-pill mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .entry-type { background: #e8f5e9; color: #2e7d32; }
    .exit-type { background: #fff3e0; color: #e65100; }
    .manual-pill { outline: 2px solid #90caf9; }
    .imported-pill { outline: 2px solid #ce93d8; }

    .day-footer { display: flex; justify-content: space-between; align-items: center; }
    .worked-time { font-size: 13px; font-weight: 600; color: #555; font-family: monospace; }
    .balance-time { font-size: 11px; font-weight: 600; font-family: monospace; }
    .pos { color: #2e7d32; }
    .neg { color: #c62828; }
    .day-empty { font-size: 11px; color: #ccc; text-align: center; padding-top: 16px; }

    .edit-day-btn {
      position: absolute; bottom: 2px; right: 2px;
      width: 28px; height: 28px; line-height: 28px;
      opacity: 0; transition: opacity 0.15s;
    }
    .edit-day-btn mat-icon { font-size: 16px; width: 16px; height: 16px; color: #1a237e; }
    .day-card:hover .edit-day-btn { opacity: 1; }

    @media (max-width: 900px) {
      .calendar-grid { grid-template-columns: repeat(4,1fr); }
      .summary-banner { grid-template-columns: repeat(2,1fr); }
      .edit-day-btn { opacity: 1; }
      .page-header { flex-direction: column; gap: 12px; }
      .header-actions { width: 100%; }
    }
  `]
})
export class TimesheetComponent implements OnInit {
  private readonly authSvc: AuthService = inject(AuthService);
  readonly timesheetSvc: TimesheetService = inject(TimesheetService);
  private readonly holidaySvc: HolidayService = inject(HolidayService);
  private readonly userSvc: UserService = inject(UserService);
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly absenceSvc: AbsenceService = inject(AbsenceService);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  slug = '';

  absences: Absence[] = [];

  loggedUser: AppUser | null = null;   // usuário autenticado (nunca muda)
  viewingUser: AppUser | null = null;  // usuário cujo calendário está sendo exibido

  allUsers: AppUser[] = [];
  selectedUserId = '';

  summaries: DailySummary[] = [];
  holidays: Holiday[] = [];
  loading = false;
  todayStr = '';

  selectedMonth = new Date().getMonth();
  selectedYear = new Date().getFullYear();

  months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  get isAdmin(): boolean { return this.authSvc.isAdmin(); }
  get totalWorked(): number { return this.summaries.reduce((s, d) => s + d.workedMinutes, 0); }
  get totalExpected(): number { return this.summaries.reduce((s, d) => s + d.expectedMinutes, 0); }
  get totalBalance(): number { return this.totalWorked - this.totalExpected; }
  get totalInconsistencies(): number { return this.summaries.reduce((s, d) => s + d.inconsistencies.length, 0); }

  async ngOnInit(): Promise<void> {
    this.slug = this.route.snapshot.params['slug'] ?? '';
    this.loggedUser = this.authSvc.currentUser;
    this.viewingUser = this.loggedUser;
    this.selectedUserId = this.loggedUser?.uid ?? '';
    this.todayStr = this.timesheetSvc.getTodayString();
    this.holidays = await this.holidaySvc.getHolidays(this.loggedUser?.companyId ?? '');

    if (this.isAdmin) {
      this.allUsers = await this.userSvc.getAllUsers();
      // Garante que o próprio admin aparece selecionado inicialmente
      if (!this.allUsers.find(u => u.uid === this.selectedUserId)) {
        this.selectedUserId = this.allUsers[0]?.uid ?? '';
        this.viewingUser = this.allUsers[0] ?? null;
      }
    }

    await this.loadSummaries();
  }

  async onUserChange(): Promise<void> {
    this.viewingUser = this.allUsers.find(u => u.uid === this.selectedUserId) ?? null;
    await this.loadSummaries();
  }

  resetToSelf(): void {
    this.selectedUserId = this.loggedUser?.uid ?? '';
    this.viewingUser = this.loggedUser;
    this.loadSummaries();
  }

  async loadSummaries(): Promise<void> {
    if (!this.viewingUser) return;
    this.loading = true;
    try {
      const days = getDaysInMonth(this.selectedYear, this.selectedMonth);
      const startDate = formatDateToString(days[0]!);
      const endDate = formatDateToString(days[days.length - 1]!);
      const [entries, absences] = await Promise.all([
        this.timesheetSvc.getEntriesForPeriod(this.viewingUser.uid, startDate, endDate),
        this.absenceSvc.getApprovedAbsencesForPeriod(this.viewingUser.uid, startDate, endDate),
      ]);
      this.absences = absences;
      const byDate = new Map<string, typeof entries>();
      for (const e of entries) {
        if (!byDate.has(e.date)) byDate.set(e.date, []);
        byDate.get(e.date)!.push(e);
      }
      this.summaries = days.map((day: Date) => {
        const dateStr = formatDateToString(day);
        return this.timesheetSvc.calculateDailySummary(
          dateStr,
          byDate.get(dateStr) ?? [],
          this.viewingUser!.workHoursPerDay,
          this.holidays,
          this.absences
        );
      });
    } finally {
      this.loading = false;
    }
  }

  canEditDay(date: string): boolean {
    if (!this.loggedUser) return false;
    // Admin pode editar qualquer dia de qualquer usuário
    if (this.isAdmin) return true;
    // Usuário comum: apenas mês atual das próprias batidas
    return this.timesheetSvc.isCurrentMonth(date);
  }

  openEditDialog(day: DailySummary): void {
    if (!this.viewingUser || !this.loggedUser) return;
    const dialogRef = this.dialog.open(EditDayDialogComponent, {
      data: {
        date: day.date,
        userId: this.viewingUser.uid,       // dono das batidas
        editorUid: this.loggedUser.uid,     // quem está editando (para log)
        entries: [...day.entries],
        canEdit: this.canEditDay(day.date),
      } as EditDayDialogData,
      width: '580px',
    });

    dialogRef.afterClosed().subscribe(() => this.loadSummaries());
  }

  hasManualEntries(day: DailySummary): boolean { return day.entries.some(e => e.manual); }
  hasImportedEntries(day: DailySummary): boolean { return day.entries.some(e => e.imported); }

  getPillTooltip(entry: { manual?: boolean; manualNote?: string; imported?: boolean }): string {
    if (entry.manual && entry.manualNote) return `Manual: ${entry.manualNote}`;
    if (entry.imported) return 'Importado via CSV';
    return '';
  }

  getDayNum(dateStr: string): string { return dateStr.split('-')[2] ?? ''; }

  getDayNameShort(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()] ?? '';
  }

  formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  }

  formatMins(mins: number): string {
    const h = Math.floor(Math.abs(mins) / 60);
    const m = Math.abs(mins) % 60;
    return `${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}min`;
  }
}
