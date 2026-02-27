import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole, UserStatus } from '../models';
import { map, filter, take } from 'rxjs/operators';

// Usuário autenticado e ativo
export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authSvc = inject(AuthService);
  const router = inject(Router);
  const slug = route.params['slug'] as string | undefined;

  return authSvc.loading$.pipe(
    filter(l => !l), take(1),
    map(() => {
      const user = authSvc.currentUser;
      if (!user) {
        router.navigate([slug ? `/${slug}/login` : '/']);
        return false;
      }
      if (user.status === UserStatus.PENDING) {
        router.navigate([slug ? `/${slug}/pending` : '/pending']);
        return false;
      }
      if (user.status === UserStatus.SUSPENDED) {
        router.navigate([slug ? `/${slug}/login` : '/']);
        return false;
      }
      return true;
    })
  );
};

// CompanyAdmin ou SuperAdmin
export const adminGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authSvc = inject(AuthService);
  const router = inject(Router);
  const slug = route.params['slug'] as string | undefined;

  return authSvc.loading$.pipe(
    filter(l => !l), take(1),
    map(() => {
      if (authSvc.isAdmin()) return true;
      router.navigate([slug ? `/${slug}/dashboard` : '/']);
      return false;
    })
  );
};

// Apenas SuperAdmin
export const superAdminGuard: CanActivateFn = () => {
  const authSvc = inject(AuthService);
  const router = inject(Router);

  return authSvc.loading$.pipe(
    filter(l => !l), take(1),
    map(() => {
      if (authSvc.isSuperAdmin()) return true;
      router.navigate(['/']);
      return false;
    })
  );
};

// Não autenticado (para páginas de login)
export const guestGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authSvc = inject(AuthService);
  const router = inject(Router);
  const slug = route.params['slug'] as string | undefined;

  return authSvc.loading$.pipe(
    filter(l => !l), take(1),
    map(() => {
      const user = authSvc.currentUser;
      if (!user) return true;
      if (user.status === UserStatus.PENDING) {
        router.navigate([slug ? `/${slug}/pending` : '/pending']);
        return false;
      }
      const target = slug ?? user.companySlug;
      router.navigate([target ? `/${target}/dashboard` : '/']);
      return false;
    })
  );
};
