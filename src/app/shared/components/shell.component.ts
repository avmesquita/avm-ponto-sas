import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../core/services/auth.service';
import { MessageService } from '../../core/services/message.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppMessage } from '../../core/models';

const MOBILE_BREAKPOINT = 768;

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    MatSidenavModule, MatToolbarModule, MatListModule,
    MatIconModule, MatButtonModule, MatDividerModule,
    MatChipsModule, MatTooltipModule, MatBadgeModule,
  ],
  template: `
    <mat-sidenav-container class="sidenav-container">

      <!-- ── Sidenav principal ─────────────────────────────── -->
      <mat-sidenav class="sidenav" fixedInViewport
                   [mode]="isMobile ? 'over' : 'side'"
                   [opened]="sidenavOpen">

        <button mat-icon-button class="close-btn" *ngIf="isMobile" (click)="sidenavOpen = false">
          <mat-icon>close</mat-icon>
        </button>

        <div class="sidenav-header">
          <mat-icon class="brand-icon">schedule</mat-icon>
          <span class="brand-name">PontoApp</span>
        </div>

        <mat-nav-list>
          <a mat-list-item [routerLink]="['/' + slug + '/dashboard']" routerLinkActive="active-link" (click)="onNavClick()">
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </a>
          <a mat-list-item [routerLink]="['/' + slug + '/timesheet']" routerLinkActive="active-link" (click)="onNavClick()">
            <mat-icon matListItemIcon>fingerprint</mat-icon>
            <span matListItemTitle>Registrar Ponto</span>
          </a>
          <a mat-list-item [routerLink]="['/' + slug + '/absences']" routerLinkActive="active-link" (click)="onNavClick()">
            <mat-icon matListItemIcon>event_busy</mat-icon>
            <span matListItemTitle>Ausências</span>
          </a>
          <a mat-list-item [routerLink]="['/' + slug + '/reports']" routerLinkActive="active-link" (click)="onNavClick()">
            <mat-icon matListItemIcon>assessment</mat-icon>
            <span matListItemTitle>Relatórios</span>
          </a>

          <mat-divider *ngIf="isAdmin"></mat-divider>
          <ng-container *ngIf="isAdmin">
            <div class="nav-section-title">Administração</div>
            <a mat-list-item [routerLink]="['/' + slug + '/holidays']" routerLinkActive="active-link" (click)="onNavClick()">
              <mat-icon matListItemIcon>event</mat-icon>
              <span matListItemTitle>Feriados</span>
            </a>
            <a mat-list-item [routerLink]="['/' + slug + '/admin']" routerLinkActive="active-link" (click)="onNavClick()">
              <mat-icon matListItemIcon>manage_accounts</mat-icon>
              <span matListItemTitle>Usuários</span>
            </a>
          </ng-container>
        </mat-nav-list>

        <div class="sidenav-footer">
          <div class="user-info" *ngIf="currentUser$ | async as user">
            <img [src]="user.photoURL || 'https://ui-avatars.com/api/?name=' + user.displayName"
                 class="avatar" [alt]="user.displayName">
            <div class="user-details">
              <span class="user-name">{{ user.displayName }}</span>
              <span class="role-badge" [class.admin-badge]="user.role === 'Admin'">{{ user.role }}</span>
            </div>
          </div>
          <button mat-icon-button (click)="logout()" matTooltip="Sair">
            <mat-icon>logout</mat-icon>
          </button>
        </div>
      </mat-sidenav>

      <!-- ── Conteúdo principal ─────────────────────────────── -->
      <mat-sidenav-content class="content-area">
        <mat-toolbar color="primary" class="top-toolbar">
          <button mat-icon-button class="menu-btn" (click)="sidenavOpen = !sidenavOpen"
                  [class.hidden-desktop]="!isMobile">
            <mat-icon>{{ sidenavOpen && !isMobile ? 'menu_open' : 'menu' }}</mat-icon>
          </button>
          <span class="page-title">{{ getPageTitle() }}</span>
          <span class="flex-spacer"></span>

          <!-- Botão de notificação push (pede permissão) -->
          <button mat-icon-button
                  *ngIf="notifSupported && notifPermission !== 'granted'"
                  (click)="requestNotifPermission()"
                  matTooltip="Ativar notificações">
            <mat-icon>notifications_off</mat-icon>
          </button>

          <!-- Sino de mensagens -->
          <button mat-icon-button (click)="toggleMessages()" matTooltip="Mensagens"
                  [matBadge]="unreadCount || null"
                  matBadgeColor="warn"
                  matBadgeSize="small">
            <mat-icon>{{ messagesOpen ? 'notifications_active' : 'notifications' }}</mat-icon>
          </button>
        </mat-toolbar>

        <!-- ── Painel de mensagens (drawer inline) ──────────── -->
        <div class="messages-overlay" *ngIf="messagesOpen" (click)="messagesOpen = false"></div>
        <div class="messages-drawer" [class.open]="messagesOpen">
          <div class="drawer-header">
            <span>Mensagens</span>
            <div class="drawer-actions">
              <button mat-button *ngIf="unreadCount > 0" (click)="markAllRead()" class="mark-all-btn">
                Marcar todas como lidas
              </button>
              <button mat-icon-button (click)="messagesOpen = false">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <div class="messages-list" *ngIf="messages.length > 0">
            <div *ngFor="let msg of messages"
                 class="message-item"
                 [class.unread]="!readIds.has(msg.id!)"
                 (click)="openMessage(msg)">
              <div class="msg-icon-wrap" [style.background]="(msg.iconColor || '#1a237e') + '18'">
                <mat-icon [style.color]="msg.iconColor || '#1a237e'">
                  {{ msg.icon || 'campaign' }}
                </mat-icon>
              </div>
              <div class="msg-body">
                <div class="msg-title">{{ msg.title }}</div>
                <div class="msg-preview">{{ msg.body | slice:0:80 }}{{ msg.body.length > 80 ? '…' : '' }}</div>
                <div class="msg-date">{{ formatDate(msg.publishedAt) }}</div>
              </div>
              <div class="unread-dot" *ngIf="!readIds.has(msg.id!)"></div>
            </div>
          </div>

          <div class="messages-empty" *ngIf="messages.length === 0">
            <mat-icon>mark_email_read</mat-icon>
            <p>Nenhuma mensagem.</p>
          </div>
        </div>

        <!-- Mensagem expandida -->
        <div class="message-modal-overlay" *ngIf="openedMessage" (click)="openedMessage = null"></div>
        <div class="message-modal" *ngIf="openedMessage">
          <div class="modal-header">
            <div class="modal-icon-wrap" [style.background]="(openedMessage.iconColor || '#1a237e') + '18'">
              <mat-icon [style.color]="openedMessage.iconColor || '#1a237e'" class="modal-icon">
                {{ openedMessage.icon || 'campaign' }}
              </mat-icon>
            </div>
            <div class="modal-title-wrap">
              <h3>{{ openedMessage.title }}</h3>
              <span class="modal-date">{{ formatDate(openedMessage.publishedAt) }}</span>
            </div>
            <button mat-icon-button (click)="openedMessage = null"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body">{{ openedMessage.body }}</div>
          <div class="modal-footer" *ngIf="openedMessage.link">
            <button mat-raised-button color="primary" (click)="navigateMessage(openedMessage)">
              <mat-icon>arrow_forward</mat-icon> Acessar
            </button>
          </div>
        </div>

        <div class="page-content">
          <ng-content></ng-content>
        </div>
      </mat-sidenav-content>

    </mat-sidenav-container>
  `,
  styles: [`
    .sidenav-container { height: 100vh; }
    .sidenav { width: 260px; background: #1a237e; color: white; display: flex; flex-direction: column; }
    .close-btn { position: absolute; top: 8px; right: 8px; z-index: 1; color: rgba(255,255,255,0.7) !important; }
    .sidenav-header { padding: 24px 16px 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.15); }
    .brand-icon { font-size: 32px; width: 32px; height: 32px; color: #90caf9; }
    .brand-name { font-size: 20px; font-weight: 700; color: white; }
    mat-nav-list { flex: 1; padding-top: 8px; overflow-y: auto; }
    ::ng-deep .sidenav mat-nav-list a { color: rgba(255,255,255,0.8); border-radius: 8px; margin: 2px 8px; }
    ::ng-deep .sidenav mat-nav-list a:hover { background: rgba(255,255,255,0.1); color: white; }
    ::ng-deep .sidenav mat-nav-list a.active-link { background: rgba(144,202,249,0.2); color: #90caf9; }
    ::ng-deep .sidenav mat-icon { color: rgba(255,255,255,0.7); }
    ::ng-deep .sidenav mat-nav-list a.active-link mat-icon { color: #90caf9; }
    .nav-section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.4); padding: 12px 16px 4px; }
    .sidenav-footer { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; gap: 8px; }
    .user-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); }
    .user-details { display: flex; flex-direction: column; min-width: 0; }
    .user-name { font-size: 13px; color: white; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .role-badge { font-size: 10px; padding: 1px 6px; border-radius: 8px; background: rgba(144,202,249,0.3); color: #90caf9; width: fit-content; }
    .admin-badge { background: rgba(255,183,77,0.3); color: #ffb74d; }
    ::ng-deep .sidenav mat-icon[matlistitemicon] { color: rgba(255,255,255,0.7) !important; }
    ::ng-deep .sidenav button mat-icon { color: rgba(255,255,255,0.7) !important; }

    .content-area { background: #f5f5f5; position: relative; }
    .top-toolbar { position: sticky; top: 0; z-index: 100; }
    .menu-btn { margin-right: 8px; }
    .hidden-desktop { display: none; }
    .page-title { font-weight: 500; }
    .flex-spacer { flex: 1; }
    .page-content { padding: 24px; min-height: calc(100vh - 64px); box-sizing: border-box; }

    /* ── Messages drawer ─────────────────────────────────── */
    .messages-overlay {
      position: fixed; inset: 0; z-index: 199;
      background: rgba(0,0,0,0.3);
    }
    .messages-drawer {
      position: fixed; top: 64px; right: 0; bottom: 0;
      width: 360px; max-width: 100vw;
      background: white; z-index: 200;
      box-shadow: -4px 0 24px rgba(0,0,0,0.15);
      transform: translateX(100%); transition: transform 0.25s ease;
      display: flex; flex-direction: column;
    }
    .messages-drawer.open { transform: translateX(0); }
    .drawer-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 16px 12px; border-bottom: 1px solid #e0e0e0;
      font-size: 17px; font-weight: 700; color: #1a237e;
    }
    .drawer-actions { display: flex; align-items: center; gap: 4px; }
    .mark-all-btn { font-size: 11px; color: #1a237e; }
    .messages-list { flex: 1; overflow-y: auto; padding: 8px 0; }
    .message-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 12px 16px; cursor: pointer; position: relative;
      border-bottom: 1px solid #f5f5f5; transition: background 0.15s;
    }
    .message-item:hover { background: #f8f9ff; }
    .message-item.unread { background: #e8eaf6; }
    .message-item.unread:hover { background: #dde0f0; }
    .msg-icon-wrap { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .msg-icon-wrap mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .msg-body { flex: 1; min-width: 0; }
    .msg-title { font-weight: 600; font-size: 14px; color: #1a237e; margin-bottom: 2px; }
    .msg-preview { font-size: 12px; color: #666; line-height: 1.4; margin-bottom: 4px; }
    .msg-date { font-size: 11px; color: #aaa; }
    .unread-dot { width: 8px; height: 8px; border-radius: 50%; background: #1a237e; flex-shrink: 0; margin-top: 6px; }
    .messages-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; color: #bbb; padding: 40px; }
    .messages-empty mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }

    /* ── Message modal ───────────────────────────────────── */
    .message-modal-overlay { position: fixed; inset: 0; z-index: 299; background: rgba(0,0,0,0.4); }
    .message-modal {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: min(480px, 92vw); background: white; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.2); z-index: 300;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .modal-header { display: flex; align-items: center; gap: 12px; padding: 20px 20px 12px; border-bottom: 1px solid #f0f0f0; }
    .modal-icon-wrap { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .modal-icon { font-size: 28px; width: 28px; height: 28px; }
    .modal-title-wrap { flex: 1; }
    .modal-title-wrap h3 { margin: 0 0 2px; font-size: 17px; color: #1a237e; }
    .modal-date { font-size: 12px; color: #aaa; }
    .modal-body { padding: 16px 20px; font-size: 15px; line-height: 1.7; color: #333; white-space: pre-wrap; max-height: 60vh; overflow-y: auto; }
    .modal-footer { padding: 12px 20px 16px; display: flex; justify-content: flex-end; border-top: 1px solid #f0f0f0; }

    @media (max-width: 768px) {
      .hidden-desktop { display: inline-flex !important; }
      .page-content { padding: 16px; }
      .messages-drawer { width: 100vw; top: 56px; }
    }
  `]
})
export class ShellComponent implements OnInit {
  private readonly authSvc: AuthService = inject(AuthService);
  private readonly msgSvc: MessageService = inject(MessageService);
  private readonly notifSvc: NotificationService = inject(NotificationService);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  readonly currentUser$ = this.authSvc.currentUser$;

