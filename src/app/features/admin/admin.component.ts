import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { ShellComponent } from '../../../shared/components/shell.component';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { TimesheetService } from '../../../core/services/timesheet.service';
import { AppUser, UserRole, UserStatus, AuthLog, ImportRow, ImportResult, Absence, AbsenceType, AppMessage } from '../../../core/models';
import { MessageService } from '../../../core/services/message.service';
import { AbsenceService } from '../../../core/services/absence.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  Firestore, collection, query, orderBy, getDocs, Timestamp
} from '@angular/fire/firestore';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ShellComponent,
    MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatSelectModule, MatFormFieldModule,
    MatInputModule, MatProgressBarModule, MatChipsModule,
    MatSnackBarModule, MatTooltipModule, MatTabsModule, MatDividerModule, MatCheckboxModule,
  ],
  template: `
    <app-shell>
      <div class="admin-page">
        <div class="page-header">
          <div>
            <h2>Administração</h2>
            <p class="subtitle">Usuários, logs de acesso e importação de dados</p>
          </div>
        </div>

        <mat-tab-group animationDuration="150ms" color="primary">

          <!-- ═══ ABA 1: USUÁRIOS ═══════════════════════════════════════════ -->
          <mat-tab label="Usuários">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-icon mat-card-avatar>people</mat-icon>
                  <mat-card-title>Usuários Cadastrados</mat-card-title>
                  <mat-card-subtitle>{{ users.length }} usuário(s)</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <mat-progress-bar *ngIf="loadingUsers" mode="indeterminate"></mat-progress-bar>
                  <table mat-table [dataSource]="users" class="full-table">
                    <ng-container matColumnDef="avatar">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let u">
                        <img [src]="u.photoURL || 'https://ui-avatars.com/api/?name=' + u.displayName"
                             class="user-avatar" [alt]="u.displayName">
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Nome</th>
                      <td mat-cell *matCellDef="let u">
                        <strong>{{ u.displayName }}</strong><br>
                        <small class="email">{{ u.email }}</small>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="role">
                      <th mat-header-cell *matHeaderCellDef>Perfil</th>
                      <td mat-cell *matCellDef="let u">
                        <mat-select [(ngModel)]="u.role" (ngModelChange)="updateRole(u)"
                                    [disabled]="u.uid === currentUid" class="role-select">
                          <mat-option [value]="UserRole.ADMIN">Admin</mat-option>
                          <mat-option [value]="UserRole.USER">User</mat-option>
                        </mat-select>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="workHours">
                      <th mat-header-cell *matHeaderCellDef>Horas/Dia</th>
                      <td mat-cell *matCellDef="let u">
                        <div class="hours-wrap">
                          <input type="number" [(ngModel)]="u.workHoursPerDay"
                                 min="1" max="12" class="hours-field"
                                 (change)="updateWorkHours(u)">h
                        </div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="since">
                      <th mat-header-cell *matHeaderCellDef>Desde</th>
                      <td mat-cell *matCellDef="let u">{{ formatDate(u.createdAt) }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="userColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: userColumns;" [class.current-row]="row.uid === currentUid"></tr>
                  </table>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- ═══ ABA 2: IMPORTAÇÃO ════════════════════════════════════════ -->
          <mat-tab label="Importação de Batidas">
            <div class="tab-content">
              <mat-card class="import-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar>upload_file</mat-icon>
                  <mat-card-title>Importar Batidas via CSV</mat-card-title>
                  <mat-card-subtitle>Integração com sistemas externos</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>

                  <!-- Instruções do formato -->
                  <div class="format-box">
                    <div class="format-title"><mat-icon>info</mat-icon> Formato esperado do CSV</div>
                    <p>O arquivo deve ter <strong>cabeçalho</strong> na primeira linha com as colunas abaixo. Separador: <strong>vírgula (,)</strong>.</p>
                    <table class="format-table">
                      <tr><th>Coluna</th><th>Obrigatório</th><th>Formato</th><th>Exemplo</th></tr>
                      <tr><td><code>userId</code></td><td>✅</td><td>UID do Firebase</td><td><code>abc123xyz</code></td></tr>
                      <tr><td><code>datetime</code></td><td>✅</td><td>YYYY-MM-DD HH:MM</td><td><code>2026-02-15 08:30</code></td></tr>
                      <tr><td><code>type</code></td><td>✅</td><td>entry ou exit</td><td><code>entry</code></td></tr>
                      <tr><td><code>note</code></td><td>—</td><td>texto livre</td><td><code>Importado do Ponto Fácil</code></td></tr>
                    </table>
                    <div class="format-example">
                      <strong>Exemplo de arquivo:</strong>
                      <pre>userId,datetime,type,note
abc123,2026-02-15 08:30,entry,Importado do sistema X
abc123,2026-02-15 12:00,exit,
abc123,2026-02-15 13:00,entry,
abc123,2026-02-15 17:30,exit,</pre>
                    </div>
                    <button mat-stroked-button color="primary" (click)="downloadTemplate()">
                      <mat-icon>download</mat-icon> Baixar template CSV
                    </button>
                  </div>

                  <mat-divider style="margin: 20px 0"></mat-divider>

                  <!-- Upload -->
                  <div class="upload-area" (dragover)="$event.preventDefault()" (drop)="onFileDrop($event)">
                    <input #fileInput type="file" accept=".csv" style="display:none" (change)="onFileSelected($event)">
                    <mat-icon class="upload-icon">cloud_upload</mat-icon>
                    <p>Arraste um arquivo CSV aqui ou</p>
                    <button mat-raised-button color="primary" (click)="fileInput.click()">
                      Selecionar arquivo
                    </button>
                    <p class="file-name" *ngIf="selectedFileName">
                      <mat-icon>attach_file</mat-icon> {{ selectedFileName }}
                    </p>
                  </div>

                  <!-- Preview -->
                  <div class="preview-section" *ngIf="previewRows.length > 0">
                    <mat-divider style="margin: 20px 0"></mat-divider>
                    <div class="preview-header">
                      <h3><mat-icon>preview</mat-icon> Preview — {{ previewRows.length }} linha(s) encontrada(s)</h3>
                      <div class="preview-actions">
                        <button mat-button color="warn" (click)="clearPreview()">
                          <mat-icon>clear</mat-icon> Limpar
                        </button>
                        <button mat-raised-button color="primary"
                                [disabled]="importing" (click)="confirmImport()">
                          <mat-icon>check_circle</mat-icon>
                          {{ importing ? 'Importando...' : 'Confirmar importação' }}
                        </button>
                      </div>
                    </div>
                    <mat-progress-bar *ngIf="importing" mode="indeterminate" style="margin-bottom:8px"></mat-progress-bar>
                    <table mat-table [dataSource]="previewRows.slice(0, 20)" class="preview-table">
                      <ng-container matColumnDef="userId">
                        <th mat-header-cell *matHeaderCellDef>userId</th>
                        <td mat-cell *matCellDef="let r"><code class="uid-cell">{{ r.userId | slice:0:12 }}…</code></td>
                      </ng-container>
                      <ng-container matColumnDef="datetime">
                        <th mat-header-cell *matHeaderCellDef>datetime</th>
                        <td mat-cell *matCellDef="let r">{{ r.datetime }}</td>
                      </ng-container>
                      <ng-container matColumnDef="type">
                        <th mat-header-cell *matHeaderCellDef>type</th>
                        <td mat-cell *matCellDef="let r">
                          <span class="type-tag" [class.entry-tag]="r.type==='entry'" [class.exit-tag]="r.type==='exit'">{{ r.type }}</span>
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="note">
                        <th mat-header-cell *matHeaderCellDef>note</th>
                        <td mat-cell *matCellDef="let r" class="note-cell">{{ r.note || '—' }}</td>
                      </ng-container>
                      <ng-container matColumnDef="status">
                        <th mat-header-cell *matHeaderCellDef>Validação</th>
                        <td mat-cell *matCellDef="let r">
                          <span class="status-ok" *ngIf="validateRow(r) === null"><mat-icon>check_circle</mat-icon></span>
                          <span class="status-err" *ngIf="validateRow(r) !== null" [matTooltip]="validateRow(r) ?? ''"><mat-icon>error</mat-icon> {{ validateRow(r) }}</span>
                        </td>
                      </ng-container>
                      <tr mat-header-row *matHeaderRowDef="previewColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: previewColumns;" [class.row-error]="validateRow(row) !== null"></tr>
                    </table>
                    <p class="preview-note" *ngIf="previewRows.length > 20">
                      Exibindo as primeiras 20 de {{ previewRows.length }} linhas.
                    </p>
                    <p class="preview-errors" *ngIf="previewErrorCount > 0">
                      <mat-icon>warning</mat-icon>
                      {{ previewErrorCount }} linha(s) com erro serão ignoradas na importação.
                    </p>
                  </div>

                  <!-- Resultado -->
                  <div class="result-section" *ngIf="importResult">
                    <mat-divider style="margin: 20px 0"></mat-divider>
                    <div class="result-box" [class.result-success]="importResult.failed === 0" [class.result-partial]="importResult.failed > 0">
                      <mat-icon>{{ importResult.failed === 0 ? 'check_circle' : 'warning' }}</mat-icon>
                      <div>
                        <strong>Importação concluída</strong>
                        <p>✅ {{ importResult.success }} registro(s) importado(s) com sucesso.</p>
                        <p *ngIf="importResult.failed > 0">❌ {{ importResult.failed }} registro(s) rejeitado(s).</p>
                        <ul *ngIf="importResult.errors.length > 0" class="error-list">
                          <li *ngFor="let err of importResult.errors">{{ err }}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- ═══ ABA 3: TIPOS DE AUSÊNCIA ═══════════════════════════════ -->
          <mat-tab label="Tipos de Ausência">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-icon mat-card-avatar>category</mat-icon>
                  <mat-card-title>Tipos de Ausência</mat-card-title>
                  <mat-card-subtitle>Categorias disponíveis para solicitação</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <!-- Formulário de novo tipo -->
                  <form class="type-form" (ngSubmit)="addAbsenceType()">
                    <mat-form-field appearance="outline">
                      <mat-label>Nome</mat-label>
                      <input matInput [(ngModel)]="newTypeName" name="typeName" required placeholder="Ex: Férias">
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="color-field">
                      <mat-label>Cor</mat-label>
                      <input matInput type="color" [(ngModel)]="newTypeColor" name="typeColor">
                    </mat-form-field>
                    <button mat-raised-button color="primary" type="submit"
                            [disabled]="!newTypeName || savingType">
                      <mat-icon>add</mat-icon> Adicionar
                    </button>
                  </form>
                  <mat-divider style="margin: 16px 0"></mat-divider>
                  <mat-progress-bar *ngIf="loadingTypes" mode="indeterminate"></mat-progress-bar>
                  <table mat-table [dataSource]="absenceTypes" class="full-table" *ngIf="absenceTypes.length > 0">
                    <ng-container matColumnDef="color">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let t">
                        <span class="type-color-dot" [style.background]="t.color"></span>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Nome</th>
                      <td mat-cell *matCellDef="let t"><strong>{{ t.name }}</strong></td>
                    </ng-container>
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let t">
                        <button mat-icon-button color="warn" (click)="deleteAbsenceType(t)"
                                matTooltip="Excluir tipo">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="typeColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: typeColumns;"></tr>
                  </table>
                  <div class="empty-state" *ngIf="!loadingTypes && absenceTypes.length === 0">
                    Nenhum tipo cadastrado ainda.
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- ═══ ABA 4: SOLICITAÇÕES DE AUSÊNCIA ══════════════════════════ -->
          <mat-tab label="Ausências">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-icon mat-card-avatar>event_busy</mat-icon>
                  <mat-card-title>Solicitações de Ausência</mat-card-title>
                  <mat-card-subtitle>
                    {{ pendingAbsences.length }} pendente(s) · {{ absences.length }} total
                  </mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <mat-progress-bar *ngIf="loadingAbsences" mode="indeterminate"></mat-progress-bar>

                  <!-- Pendentes primeiro -->
                  <div *ngIf="pendingAbsences.length > 0">
                    <h3 class="section-title"><mat-icon>hourglass_empty</mat-icon> Pendentes</h3>
                    <table mat-table [dataSource]="pendingAbsences" class="full-table absence-table">
                      <ng-container matColumnDef="user">
                        <th mat-header-cell *matHeaderCellDef>Usuário</th>
                        <td mat-cell *matCellDef="let a"><strong>{{ a.userDisplayName }}</strong></td>
                      </ng-container>
                      <ng-container matColumnDef="type">
                        <th mat-header-cell *matHeaderCellDef>Tipo</th>
                        <td mat-cell *matCellDef="let a">
                          <span class="type-chip-admin"
                                [style.background]="(a.absenceTypeColor ?? '#999') + '22'"
                                [style.color]="a.absenceTypeColor ?? '#999'">
                            <span class="dot-sm" [style.background]="a.absenceTypeColor ?? '#999'"></span>
                            {{ a.absenceTypeName }}
                          </span>
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="period">
                        <th mat-header-cell *matHeaderCellDef>Período</th>
                        <td mat-cell *matCellDef="let a">
                          {{ fmtDate(a.startDate) }} → {{ fmtDate(a.endDate) }}
                          <span class="days-badge">({{ dayCount(a) }}d)</span>
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="note">
                        <th mat-header-cell *matHeaderCellDef>Obs.</th>
                        <td mat-cell *matCellDef="let a" class="note-col">{{ a.note || '—' }}</td>
                      </ng-container>
                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef>Ação</th>
                        <td mat-cell *matCellDef="let a">
                          <div class="review-actions">
                            <button mat-raised-button color="primary" class="approve-btn"
                                    (click)="reviewAbsence(a, 'approved')">
                              <mat-icon>check</mat-icon> Aprovar
                            </button>
                            <button mat-stroked-button color="warn"
                                    (click)="reviewAbsence(a, 'rejected')">
                              <mat-icon>close</mat-icon> Rejeitar
                            </button>
                          </div>
                        </td>
                      </ng-container>
                      <tr mat-header-row *matHeaderRowDef="absenceColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: absenceColumns;"></tr>
                    </table>
                  </div>

                  <mat-divider *ngIf="pendingAbsences.length > 0 && reviewedAbsences.length > 0"
                               style="margin: 20px 0"></mat-divider>

                  <!-- Histórico -->
                  <div *ngIf="reviewedAbsences.length > 0">
                    <h3 class="section-title"><mat-icon>history</mat-icon> Histórico</h3>
                    <table mat-table [dataSource]="reviewedAbsences" class="full-table absence-table">
                      <ng-container matColumnDef="user">
                        <th mat-header-cell *matHeaderCellDef>Usuário</th>
                        <td mat-cell *matCellDef="let a"><strong>{{ a.userDisplayName }}</strong></td>
                      </ng-container>
                      <ng-container matColumnDef="type">
                        <th mat-header-cell *matHeaderCellDef>Tipo</th>
                        <td mat-cell *matCellDef="let a">
                          <span class="type-chip-admin"
                                [style.background]="(a.absenceTypeColor ?? '#999') + '22'"
                                [style.color]="a.absenceTypeColor ?? '#999'">
                            <span class="dot-sm" [style.background]="a.absenceTypeColor ?? '#999'"></span>
                            {{ a.absenceTypeName }}
                          </span>
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="period">
                        <th mat-header-cell *matHeaderCellDef>Período</th>
                        <td mat-cell *matCellDef="let a">
                          {{ fmtDate(a.startDate) }} → {{ fmtDate(a.endDate) }}
                          <span class="days-badge">({{ dayCount(a) }}d)</span>
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="note">
                        <th mat-header-cell *matHeaderCellDef>Obs.</th>
                        <td mat-cell *matCellDef="let a" class="note-col">{{ a.note || '—' }}</td>
                      </ng-container>
                      <ng-container matColumnDef="status">
                        <th mat-header-cell *matHeaderCellDef>Status</th>
                        <td mat-cell *matCellDef="let a">
                          <span class="status-chip" [class]="'status-' + a.status">
                            <mat-icon>{{ a.status === 'approved' ? 'check_circle' : 'cancel' }}</mat-icon>
                            {{ a.status === 'approved' ? 'Aprovado' : 'Rejeitado' }}
                          </span>
                        </td>
                      </ng-container>
                      <tr mat-header-row *matHeaderRowDef="absenceHistoryColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: absenceHistoryColumns;"
                          [class.approved-row]="row.status === 'approved'"
                          [class.rejected-row]="row.status === 'rejected'">
                      </tr>
                    </table>
                  </div>

                  <div class="empty-state" *ngIf="!loadingAbsences && absences.length === 0">
                    <mat-icon>event_available</mat-icon>
                    <p>Nenhuma solicitação recebida ainda.</p>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- ═══ ABA 5: MENSAGENS / MARKETING ════════════════════════════════ -->
          <mat-tab label="Mensagens">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-icon mat-card-avatar>campaign</mat-icon>
                  <mat-card-title>Mensagens para Usuários</mat-card-title>
                  <mat-card-subtitle>Comunicados, novidades e marketing</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>

                  <!-- Formulário de nova mensagem -->
                  <div class="msg-form-wrap">
                    <h3 class="section-title"><mat-icon>add_circle</mat-icon> Nova mensagem</h3>
                    <div class="msg-form">
                      <mat-form-field appearance="outline" class="msg-title-field">
                        <mat-label>Título</mat-label>
                        <input matInput [(ngModel)]="newMsg.title" placeholder="Ex: Nova funcionalidade disponível!">
                      </mat-form-field>
                      <div class="msg-icon-row">
                        <mat-form-field appearance="outline" class="msg-icon-field">
                          <mat-label>Ícone (Material)</mat-label>
                          <input matInput [(ngModel)]="newMsg.icon" placeholder="Ex: new_releases">
                          <mat-hint>
                            <a href="https://fonts.google.com/icons" target="_blank">Ver ícones</a>
                          </mat-hint>
                        </mat-form-field>
                        <div class="icon-preview" [style.color]="newMsg.iconColor">
                          <mat-icon>{{ newMsg.icon || 'campaign' }}</mat-icon>
                        </div>
                        <mat-form-field appearance="outline" class="msg-color-field">
                          <mat-label>Cor</mat-label>
                          <input matInput type="color" [(ngModel)]="newMsg.iconColor">
                        </mat-form-field>
                        <mat-form-field appearance="outline" class="msg-link-field">
                          <mat-label>Link (rota, opcional)</mat-label>
                          <input matInput [(ngModel)]="newMsg.link" placeholder="Ex: /absences">
                        </mat-form-field>
                      </div>
                      <mat-form-field appearance="outline" class="msg-body-field">
                        <mat-label>Conteúdo</mat-label>
                        <textarea matInput [(ngModel)]="newMsg.body" rows="4"
                                  placeholder="Descreva a novidade ou comunicado..."></textarea>
                      </mat-form-field>
                      <div class="msg-form-actions">
                        <mat-checkbox [(ngModel)]="newMsg.active">Publicar imediatamente</mat-checkbox>
                        <button mat-raised-button color="primary"
                                [disabled]="!newMsg.title || !newMsg.body || savingMsg"
                                (click)="createMessage()">
                          <mat-icon>send</mat-icon>
                          {{ savingMsg ? 'Salvando...' : 'Publicar mensagem' }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <mat-divider style="margin: 20px 0"></mat-divider>

                  <!-- Lista de mensagens -->
                  <mat-progress-bar *ngIf="loadingMsgs" mode="indeterminate"></mat-progress-bar>
                  <div class="admin-msg-list" *ngIf="adminMessages.length > 0">
                    <div *ngFor="let msg of adminMessages" class="admin-msg-item">
                      <div class="admin-msg-icon" [style.background]="(msg.iconColor || '#1a237e') + '18'">
                        <mat-icon [style.color]="msg.iconColor || '#1a237e'">{{ msg.icon || 'campaign' }}</mat-icon>
                      </div>
                      <div class="admin-msg-info">
                        <div class="admin-msg-title">{{ msg.title }}</div>
                        <div class="admin-msg-body">{{ msg.body | slice:0:100 }}{{ msg.body.length > 100 ? '…' : '' }}</div>
                        <div class="admin-msg-meta">
                          {{ formatDateTime(msg.publishedAt) }}
                          <span class="active-badge" [class.inactive-badge]="!msg.active">
                            {{ msg.active ? 'Ativo' : 'Inativo' }}
                          </span>
                        </div>
                      </div>
                      <div class="admin-msg-actions">
                        <button mat-icon-button (click)="toggleMsgActive(msg)"
                                [matTooltip]="msg.active ? 'Desativar' : 'Ativar'">
                          <mat-icon>{{ msg.active ? 'visibility_off' : 'visibility' }}</mat-icon>
                        </button>
                        <button mat-icon-button color="warn" (click)="deleteMessage(msg)"
                                matTooltip="Excluir mensagem">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="empty-state" *ngIf="!loadingMsgs && adminMessages.length === 0">
                    <mat-icon>campaign</mat-icon>
                    <p>Nenhuma mensagem criada ainda.</p>
                  </div>

                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- ═══ ABA 6: LOG DE ACESSO ══════════════════════════════════════ -->
          <mat-tab label="Log de Acesso">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-icon mat-card-avatar>history</mat-icon>
                  <mat-card-title>Log de Autenticação</mat-card-title>
                  <mat-card-subtitle>Últimos {{ logs.length }} eventos</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <mat-progress-bar *ngIf="loadingLogs" mode="indeterminate"></mat-progress-bar>
                  <table mat-table [dataSource]="logs" class="full-table">
                    <ng-container matColumnDef="user">
                      <th mat-header-cell *matHeaderCellDef>Usuário</th>
                      <td mat-cell *matCellDef="let l">{{ l.displayName }}<br><small class="email">{{ l.email }}</small></td>
                    </ng-container>
                    <ng-container matColumnDef="action">
                      <th mat-header-cell *matHeaderCellDef>Ação</th>
                      <td mat-cell *matCellDef="let l">
                        <span class="action-chip" [class]="getActionClass(l.action)">{{ l.action }}</span>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="timestamp">
                      <th mat-header-cell *matHeaderCellDef>Data/Hora</th>
                      <td mat-cell *matCellDef="let l">{{ formatDateTime(l.timestamp) }}</td>
                    </ng-container>
                    <ng-container matColumnDef="ua">
                      <th mat-header-cell *matHeaderCellDef>Dispositivo</th>
                      <td mat-cell *matCellDef="let l">
                        <span class="ua-text" [matTooltip]="l.userAgent ?? ''">{{ truncateUA(l.userAgent) }}</span>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="logColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: logColumns;"></tr>
                  </table>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

        </mat-tab-group>
      </div>
    </app-shell>
  `,
  styles: [`
    .admin-page { max-width: 1100px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h2 { margin: 0; font-size: 22px; font-weight: 700; color: #1a237e; }
    .subtitle { margin: 4px 0 0; color: #666; font-size: 14px; }
    .tab-content { padding-top: 20px; }
    .full-table { width: 100%; }
    .user-avatar { width: 36px; height: 36px; border-radius: 50%; }
    .email { color: #999; font-size: 11px; }
    .role-select { width: 100px; font-size: 13px; }
    .hours-wrap { display: flex; align-items: center; gap: 4px; }
    .hours-field { width: 40px; border: 1px solid #ddd; border-radius: 4px; padding: 4px; text-align: center; font-size: 14px; outline: none; }
    .current-row { background: #e8f5e9; }
    .action-chip { border-radius: 12px; padding: 2px 10px; font-size: 11px; font-weight: 600; }
    .chip-login { background: #e8f5e9; color: #2e7d32; }
    .chip-logout { background: #fff3e0; color: #e65100; }
    .chip-register { background: #e3f2fd; color: #1565c0; }
    .chip-default { background: #f5f5f5; color: #555; }
    .ua-text { font-size: 12px; color: #999; max-width: 200px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Importação */
    .import-card { }
    .format-box { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 10px; padding: 16px; margin-bottom: 4px; }
    .format-title { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #1a237e; margin-bottom: 10px; }
    .format-title mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .format-table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px; }
    .format-table th { background: #e8eaf6; padding: 6px 10px; text-align: left; border: 1px solid #c5cae9; }
    .format-table td { padding: 5px 10px; border: 1px solid #e0e0e0; }
    .format-table code { background: #ede7f6; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
    .format-example { margin: 12px 0; }
    .format-example pre { background: #263238; color: #cfd8dc; border-radius: 8px; padding: 12px 16px; font-size: 12px; overflow-x: auto; margin: 6px 0; }

    .upload-area {
      border: 2px dashed #bdbdbd; border-radius: 12px; padding: 32px;
      text-align: center; color: #888; transition: border-color 0.2s; cursor: default;
      margin-top: 4px;
    }
    .upload-area:hover { border-color: #1a237e; }
    .upload-icon { font-size: 48px; width: 48px; height: 48px; color: #bdbdbd; margin-bottom: 8px; }
    .file-name { display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 13px; color: #1a237e; font-weight: 500; margin-top: 8px; }
    .file-name mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .preview-header h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; color: #1a237e; }
    .preview-header mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .preview-actions { display: flex; gap: 8px; }
    .preview-table { width: 100%; }
    .uid-cell { font-size: 11px; color: #888; }
    .note-cell { font-size: 12px; color: #666; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .type-tag { border-radius: 8px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
    .entry-tag { background: #e8f5e9; color: #2e7d32; }
    .exit-tag { background: #fff3e0; color: #e65100; }
    .status-ok { color: #2e7d32; display: flex; align-items: center; }
    .status-err { color: #c62828; display: flex; align-items: center; gap: 4px; font-size: 12px; }
    .status-ok mat-icon, .status-err mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .row-error { background: #ffebee; }
    .preview-note { font-size: 12px; color: #999; margin-top: 8px; }
    .preview-errors { display: flex; align-items: center; gap: 6px; color: #e65100; font-size: 13px; margin-top: 8px; font-weight: 500; }
    .preview-errors mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .result-box { display: flex; gap: 16px; align-items: flex-start; border-radius: 10px; padding: 16px; }
    .result-success { background: #e8f5e9; border: 1px solid #a5d6a7; }
    .result-partial { background: #fff8e1; border: 1px solid #ffe082; }
    .result-box mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .result-success mat-icon { color: #2e7d32; }
    .result-partial mat-icon { color: #f9a825; }
    .result-box p { margin: 4px 0; font-size: 14px; }
    .error-list { margin: 8px 0 0; padding-left: 20px; font-size: 12px; color: #c62828; }
    .error-list li { margin-bottom: 2px; }

    /* Tipos de ausência */
    .type-form { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; padding-top: 8px; }
    .color-field { width: 100px; }
    .type-color-dot { width: 18px; height: 18px; border-radius: 50%; display: inline-block; }

    /* Ausências */
    .section-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600;
      color: #1a237e; margin: 8px 0 12px; }
    .section-title mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .absence-table { width: 100%; }
    .type-chip-admin { display: inline-flex; align-items: center; gap: 6px; border-radius: 12px;
      padding: 3px 10px; font-size: 12px; font-weight: 600; }
    .dot-sm { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .days-badge { font-size: 11px; color: #999; margin-left: 4px; }
    .note-col { font-size: 12px; color: #777; max-width: 180px; }
    .review-actions { display: flex; gap: 8px; align-items: center; }
    .approve-btn { min-width: 90px; }
    .status-chip { display: inline-flex; align-items: center; gap: 4px; border-radius: 12px;
      padding: 3px 10px; font-size: 12px; font-weight: 600; }
    .status-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .status-approved { background: #e8f5e9; color: #2e7d32; }
    .status-rejected { background: #ffebee; color: #c62828; }
    .approved-row { background: #f1f8e9; }
    .rejected-row { background: #fce4ec; opacity: .8; }
    .empty-state { text-align: center; padding: 32px; color: #bbb; }

    /* Mensagens admin */
    .msg-form-wrap { padding-top: 8px; }
    .msg-form { display: flex; flex-direction: column; gap: 12px; }
    .msg-title-field, .msg-body-field { width: 100%; }
    .msg-icon-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .msg-icon-field { width: 180px; }
    .msg-color-field { width: 100px; }
    .msg-link-field { flex: 1; min-width: 150px; }
    .icon-preview { font-size: 28px; width: 28px; height: 28px; }
    .msg-form-actions { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }

    .admin-msg-list { display: flex; flex-direction: column; gap: 8px; }
    .admin-msg-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border-radius: 10px; background: #f8f9fa; border: 1px solid #e0e0e0; }
    .admin-msg-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .admin-msg-info { flex: 1; min-width: 0; }
    .admin-msg-title { font-weight: 600; font-size: 14px; color: #1a237e; margin-bottom: 2px; }
    .admin-msg-body { font-size: 13px; color: #555; margin-bottom: 4px; }
    .admin-msg-meta { font-size: 11px; color: #aaa; display: flex; align-items: center; gap: 8px; }
    .active-badge { border-radius: 8px; padding: 1px 8px; font-size: 10px; font-weight: 600; background: #e8f5e9; color: #2e7d32; }
    .inactive-badge { background: #f5f5f5; color: #999; }
    .admin-msg-actions { display: flex; flex-direction: column; gap: 0; }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 8px; }
  `]
})
export class AdminComponent implements OnInit {
  private readonly authSvc: AuthService = inject(AuthService);
  private readonly userSvc: UserService = inject(UserService);
  private readonly timesheetSvc: TimesheetService = inject(TimesheetService);
  private readonly firestore: Firestore = inject(Firestore);
  private readonly snackBar: MatSnackBar = inject(MatSnackBar);

