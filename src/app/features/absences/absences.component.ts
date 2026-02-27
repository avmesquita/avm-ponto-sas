import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ShellComponent } from '../../shared/components/shell.component';
import { AuthService } from '../../core/services/auth.service';
import { AbsenceService } from '../../core/services/absence.service';
import { Absence, AbsenceType } from '../../core/models';

@Component({
  selector: 'app-absences',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, ShellComponent,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatTableModule,
    MatProgressBarModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <app-shell>
      <div class="absences-page">

        <div class="page-header">
          <div>
            <h2>Minhas Ausências</h2>
            <p class="subtitle">Solicite períodos de férias, folga ou licença</p>
          </div>
        </div>

        <!-- Formulário de solicitação -->
        <mat-card class="request-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>event_busy</mat-icon>
            <mat-card-title>Nova Solicitação</mat-card-title>
            <mat-card-subtitle>A aprovação será feita pelo administrador</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="absenceTypes.length === 0" class="no-types-warning">
              <mat-icon>info</mat-icon>
              Nenhum tipo de ausência cadastrado. Solicite ao administrador.
            </div>
            <form [formGroup]="form" (ngSubmit)="submit()" class="request-form" *ngIf="absenceTypes.length > 0">
              <mat-form-field appearance="outline">
                <mat-label>Tipo</mat-label>
                <mat-select formControlName="absenceTypeId">
                  <mat-option *ngFor="let t of absenceTypes" [value]="t.id">
                    <span class="type-option">
                      <span class="type-dot" [style.background]="t.color"></span>
                      {{ t.name }}
                    </span>
                  </mat-option>
                </mat-select>
                <mat-error>Selecione um tipo</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Data início</mat-label>
                <input matInput type="date" formControlName="startDate">
                <mat-error>Data obrigatória</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Data fim</mat-label>
                <input matInput type="date" formControlName="endDate">
                <mat-error>Data obrigatória</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="note-field">
                <mat-label>Observação (opcional)</mat-label>
                <input matInput formControlName="note" placeholder="Ex: Férias programadas">
              </mat-form-field>

              <button mat-raised-button color="primary" type="submit"
                      [disabled]="form.invalid || saving">
                <mat-icon>send</mat-icon>
                {{ saving ? 'Enviando...' : 'Solicitar' }}
              </button>
            </form>
            <p class="form-error" *ngIf="formError">
              <mat-icon>error</mat-icon> {{ formError }}
            </p>
          </mat-card-content>
        </mat-card>

        <!-- Lista de solicitações -->
        <mat-card>
          <mat-card-header>
            <mat-icon mat-card-avatar>list_alt</mat-icon>
            <mat-card-title>Minhas Solicitações</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

            <div *ngIf="!loading && absences.length === 0" class="empty-state">
              <mat-icon>event_available</mat-icon>
              <p>Nenhuma solicitação registrada.</p>
            </div>

            <table mat-table [dataSource]="absences" *ngIf="absences.length > 0" class="full-table">

              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let a">
                  <span class="type-chip"
                        [style.background]="typeColor(a) + '22'"
                        [style.color]="typeColor(a)">
                    <span class="type-dot-sm" [style.background]="typeColor(a)"></span>
                    {{ a.absenceTypeName }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="period">
                <th mat-header-cell *matHeaderCellDef>Período</th>
                <td mat-cell *matCellDef="let a">
                  {{ formatDate(a.startDate) }}
                  <span *ngIf="a.startDate !== a.endDate"> → {{ formatDate(a.endDate) }}</span>
                  <span class="days-count">({{ countDays(a) }} dia(s))</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let a">
                  <span class="status-chip" [class]="'status-' + a.status">
                    <mat-icon>{{ statusIcon(a.status) }}</mat-icon>
                    {{ statusLabel(a.status) }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="note">
                <th mat-header-cell *matHeaderCellDef>Observação</th>
                <td mat-cell *matCellDef="let a">
                  <span class="note-text" *ngIf="a.note">{{ a.note }}</span>
                  <span class="review-note" *ngIf="a.reviewNote"
                        [matTooltip]="'Resposta do admin: ' + a.reviewNote">
                    <mat-icon>comment</mat-icon> {{ a.reviewNote }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let a">
                  <button mat-icon-button color="warn"
                          *ngIf="a.status === 'pending'"
                          (click)="cancelRequest(a)"
                          matTooltip="Cancelar solicitação">
                    <mat-icon>cancel</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"
                  [class.row-approved]="row.status === 'approved'"
                  [class.row-rejected]="row.status === 'rejected'">
              </tr>
            </table>
          </mat-card-content>
        </mat-card>

      </div>
    </app-shell>
  `,
  styles: [`
    .absences-page { max-width: 900px; }
    .page-header { margin-bottom: 24px; }
    .page-header h2 { margin: 0; font-size: 22px; font-weight: 700; color: #1a237e; }
    .subtitle { margin: 4px 0 0; color: #666; font-size: 14px; }

    .request-card { margin-bottom: 24px; }
    .request-form { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; padding-top: 8px; }
    .request-form mat-form-field { min-width: 150px; }
    .note-field { flex: 1; min-width: 220px; }

    .no-types-warning { display: flex; align-items: center; gap: 8px; color: #f57c00;
      background: #fff8e1; border-radius: 8px; padding: 12px 16px; font-size: 14px; margin-top: 8px; }
    .no-types-warning mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .form-error { display: flex; align-items: center; gap: 6px; color: #c62828; font-size: 13px; margin-top: 4px; }
    .form-error mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .type-option { display: flex; align-items: center; gap: 8px; }
    .type-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

    .full-table { width: 100%; }
    .type-chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 12px;
      padding: 3px 10px; font-size: 12px; font-weight: 600; }
    .type-dot-sm { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .days-count { font-size: 11px; color: #999; margin-left: 4px; }

    .status-chip { display: inline-flex; align-items: center; gap: 4px; border-radius: 12px;
      padding: 3px 10px; font-size: 12px; font-weight: 600; }
    .status-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .status-pending  { background: #fff8e1; color: #f9a825; }
    .status-approved { background: #e8f5e9; color: #2e7d32; }
    .status-rejected { background: #ffebee; color: #c62828; }

    .note-text { font-size: 13px; color: #555; }
    .review-note { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #c62828; cursor: help; }
    .review-note mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .row-approved { background: #f1f8e9; }
    .row-rejected { background: #fce4ec; opacity: .8; }

    .empty-state { text-align: center; padding: 40px; color: #bbb; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; }
  `]
})
export class AbsencesComponent implements OnInit {
  private readonly authSvc: AuthService = inject(AuthService);
  private readonly absenceSvc: AbsenceService = inject(AbsenceService);
  private readonly snackBar: MatSnackBar = inject(MatSnackBar);
  private readonly fb: FormBuilder = inject(FormBuilder);

  absences: Absence[] = [];
  absenceTypes: AbsenceType[] = [];
  loading = false;
  saving = false;
  formError = '';
  columns = ['type', 'period', 'status', 'note', 'actions'];

  form = this.fb.group({
    absenceTypeId: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    note: [''],
  });

  async ngOnInit(): Promise<void> {
    const user = this.authSvc.currentUser!;
    this.absenceTypes = await this.absenceSvc.getAbsenceTypes(user.companyId);
    await this.loadAbsences();
  }

  async loadAbsences(): Promise<void> {
    this.loading = true;
    try {
      this.absences = await this.absenceSvc.getAbsencesByUser(this.authSvc.currentUser!.uid);
    } finally {
      this.loading = false;
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    const v = this.form.value;
    this.formError = '';
    if (v.endDate! < v.startDate!) {
      this.formError = 'A data fim não pode ser anterior à data início.';
      return;
    }
    this.saving = true;
    try {
      const user = this.authSvc.currentUser!;
      const type = this.absenceTypes.find(t => t.id === v.absenceTypeId);
      await this.absenceSvc.requestAbsence({
        companyId: user.companyId,
        userId: user.uid,
        userDisplayName: user.displayName,
        absenceTypeId: v.absenceTypeId!,
        absenceTypeName: type?.name,
        absenceTypeColor: type?.color,
        startDate: v.startDate!,
        endDate: v.endDate!,
        note: v.note ?? undefined,
      });
      this.snackBar.open('Solicitação enviada! Aguarde aprovação.', 'OK', { duration: 5000 });
      this.form.reset();
      await this.loadAbsences();
    } catch (e: unknown) {
      this.snackBar.open('Erro: ' + (e instanceof Error ? e.message : ''), 'Fechar', { duration: 5000 });
    } finally {
      this.saving = false;
    }
  }

  async cancelRequest(absence: Absence): Promise<void> {
    if (!absence.id || !confirm('Cancelar esta solicitação?')) return;
    try {
      await this.absenceSvc.deleteAbsence(absence.id);
      this.snackBar.open('Solicitação cancelada.', 'OK', { duration: 3000 });
      await this.loadAbsences();
    } catch (e: unknown) {
      this.snackBar.open('Erro ao cancelar.', 'Fechar', { duration: 4000 });
    }
  }

  typeColor(a: Absence): string { return a.absenceTypeColor ?? '#1a237e'; }

  countDays(a: Absence): number {
    const s = new Date(a.startDate + 'T12:00:00');
    const e = new Date(a.endDate + 'T12:00:00');
    return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  }

  formatDate(d: string): string {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  statusLabel(s: string): string {
    return ({ pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado' } as Record<string,string>)[s] ?? s;
  }

  statusIcon(s: string): string {
    return ({ pending: 'hourglass_empty', approved: 'check_circle', rejected: 'cancel' } as Record<string,string>)[s] ?? 'help';
  }
}
