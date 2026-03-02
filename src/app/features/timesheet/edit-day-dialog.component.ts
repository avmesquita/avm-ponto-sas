import { Component, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TimesheetService } from '../../core/services/timesheet.service';
import { TimeEntry } from '../../core/models';

export interface EditDayDialogData {
  date: string;
  userId: string;
  companyId: string;
  editorUid: string;
  entries: TimeEntry[];
  canEdit: boolean;   // false = somente leitura (mês anterior)
}

@Component({
  selector: 'app-edit-day-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDividerModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon>edit_calendar</mat-icon>
        Batidas de {{ formatDate(data.date) }}
        <span class="readonly-badge" *ngIf="!data.canEdit">Somente leitura</span>
      </h2>

      <mat-dialog-content>

        <!-- Lista de batidas existentes -->
        <div class="entries-list">
          <div *ngFor="let entry of entries; let i = index" class="entry-row"
               [class.manual-entry]="entry.manual" [class.imported-entry]="entry.imported">

            <div class="entry-badges">
              <span class="type-badge" [class.entry-badge]="entry.type === 'entry'" [class.exit-badge]="entry.type === 'exit'">
                <mat-icon>{{ entry.type === 'entry' ? 'login' : 'logout' }}</mat-icon>
                {{ entry.type === 'entry' ? 'Entrada' : 'Saída' }}
              </span>
              <span class="time-display">{{ formatTime(entry.timestamp) }}</span>
              <span class="tag manual-tag" *ngIf="entry.manual" [matTooltip]="'Editado por: ' + (entry.manualNote ?? '')">
                <mat-icon>edit</mat-icon> Manual
              </span>
              <span class="tag imported-tag" *ngIf="entry.imported">
                <mat-icon>upload_file</mat-icon> Importado
              </span>
            </div>

            <div class="entry-actions" *ngIf="data.canEdit">
              <button mat-icon-button color="primary" (click)="startEdit(entry, i)"
                      [disabled]="savingIndex !== -1" matTooltip="Editar">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteEntry(entry, i)"
                      [disabled]="savingIndex !== -1" matTooltip="Excluir">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>

          <div *ngIf="entries.length === 0" class="empty-entries">
            <mat-icon>fingerprint</mat-icon>
            <p>Nenhuma batida neste dia.</p>
          </div>
        </div>

        <!-- Formulário de edição de batida existente -->
        <div class="edit-form-section" *ngIf="editingEntry && data.canEdit">
          <mat-divider></mat-divider>
          <h3 class="section-title"><mat-icon>edit</mat-icon> Editar batida</h3>
          <form [formGroup]="editForm" class="entry-form">
            <mat-form-field appearance="outline">
              <mat-label>Tipo</mat-label>
              <mat-select formControlName="type">
                <mat-option value="entry">Entrada</mat-option>
                <mat-option value="exit">Saída</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Horário</mat-label>
              <input matInput type="time" formControlName="time">
              <mat-error>Horário obrigatório</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" class="note-field">
              <mat-label>Justificativa *</mat-label>
              <input matInput formControlName="manualNote" placeholder="Ex: Esqueci de bater na saída">
              <mat-error>Justificativa obrigatória</mat-error>
            </mat-form-field>
            <div class="form-actions">
              <button mat-button type="button" (click)="cancelEdit()" [disabled]="savingIndex !== -1">Cancelar</button>
              <button mat-raised-button color="primary" type="button"
                      [disabled]="editForm.invalid || savingIndex !== -1"
                      (click)="saveEdit()">
                <mat-spinner *ngIf="savingIndex === editingIndex" diameter="18"></mat-spinner>
                <span *ngIf="savingIndex !== editingIndex">Salvar</span>
              </button>
            </div>
          </form>
        </div>

        <!-- Formulário de nova batida manual -->
        <div class="add-form-section" *ngIf="data.canEdit">
          <mat-divider></mat-divider>
          <h3 class="section-title"><mat-icon>add_circle</mat-icon> Adicionar batida manual</h3>
          <form [formGroup]="addForm" class="entry-form">
            <mat-form-field appearance="outline">
              <mat-label>Tipo</mat-label>
              <mat-select formControlName="type">
                <mat-option value="entry">Entrada</mat-option>
                <mat-option value="exit">Saída</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Horário</mat-label>
              <input matInput type="time" formControlName="time">
              <mat-error>Horário obrigatório</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" class="note-field">
              <mat-label>Justificativa *</mat-label>
              <input matInput formControlName="manualNote" placeholder="Ex: Batida não registrada no sistema">
              <mat-error>Justificativa obrigatória</mat-error>
            </mat-form-field>
            <div class="form-actions">
              <button mat-raised-button color="accent" type="button"
                      [disabled]="addForm.invalid || savingIndex !== -1"
                      (click)="addEntry()">
                <mat-spinner *ngIf="savingIndex === -2" diameter="18"></mat-spinner>
                <span *ngIf="savingIndex !== -2"><mat-icon>add</mat-icon> Adicionar</span>
              </button>
            </div>
          </form>
        </div>

      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Fechar</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { min-width: 520px; }
    .dialog-title { display: flex; align-items: center; gap: 10px; font-size: 18px; color: #1a237e; }
    .dialog-title mat-icon { color: #1a237e; }
    .readonly-badge { font-size: 11px; background: #fff3e0; color: #e65100; border-radius: 8px; padding: 2px 8px; font-weight: 600; }

    .entries-list { display: flex; flex-direction: column; gap: 8px; padding: 4px 0 8px; }
    .entry-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 10px; background: #f8f9fa; border: 1px solid #e0e0e0; }
    .entry-row.manual-entry { border-color: #90caf9; background: #e3f2fd; }
    .entry-row.imported-entry { border-color: #ce93d8; background: #f3e5f5; }

    .entry-badges { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .type-badge { display: flex; align-items: center; gap: 4px; border-radius: 8px; padding: 3px 10px; font-size: 13px; font-weight: 600; min-width: 90px; }
    .type-badge mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .entry-badge { background: #e8f5e9; color: #2e7d32; }
    .exit-badge { background: #fff3e0; color: #e65100; }
    .time-display { font-size: 20px; font-weight: 700; color: #1a237e; font-family: monospace; }
    .tag { display: flex; align-items: center; gap: 3px; font-size: 11px; border-radius: 6px; padding: 2px 6px; font-weight: 600; }
    .tag mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .manual-tag { background: #bbdefb; color: #1565c0; cursor: help; }
    .imported-tag { background: #e1bee7; color: #6a1b9a; }
    .entry-actions { display: flex; gap: 4px; }

    .empty-entries { text-align: center; padding: 24px; color: #bbb; }
    .empty-entries mat-icon { font-size: 40px; width: 40px; height: 40px; }

    .section-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: #333; margin: 16px 0 12px; }
    .section-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: #555; }
    .edit-form-section, .add-form-section { padding-top: 8px; }
    .entry-form { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .entry-form mat-form-field { min-width: 110px; }
    .note-field { flex: 1; min-width: 200px; }
    .form-actions { display: flex; align-items: center; gap: 8px; padding-top: 4px; }

    mat-dialog-content { max-height: 70vh; overflow-y: auto; }
    mat-dialog-actions { padding: 12px 24px !important; }
  `]
})
export class EditDayDialogComponent {
  private readonly timesheetSvc: TimesheetService = inject(TimesheetService);
  private readonly dialogRef: MatDialogRef<EditDayDialogComponent> = inject(MatDialogRef);
  private readonly fb: FormBuilder = inject(FormBuilder);

  readonly data: EditDayDialogData = inject(MAT_DIALOG_DATA);

  entries: TimeEntry[] = [...this.data.entries];
  editingEntry: TimeEntry | null = null;
  editingIndex = -1;
  savingIndex = -1; // -1 = nenhum, -2 = adicionando, 0+ = editando índice

  editForm: FormGroup = this.fb.group({
    type: ['entry', Validators.required],
    time: ['', Validators.required],
    manualNote: ['', Validators.required],
  });

  addForm: FormGroup = this.fb.group({
    type: ['entry', Validators.required],
    time: ['', Validators.required],
    manualNote: ['', Validators.required],
  });

  startEdit(entry: TimeEntry, index: number): void {
    this.editingEntry = entry;
    this.editingIndex = index;
    this.editForm.setValue({
      type: entry.type,
      time: this.formatTime(entry.timestamp),
      manualNote: entry.manualNote ?? '',
    });
  }

  cancelEdit(): void {
    this.editingEntry = null;
    this.editingIndex = -1;
    this.editForm.reset({ type: 'entry', time: '', manualNote: '' });
  }

  async saveEdit(): Promise<void> {
    if (this.editForm.invalid || !this.editingEntry?.id) return;
    this.savingIndex = this.editingIndex;
    try {
      const v = this.editForm.value as { type: TimeEntry['type']; time: string; manualNote: string };
      await this.timesheetSvc.updateManualEntry(
        this.editingEntry.id!, v.time, v.type, v.manualNote, this.data.editorUid
      );
      // Atualiza localmente
      const [hh, mm] = v.time.split(':').map(Number);
      const ts = new Date(this.data.date + 'T00:00:00');
      ts.setHours(hh ?? 0, mm ?? 0, 0, 0);
      this.entries[this.editingIndex] = {
        ...this.editingEntry, type: v.type, timestamp: ts,
        manual: true, manualNote: v.manualNote, manualBy: this.data.editorUid, manualAt: new Date(),
      };
      this.entries = [...this.entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      this.cancelEdit();
      this.dialogRef.componentInstance.data.entries = this.entries;
    } finally {
      this.savingIndex = -1;
    }
  }

  async deleteEntry(entry: TimeEntry, index: number): Promise<void> {
    if (!entry.id || !confirm('Excluir esta batida?')) return;
    this.savingIndex = index;
    try {
      await this.timesheetSvc.deleteEntry(entry.id);
      this.entries.splice(index, 1);
      this.entries = [...this.entries];
      if (this.editingIndex === index) this.cancelEdit();
    } finally {
      this.savingIndex = -1;
    }
  }

  async addEntry(): Promise<void> {
    if (this.addForm.invalid) return;
    this.savingIndex = -2;
    try {
      const v = this.addForm.value as { type: TimeEntry['type']; time: string; manualNote: string };
      const entry: TimeEntry = await this.timesheetSvc.addManualEntry(
        this.data.userId, this.data.companyId, this.data.date, v.time, v.type, v.manualNote, this.data.editorUid
      );
      if (entry) this.entries = [...this.entries, entry].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      this.addForm.reset({ type: 'entry', time: '', manualNote: '' });
    } finally {
      this.savingIndex = -1;
    }
  }

  formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}