  // ── Usuários ─────────────────────────────────────────────
  users: AppUser[] = [];
  loadingUsers = false;
  readonly UserRole = UserRole;
  userColumns = ['avatar', 'name', 'role', 'workHours', 'since'];

  // ── Logs ─────────────────────────────────────────────────
  logs: AuthLog[] = [];
  loadingLogs = false;
  logColumns = ['user', 'action', 'timestamp', 'ua'];

  // ── Importação ────────────────────────────────────────────
  selectedFileName = '';
  previewRows: ImportRow[] = [];
  previewColumns = ['userId', 'datetime', 'type', 'note', 'status'];
  importing = false;
  importResult: ImportResult | null = null;

  get currentUid(): string { return this.authSvc.currentUser?.uid ?? ''; }
  get previewErrorCount(): number { return this.previewRows.filter(r => this.validateRow(r) !== null).length; }

  async ngOnInit(): Promise<void> {
    this.loadingTypes = true;
    this.loadingAbsences = true;
    await Promise.all([this.loadUsers(), this.loadLogs()]);
    try { this.absenceTypes = await this.absenceSvc.getAbsenceTypes(); } finally { this.loadingTypes = false; }
    try { this.absences = await this.absenceSvc.getAllAbsencesByCompany(this.authSvc.currentUser?.companyId ?? ''); } finally { this.loadingAbsences = false; }
    this.loadingMsgs = true;
    try { this.adminMessages = await this.msgSvc.getAllByCompany(this.authSvc.currentUser?.companyId ?? ''); } finally { this.loadingMsgs = false; }
  }