  // Layout
  isMobile = false;
  sidenavOpen = true;
  slug = '';

  // Mensagens
  messages: AppMessage[] = [];
  readIds = new Set<string>();
  messagesOpen = false;
  openedMessage: AppMessage | null = null;

  get isAdmin(): boolean { return this.authSvc.isAdmin(); }
  get unreadCount(): number { return this.messages.filter(m => !this.readIds.has(m.id!)).length; }
  get notifSupported(): boolean { return this.notifSvc.supported; }
  get notifPermission(): NotificationPermission { return this.notifSvc.permission; }

  async ngOnInit(): Promise<void> {
    this.checkViewport();
    this.slug = this.route.snapshot.params['slug'] ?? '';
    await this.loadMessages();
  }

  @HostListener('window:resize')
  onResize(): void { this.checkViewport(); }

  private checkViewport(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (wasMobile !== this.isMobile) this.sidenavOpen = !this.isMobile;
  }

  onNavClick(): void { if (this.isMobile) this.sidenavOpen = false; }

  async requestNotifPermission(): Promise<void> {
    await this.notifSvc.requestPermission();
  }

  // ── Mensagens ─────────────────────────────────────────────

  async loadMessages(): Promise<void> {
    const uid = this.authSvc.currentUser?.uid;
    if (!uid) return;
    try {
      const [msgs, readIds] = await Promise.all([
        this.msgSvc.getActiveMessages(this.authSvc.currentUser?.companyId ?? ''),
        this.msgSvc.getReadIds(uid),
      ]);
      this.messages = msgs;
      this.readIds = readIds;
    } catch { /* silencioso */ }
  }

