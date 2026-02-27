import { Routes } from '@angular/router';
import { authGuard, guestGuard, adminGuard, superAdminGuard } from './core/guards/auth.guard';

export const routes: Routes = [

  // Raiz — redireciona para super login
  { path: '', redirectTo: 'super/login', pathMatch: 'full' },

  // ── SuperAdmin ──────────────────────────────────────────────
  {
    path: 'super/login',
    loadComponent: () => import('./features/super/super-login.component').then(m => m.SuperLoginComponent)
  },
  {
    path: 'super',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./features/super/super-admin.component').then(m => m.SuperAdminComponent)
  },

  // ── Empresa via slug ────────────────────────────────────────
  {
    path: ':slug',
    children: [
      // Público
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/company-login.component').then(m => m.CompanyLoginComponent)
      },
      {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent)
      },
      {
        path: 'invite/:token',
        loadComponent: () => import('./features/auth/accept-invite.component').then(m => m.AcceptInviteComponent)
      },
      {
        path: 'pending',
        loadComponent: () => import('./features/auth/pending.component').then(m => m.PendingComponent)
      },

      // Autenticado
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        canActivate: [authGuard],
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'timesheet',
        canActivate: [authGuard],
        loadComponent: () => import('./features/timesheet/timesheet.component').then(m => m.TimesheetComponent)
      },
      {
        path: 'absences',
        canActivate: [authGuard],
        loadComponent: () => import('./features/absences/absences.component').then(m => m.AbsencesComponent)
      },
      {
        path: 'reports',
        canActivate: [authGuard],
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent)
      },
      // Admin da empresa
      {
        path: 'holidays',
        canActivate: [authGuard, adminGuard],
        loadComponent: () => import('./features/holidays/holidays.component').then(m => m.HolidaysComponent)
      },
      {
        path: 'admin',
        canActivate: [authGuard, adminGuard],
        loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent)
      },
    ]
  },

  { path: '**', redirectTo: 'super/login' }
];
