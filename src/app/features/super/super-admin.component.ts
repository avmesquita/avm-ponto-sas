import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { PlanService } from '../../core/services/plan.service';
import { MessageService } from '../../core/services/message.service';
import { Company, Plan, CompanyStatus, AppMessage } from '../../core/models';

@Component({
  selector: 'app-super-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTableModule, MatTabsModule,
    MatChipsModule, MatTooltipModule, MatSnackBarModule, MatDividerModule, MatProgressBarModule],
  template: `
    <div class="super-page">
      <div class="super-header">
        <div class="super-brand">
          <mat-icon>admin_panel_settings</mat-icon>
          <span>SuperAdmin</span>
        </div>
        <button mat-button (click)="logout()">
          <mat-icon>logout</mat-icon> Sair
        </button>
      </div>

      <div class="super-content">
        <mat-tab-group>

          <!-- ═══ EMPRESAS ═══ -->
          <mat-tab label="Empresas">
            <div class="tab-pad">
              <mat-card class="form-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar>business</mat-icon>
                  <mat-card-title>Nova Empresa</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="company-form">
                    <mat-form-field appearance="outline">
                      <mat-label>Nome da empresa</mat-label>
                      <input matInput [(ngModel)]="newCompany.name" (ngModelChange)="autoSlug()">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Slug (URL)</mat-label>
                      <input matInput [(ngModel)]="newCompany.slug" placeholder="empresa-xpto">
                      <mat-hint>Acesso: /{{ newCompany.slug }}/login</mat-hint>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Plano</mat-label>
                      <mat-select [(ngModel)]="newCompany.planId" (ngModelChange)="onPlanChange()">
                        <mat-option *ngFor="let p of plans" [value]="p.id">
                          {{ p.name }} — {{ p.maxUsers }} usuários
                        </mat-option>
                      </mat-select>
                    </mat-form-field>
                    <button mat-raised-button color="primary"
                            [disabled]="!newCompany.name || !newCompany.slug || !newCompany.planId || savingCompany"
                            (click)="createCompany()">
                      <mat-icon>add</mat-icon> Criar empresa
                    </button>
                  </div>
                </mat-card-content>
              </mat-card>

              <mat-progress-bar *ngIf="loadingCompanies" mode="indeterminate"></mat-progress-bar>

              <table mat-table [dataSource]="companies" class="full-table" *ngIf="companies.length > 0">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Empresa</th>
                  <td mat-cell *matCellDef="let c">
                    <strong>{{ c.name }}</strong><br>
                    <small class="slug-link">/{{ c.slug }}/login</small>
                  </td>
                </ng-container>
                <ng-container matColumnDef="plan">
                  <th mat-header-cell *matHeaderCellDef>Plano</th>
                  <td mat-cell *matCellDef="let c">{{ c.planName }} ({{ c.maxUsers }} users)</td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let c">
                    <span class="status-chip" [class]="'s-' + c.status">{{ c.status }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let c">
                    <button mat-icon-button [matTooltip]="c.status === 'active' ? 'Suspender' : 'Ativar'"
                            (click)="toggleCompany(c)">
                      <mat-icon>{{ c.status === 'active' ? 'pause_circle' : 'play_circle' }}</mat-icon>
                    </button>
                    <a mat-icon-button [href]="'/' + c.slug + '/login'" target="_blank" matTooltip="Abrir login">
                      <mat-icon>open_in_new</mat-icon>
                    </a>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="companyColumns"></tr>
                <tr mat-row *matRowDef="let r; columns: companyColumns;"></tr>
              </table>
            </div>
          </mat-tab>

          <!-- ═══ PLANOS ═══ -->
          <mat-tab label="Planos">
            <div class="tab-pad">
              <mat-card class="form-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar>loyalty</mat-icon>
                  <mat-card-title>Novo Plano</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="plan-form">
                    <mat-form-field appearance="outline">
                      <mat-label>Nome</mat-label>
                      <input matInput [(ngModel)]="newPlan.name" placeholder="Starter">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Máx. usuários</mat-label>
                      <input matInput type="number" [(ngModel)]="newPlan.maxUsers">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Preço (R$ centavos)</mat-label>
                      <input matInput type="number" [(ngModel)]="newPlan.price">
                      <mat-hint>Ex: 9900 = R$ 99,00</mat-hint>
                    </mat-form-field>
                    <button mat-raised-button color="primary"
                            [disabled]="!newPlan.name || !newPlan.maxUsers || savingPlan"
                            (click)="createPlan()">
                      <mat-icon>add</mat-icon> Criar plano
                    </button>
                  </div>
                </mat-card-content>
              </mat-card>

              <table mat-table [dataSource]="plans" class="full-table" *ngIf="plans.length > 0">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Plano</th>
                  <td mat-cell *matCellDef="let p"><strong>{{ p.name }}</strong></td>
                </ng-container>
                <ng-container matColumnDef="maxUsers">
                  <th mat-header-cell *matHeaderCellDef>Máx. usuários</th>
                  <td mat-cell *matCellDef="let p">{{ p.maxUsers }}</td>
                </ng-container>
                <ng-container matColumnDef="price">
                  <th mat-header-cell *matHeaderCellDef>Preço</th>
                  <td mat-cell *matCellDef="let p">{{ formatPrice(p.price) }}</td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let p">
                    <button mat-icon-button color="warn" (click)="deletePlan(p)" matTooltip="Excluir">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="planColumns"></tr>
                <tr mat-row *matRowDef="let r; columns: planColumns;"></tr>
              </table>
            </div>
          </mat-tab>

          <!-- ═══ MENSAGENS GLOBAIS ═══ -->
          <mat-tab label="Mensagens Globais">
            <div class="tab-pad">
              <mat-card class="form-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar>campaign</mat-icon>
                  <mat-card-title>Nova Mensagem Global</mat-card-title>
                  <mat-card-subtitle>Enviada a todos os usuários de todas as empresas</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="msg-form">
                    <mat-form-field appearance="outline" class="full">
                      <mat-label>Título</mat-label>
                      <input matInput [(ngModel)]="newMsg.title">
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full">
                      <mat-label>Conteúdo</mat-label>
                      <textarea matInput [(ngModel)]="newMsg.body" rows="3"></textarea>
                    </mat-form-field>
                    <div class="msg-row">
                      <mat-form-field appearance="outline">
                        <mat-label>Ícone</mat-label>
                        <input matInput [(ngModel)]="newMsg.icon" placeholder="new_releases">
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="color-f">
                        <mat-label>Cor</mat-label>
                        <input matInput type="color" [(ngModel)]="newMsg.iconColor">
                      </mat-form-field>
                      <button mat-raised-button color="accent"
                              [disabled]="!newMsg.title || !newMsg.body || savingMsg"
                              (click)="createGlobalMsg()">
                        <mat-icon>send</mat-icon> Publicar
                      </button>
                    </div>
                  </div>
                  <mat-divider style="margin:16px 0"></mat-divider>
                  <div *ngFor="let m of globalMessages" class="msg-item">
                    <mat-icon [style.color]="m.iconColor || '#1a237e'">{{ m.icon || 'campaign' }}</mat-icon>
                    <div class="msg-info">
                      <strong>{{ m.title }}</strong>
                      <small>{{ m.body | slice:0:60 }}…</small>
                    </div>
                    <button mat-icon-button color="warn" (click)="deleteMsg(m)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

        </mat-tab-group>
      </div>
    </div>
  `,
  styles: [`
    .super-page { min-height: 100vh; background: #f5f5f5; }
    .super-header { background: #212121; color: white; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; height: 56px; }
    .super-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; }
    .super-brand mat-icon { color: #ffb74d; }
    .super-header button { color: rgba(255,255,255,0.7); }
    .super-content { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .tab-pad { padding-top: 20px; }
    .form-card { margin-bottom: 24px; }
    .company-form, .plan-form { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start; padding-top: 8px; }
    .company-form mat-form-field, .plan-form mat-form-field { min-width: 180px; }
    .full-table { width: 100%; }
    .slug-link { color: #1a237e; font-size: 11px; }
    .status-chip { border-radius: 12px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
    .s-active { background: #e8f5e9; color: #2e7d32; }
    .s-trial  { background: #fff8e1; color: #f9a825; }
    .s-suspended { background: #ffebee; color: #c62828; }
    .msg-form { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }
    .msg-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
    .color-f { width: 100px; }
    .full { width: 100%; }
    .msg-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .msg-info { flex: 1; display: flex; flex-direction: column; }
    .msg-info small { color: #999; font-size: 12px; }
    @media (max-width: 600px) { .super-content { padding: 12px; } }
  `]
})
export class SuperAdminComponent implements OnInit {
  private readonly authSvc = inject(AuthService);
  private readonly companySvc = inject(CompanyService);
  private readonly planSvc = inject(PlanService);
  private readonly msgSvc = inject(MessageService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  companies: Company[] = [];
  plans: Plan[] = [];
  globalMessages: AppMessage[] = [];
  loadingCompanies = false;
  savingCompany = false; savingPlan = false; savingMsg = false;

  companyColumns = ['name', 'plan', 'status', 'actions'];
  planColumns = ['name', 'maxUsers', 'price', 'actions'];

  newCompany: Partial<Company> = { name: '', slug: '', planId: '' };
  newPlan: Partial<Plan> = { name: '', maxUsers: 10, price: 0, currency: 'BRL', active: true };
  newMsg: Partial<AppMessage> = { title: '', body: '', icon: 'new_releases', iconColor: '#1a237e' };

  async ngOnInit(): Promise<void> {
    this.loadingCompanies = true;
    try {
      [this.companies, this.plans, this.globalMessages] = await Promise.all([
        this.companySvc.getAll(),
        this.planSvc.getAll(),
        this.msgSvc.getAllGlobal(),
      ]);
    } finally { this.loadingCompanies = false; }
  }

  autoSlug(): void {
    this.newCompany.slug = (this.newCompany.name ?? '')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  onPlanChange(): void {
    const plan = this.plans.find(p => p.id === this.newCompany.planId);
    if (plan) { this.newCompany.maxUsers = plan.maxUsers; this.newCompany.planName = plan.name; }
  }

  async createCompany(): Promise<void> {
    if (!this.newCompany.name || !this.newCompany.slug || !this.newCompany.planId) return;
    this.savingCompany = true;
    try {
      const c = await this.companySvc.create({
        name: this.newCompany.name!, slug: this.newCompany.slug!,
        planId: this.newCompany.planId!, planName: this.newCompany.planName,
        maxUsers: this.newCompany.maxUsers ?? 10,
        status: CompanyStatus.TRIAL, createdBy: this.authSvc.currentUser!.uid,
      });
      this.companies = [...this.companies, c];
      this.newCompany = { name: '', slug: '', planId: '' };
      this.snackBar.open('Empresa criada!', 'OK', { duration: 3000 });
    } finally { this.savingCompany = false; }
  }

  async toggleCompany(c: Company): Promise<void> {
    const newStatus = c.status === CompanyStatus.ACTIVE ? CompanyStatus.SUSPENDED : CompanyStatus.ACTIVE;
    await this.companySvc.update(c.id!, { status: newStatus });
    c.status = newStatus;
  }

  async createPlan(): Promise<void> {
    if (!this.newPlan.name) return;
    this.savingPlan = true;
    try {
      const p = await this.planSvc.create(this.newPlan as Omit<Plan, 'id' | 'createdAt'>);
      this.plans = [...this.plans, p];
      this.newPlan = { name: '', maxUsers: 10, price: 0, currency: 'BRL', active: true };
      this.snackBar.open('Plano criado!', 'OK', { duration: 3000 });
    } finally { this.savingPlan = false; }
  }

  async deletePlan(p: Plan): Promise<void> {
    if (!confirm(`Excluir plano "${p.name}"?`)) return;
    await this.planSvc.delete(p.id!);
    this.plans = this.plans.filter(x => x.id !== p.id);
  }

  async createGlobalMsg(): Promise<void> {
    if (!this.newMsg.title || !this.newMsg.body) return;
    this.savingMsg = true;
    try {
      const m = await this.msgSvc.create({
        companyId: '', title: this.newMsg.title!, body: this.newMsg.body!,
        icon: this.newMsg.icon, iconColor: this.newMsg.iconColor,
        active: true, createdBy: this.authSvc.currentUser!.uid,
      });
      this.globalMessages = [m, ...this.globalMessages];
      this.newMsg = { title: '', body: '', icon: 'new_releases', iconColor: '#1a237e' };
      this.snackBar.open('Mensagem publicada!', 'OK', { duration: 3000 });
    } finally { this.savingMsg = false; }
  }

  async deleteMsg(m: AppMessage): Promise<void> {
    if (!confirm('Excluir mensagem?')) return;
    await this.msgSvc.delete(m.id!);
    this.globalMessages = this.globalMessages.filter(x => x.id !== m.id);
  }

  formatPrice(cents: number): string {
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  }

  async logout(): Promise<void> { await this.authSvc.logout(); }
}