  async loadUsers(): Promise<void> {
    this.loadingUsers = true;
    try { this.users = await this.userSvc.getAllUsers(); } finally { this.loadingUsers = false; }
  }

  async loadLogs(): Promise<void> {
    this.loadingLogs = true;
    try {
      const q = query(collection(this.firestore, 'authLogs'), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      this.logs = snap.docs.slice(0, 50).map(d => {
        const data = d.data();
        return {
          id: d.id,
          userId: data['userId'] as string,
          email: data['email'] as string,
          displayName: data['displayName'] as string,
          action: data['action'] as AuthLog['action'],
          timestamp: data['timestamp'] instanceof Timestamp ? data['timestamp'].toDate() : new Date(),
          userAgent: data['userAgent'] as string | undefined,
        };
      });
    } finally { this.loadingLogs = false; }
  }

  // ── Usuários actions ──────────────────────────────────────

  async updateRole(user: AppUser): Promise<void> {
    try {
      await this.userSvc.updateUserRole(user.uid, user.role);
      this.snackBar.open(`Perfil de ${user.displayName} atualizado.`, 'OK', { duration: 3000 });
    } catch (e: unknown) {
      this.snackBar.open('Erro: ' + (e instanceof Error ? e.message : ''), 'Fechar', { duration: 5000 });
    }
  }

  async updateWorkHours(user: AppUser): Promise<void> {
    try {
      await this.userSvc.updateWorkHours(user.uid, user.workHoursPerDay);
      this.snackBar.open(`Carga de ${user.displayName} atualizada.`, 'OK', { duration: 3000 });
    } catch (e: unknown) {
      this.snackBar.open('Erro: ' + (e instanceof Error ? e.message : ''), 'Fechar', { duration: 5000 });
    }
  }

  // ── Importação actions ────────────────────────────────────

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.processFile(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.processFile(file);
  }

  private processFile(file: File): void {
    if (!file.name.endsWith('.csv')) {
      this.snackBar.open('Apenas arquivos .csv são aceitos.', 'Fechar', { duration: 4000 });
      return;
    }
    this.selectedFileName = file.name;
    this.importResult = null;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.parseCSV(text);
    };
    reader.readAsText(file, 'UTF-8');
  }