  async toggleMessages(): Promise<void> {
    this.messagesOpen = !this.messagesOpen;
    if (this.messagesOpen) await this.loadMessages();
  }

  async openMessage(msg: AppMessage): Promise<void> {
    this.openedMessage = msg;
    if (!this.readIds.has(msg.id!)) {
      const uid = this.authSvc.currentUser?.uid;
      if (uid) {
        await this.msgSvc.markAsRead(uid, msg.id!);
        this.readIds = new Set([...this.readIds, msg.id!]);
      }
    }
  }

  async markAllRead(): Promise<void> {
    const uid = this.authSvc.currentUser?.uid;
    if (!uid) return;
    const unreadIds = this.messages.filter(m => !this.readIds.has(m.id!)).map(m => m.id!);
    await this.msgSvc.markAllAsRead(uid, unreadIds);
    this.readIds = new Set(this.messages.map(m => m.id!));
  }

  navigateMessage(msg: AppMessage): void {
    this.openedMessage = null;
    this.messagesOpen = false;
    if (msg.link) this.router.navigateByUrl(msg.link);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  async logout(): Promise<void> { await this.authSvc.logout(); }

  getPageTitle(): string {
    const url = this.router.url;
    if (url.includes('dashboard')) return 'Dashboard';
    if (url.includes('timesheet')) return 'Registrar Ponto';
    if (url.includes('absences')) return 'Ausências';
    if (url.includes('reports')) return 'Relatórios';
    if (url.includes('holidays')) return 'Feriados';
    if (url.includes('admin')) return 'Administração';
    if (url.includes('absences')) return 'Ausências';
    return 'PontoApp';
  }
}
