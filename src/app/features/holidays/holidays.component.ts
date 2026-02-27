import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { ShellComponent } from '../../../shared/components/shell.component';
import { AuthService } from '../../../core/services/auth.service';
import { HolidayService } from '../../../core/services/holiday.service';
import { Holiday } from '../../../core/models';

@Component({
  selector: 'app-holidays',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, ShellComponent,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatSnackBarModule, MatProgressBarModule, MatChipsModule,
  ],
  template: `
    <app-shell>
      <div class="holidays-page">
        <div class="page-header">
          <div>
            <h2>Gerenciamento de Feriados</h2>
            <p class="subtitle">Cadastre feriados nacionais e locais</p>
          </div>
          <button mat-raised-button color="accent" (click)="seedNationals()" [disabled]="seeding">
            <mat-icon>auto_fix_high</mat-icon>
            {{ seeding ? 'Importando...' : 'Importar Nacionais ' + currentYear }}
          </button>
        </div>

        <mat-card class="form-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>add_circle</mat-icon>
            <mat-card-title>Adicionar Feriado</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="addHoliday()" class="holiday-form">
              <mat-form-field appearance="outline">
                <mat-label>Data</mat-label>
                <input matInput type="date" formControlName="date">
                <mat-error>Data obrigatória</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline" class="name-field">
                <mat-label>Nome</mat-label>
                <input matInput formControlName="name" placeholder="Ex: Corpus Christi">
                <mat-error>Nome obrigatório</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline" class="hours-field">
                <mat-label>Horas esperadas</mat-label>
                <input matInput type="number" formControlName="hoursExpected" min="0" max="12" placeholder="0">
                <mat-hint>0 = feriado total</mat-hint>
              </mat-form-field>
              <mat-checkbox formControlName="national">Nacional</mat-checkbox>
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
                <mat-icon>save</mat-icon>
                {{ saving ? 'Salvando...' : 'Adicionar' }}
              </button>
            </form>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-content>
            <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

            <div class="year-filter">
              <button mat-icon-button (click)="filterYear = filterYear - 1; filterHolidays()"><mat-icon>chevron_left</mat-icon></button>
              <span class="year-label">{{ filterYear }}</span>
              <button mat-icon-button (click)="filterYear = filterYear + 1; filterHolidays()"><mat-icon>chevron_right</mat-icon></button>
            </div>

            <table mat-table [dataSource]="filteredHolidays" class="w-full">
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Data</th>
                <td mat-cell *matCellDef="let h">{{ formatDate(h.date) }}</td>
              </ng-container>
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Nome</th>
                <td mat-cell *matCellDef="let h">
                  {{ h.name }}
                  <mat-chip *ngIf="h.national" class="national-chip">Nacional</mat-chip>
                  <mat-chip *ngIf="h.hoursExpected > 0" class="partial-chip">{{ h.hoursExpected }}h esperadas</mat-chip>
                </td>
              </ng-container>
              <ng-container matColumnDef="weekday">
                <th mat-header-cell *matHeaderCellDef>Dia</th>
                <td mat-cell *matCellDef="let h">{{ getDayName(h.date) }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Ações</th>
                <td mat-cell *matCellDef="let h">
                  <button mat-icon-button color="warn" (click)="deleteHoliday(h)"><mat-icon>delete</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell no-data" [attr.colspan]="displayedColumns.length">Nenhum feriado para {{ filterYear }}.</td>
              </tr>
            </table>
          </mat-card-content>
        </mat-card>
      </div>
    </app-shell>
  `,
  styles: [`
    .holidays-page { max-width: 900px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h2 { margin: 0; font-size: 22px; font-weight: 700; color: #1a237e; }
    .subtitle { margin: 4px 0 0; color: #666; font-size: 14px; }
    .form-card { margin-bottom: 24px; }
    .holiday-form { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding-top: 8px; }
    .holiday-form mat-form-field { min-width: 160px; }
    .name-field { flex: 1; min-width: 250px; }
    .year-filter { display: flex; align-items: center; gap: 8px; padding: 8px 0 16px; }
    .year-label { font-size: 18px; font-weight: 700; color: #1a237e; min-width: 50px; text-align: center; }
    .national-chip { background: #e3f2fd !important; color: #1565c0 !important; font-size: 11px; height: 20px; margin-left: 8px; }
    .partial-chip  { background: #fff3e0 !important; color: #e65100 !important; font-size: 11px; height: 20px; margin-left: 4px; }
    .hours-field { width: 140px; }
    .no-data { text-align: center; padding: 32px; color: #999; }
    .w-full { width: 100%; }
  `]
})
export class HolidaysComponent implements OnInit {
  private readonly authSvc: AuthService = inject(AuthService);
  private readonly holidaySvc: HolidayService = inject(HolidayService);
  private readonly snackBar: MatSnackBar = inject(MatSnackBar);
  private readonly fb: FormBuilder = inject(FormBuilder);

  holidays: Holiday[] = [];
  filteredHolidays: Holiday[] = [];
  loading = false;
  saving = false;
  seeding = false;
  filterYear = new Date().getFullYear();
  currentYear = new Date().getFullYear();
  displayedColumns = ['date', 'name', 'weekday', 'actions'];

  form = this.fb.group({
    date: ['', Validators.required],
    name: ['', Validators.required],
    hoursExpected: [0],
    national: [false],
  });

  async ngOnInit(): Promise<void> {
    await this.loadHolidays();
  }

  async loadHolidays(): Promise<void> {
    this.loading = true;
    try {
      this.holidays = await this.holidaySvc.getHolidays(this.authSvc.currentUser?.companyId ?? '');
      this.filterHolidays();
    } finally {
      this.loading = false;
    }
  }

  filterHolidays(): void {
    this.filteredHolidays = this.holidays.filter(h => h.date.startsWith(String(this.filterYear)));
  }

  async addHoliday(): Promise<void> {
    if (this.form.invalid) return;
    this.saving = true;
    try {
      const v = this.form.value;
      await this.holidaySvc.addHoliday({
        date: v.date!,
        name: v.name!,
        hoursExpected: Number(v.hoursExpected ?? 0),
        national: v.national ?? false,
        createdBy: this.authSvc.currentUser!.uid,
      });
      this.snackBar.open('Feriado adicionado!', 'OK', { duration: 3000 });
      this.form.reset({ hoursExpected: 0, national: false });
      await this.loadHolidays();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro';
      this.snackBar.open('Erro: ' + msg, 'Fechar', { duration: 5000 });
    } finally {
      this.saving = false;
    }
  }

  async deleteHoliday(holiday: Holiday): Promise<void> {
    if (!confirm(`Excluir "${holiday.name}"?`)) return;
    try {
      await this.holidaySvc.deleteHoliday(holiday.id!);
      this.snackBar.open('Feriado removido.', 'OK', { duration: 3000 });
      await this.loadHolidays();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro';
      this.snackBar.open('Erro: ' + msg, 'Fechar', { duration: 5000 });
    }
  }

  async seedNationals(): Promise<void> {
    this.seeding = true;
    try {
      await this.holidaySvc.seedNationalHolidays(this.currentYear, this.authSvc.currentUser!.uid);
      this.snackBar.open(`Feriados nacionais de ${this.currentYear} importados!`, 'OK', { duration: 3000 });
      await this.loadHolidays();
    } finally {
      this.seeding = false;
    }
  }

  formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  getDayName(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const names = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    return names[d.getDay()] ?? '';
  }
}