  private parseCSV(text: string): void {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      this.snackBar.open('CSV vazio ou sem dados (apenas cabeçalho).', 'Fechar', { duration: 4000 });
      return;
    }

    const header = lines[0]!.split(',').map(h => h.trim().toLowerCase());
    const idxUserId   = header.indexOf('userid');
    const idxDatetime = header.indexOf('datetime');
    const idxType     = header.indexOf('type');
    const idxNote     = header.indexOf('note');

    if (idxUserId === -1 || idxDatetime === -1 || idxType === -1) {
      this.snackBar.open('Cabeçalho inválido. Verifique as colunas userId, datetime e type.', 'Fechar', { duration: 5000 });
      return;
    }

    this.previewRows = lines.slice(1).map(line => {
      const cols = line.split(',');
      return {
        userId:   (cols[idxUserId]   ?? '').trim(),
        datetime: (cols[idxDatetime] ?? '').trim(),
        type:     ((cols[idxType]    ?? '').trim()) as ImportRow['type'],
        note:     idxNote >= 0 ? (cols[idxNote] ?? '').trim() : undefined,
      };
    }).filter(r => r.userId || r.datetime); // ignora linhas completamente vazias
  }

  validateRow(row: ImportRow): string | null {
    if (!row.userId) return 'userId em branco';
    if (!row.datetime.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) return 'datetime inválido';
    if (row.type !== 'entry' && row.type !== 'exit') return `type inválido: "${row.type}"`;
    return null;
  }

  clearPreview(): void {
    this.previewRows = [];
    this.selectedFileName = '';
    this.importResult = null;
  }

  async confirmImport(): Promise<void> {
    const validRows = this.previewRows.filter(r => this.validateRow(r) === null);
    if (validRows.length === 0) {
      this.snackBar.open('Nenhuma linha válida para importar.', 'Fechar', { duration: 4000 });
      return;
    }
    this.importing = true;
    try {
      this.importResult = await this.timesheetSvc.importEntries(validRows, this.currentUid);
      this.snackBar.open(
        `Importação concluída: ${this.importResult.success} sucesso, ${this.importResult.failed} falha(s).`,
        'OK', { duration: 5000 }
      );
      this.previewRows = [];
      this.selectedFileName = '';
    } finally {
      this.importing = false;
    }
  }

  downloadTemplate(): void {
    const csv = 'userId,datetime,type,note\nabc123uid,2026-02-15 08:30,entry,Importado do sistema X\nabc123uid,2026-02-15 17:30,exit,\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'template_batidas.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Ausências ─────────────────────────────────────────────
  private readonly absenceSvc: AbsenceService = inject(AbsenceService);
  private readonly notifSvc: NotificationService = inject(NotificationService);

  absenceTypes: AbsenceType[] = [];
  absences: Absence[] = [];
  loadingTypes = false;
  loadingAbsences = false;
  savingType = false;
  newTypeName = '';
  newTypeColor = '#4caf50';
  typeColumns = ['color', 'name', 'actions'];
  absenceColumns = ['user', 'type', 'period', 'note', 'actions'];
  absenceHistoryColumns = ['user', 'type', 'period', 'note', 'status'];

  get pendingAbsences(): Absence[] { return this.absences.filter(a => a.status === 'pending'); }
  get reviewedAbsences(): Absence[] { return this.absences.filter(a => a.status !== 'pending'); }

  async addAbsenceType(): Promise<void> {
    if (!this.newTypeName) return;
    this.savingType = true;
    try {
      await this.absenceSvc.addAbsenceType({
        name: this.newTypeName,
        color: this.newTypeColor,
        deductsBalance: false,
        createdBy: this.currentUid,
      });
      this.newTypeName = '';
      this.newTypeColor = '#4caf50';
      this.absenceTypes = await this.absenceSvc.getAbsenceTypes();
      this.snackBar.open('Tipo adicionado!', 'OK', { duration: 3000 });
    } finally { this.savingType = false; }
  }

  async deleteAbsenceType(type: AbsenceType): Promise<void> {
    if (!type.id || !confirm(`Excluir o tipo "${type.name}"?`)) return;
    await this.absenceSvc.deleteAbsenceType(type.id);
    this.absenceTypes = await this.absenceSvc.getAbsenceTypes();
    this.snackBar.open('Tipo removido.', 'OK', { duration: 3000 });
  }

  async reviewAbsence(absence: Absence, status: 'approved' | 'rejected'): Promise<void> {
    if (!absence.id) return;
    let reviewNote: string | undefined;
    if (status === 'rejected') {
      const note = prompt('Motivo da rejeição (opcional):') ?? undefined;
      reviewNote = note || undefined;
    }
    await this.absenceSvc.reviewAbsence(absence.id, status, this.currentUid, reviewNote);
    this.snackBar.open(
      status === 'approved' ? 'Ausência aprovada!' : 'Ausência rejeitada.',
      'OK', { duration: 3000 }
    );
    // Notifica o usuário (se o app estiver aberto no dispositivo dele)
    if (absence.absenceTypeName) {
      await this.notifSvc.notifyAbsenceReview(
        status, absence.absenceTypeName, absence.startDate, absence.endDate
      );
    }
    this.absences = await this.absenceSvc.getAllAbsencesByCompany(this.authSvc.currentUser?.companyId ?? '');
  }

  fmtDate(d: string): string {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  dayCount(a: Absence): number {
    const s = new Date(a.startDate + 'T12:00:00');
    const e = new Date(a.endDate + 'T12:00:00');
    return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  }

  // ── Mensagens ─────────────────────────────────────────────
  private readonly msgSvc: MessageService = inject(MessageService);
  adminMessages: AppMessage[] = [];
  loadingMsgs = false;
  savingMsg = false;
  newMsg: Partial<AppMessage> = { title: '', body: '', icon: 'new_releases', iconColor: '#1a237e', link: '', active: true };

  async createMessage(): Promise<void> {
    if (!this.newMsg.title || !this.newMsg.body) return;
    this.savingMsg = true;
    try {
      await this.msgSvc.create({
        companyId: this.authSvc.currentUser?.companyId ?? '',
        title: this.newMsg.title!,
        body: this.newMsg.body!,
        icon: this.newMsg.icon || 'campaign',
        iconColor: this.newMsg.iconColor || '#1a237e',
        link: this.newMsg.link || undefined,
        active: this.newMsg.active ?? true,
        createdBy: this.currentUid,
      });
      this.newMsg = { title: '', body: '', icon: 'new_releases', iconColor: '#1a237e', link: '', active: true };
      this.snackBar.open('Mensagem publicada!', 'OK', { duration: 3000 });
      this.adminMessages = await this.msgSvc.getAllByCompany(this.authSvc.currentUser?.companyId ?? '');
    } finally { this.savingMsg = false; }
  }

  async toggleMsgActive(msg: AppMessage): Promise<void> {
    if (!msg.id) return;
    await this.msgSvc.update(msg.id, { active: !msg.active });
    msg.active = !msg.active;
    this.snackBar.open(msg.active ? 'Mensagem ativada.' : 'Mensagem desativada.', 'OK', { duration: 3000 });
  }

  async deleteMessage(msg: AppMessage): Promise<void> {
    if (!msg.id || !confirm('Excluir esta mensagem?')) return;
    await this.msgSvc.delete(msg.id);
    this.adminMessages = this.adminMessages.filter(m => m.id !== msg.id);
    this.snackBar.open('Mensagem excluída.', 'OK', { duration: 3000 });
  }

  // ── Formatação ────────────────────────────────────────────

  formatDate(date: Date | unknown): string {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(String(date));
    return d.toLocaleDateString('pt-BR');
  }

  formatDateTime(date: Date | unknown): string {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(String(date));
    return d.toLocaleString('pt-BR');
  }

  truncateUA(ua: string | undefined): string {
    if (!ua) return '—';
    const match = ua.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/);
    return match ? match[0] : ua.slice(0, 30) + '...';
  }

  getActionClass(action: string): string {
    const map: Record<string, string> = { LOGIN: 'action-chip chip-login', LOGOUT: 'action-chip chip-logout', REGISTER: 'action-chip chip-register' };
    return map[action] ?? 'action-chip chip-default';
  }
}
