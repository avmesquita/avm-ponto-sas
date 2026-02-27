import { Injectable, inject } from '@angular/core';
import {
  Auth, GoogleAuthProvider, signInWithPopup, signOut,
  onAuthStateChanged, User, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, updateProfile
} from '@angular/fire/auth';
import {
  Firestore, doc, getDoc, setDoc, collection,
  addDoc, serverTimestamp, updateDoc
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AppUser, AuthLog, UserRole, UserStatus } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth = inject(Auth);
  private readonly firestore: Firestore = inject(Firestore);
  private readonly router: Router = inject(Router);

  private readonly currentUserSubject = new BehaviorSubject<AppUser | null>(null);
  public readonly currentUser$ = this.currentUserSubject.asObservable();

  private readonly loadingSubject = new BehaviorSubject<boolean>(true);
  public readonly loading$ = this.loadingSubject.asObservable();

  constructor() { this.initAuthListener(); }

  private initAuthListener(): void {
    onAuthStateChanged(this.auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const appUser = await this.loadUser(firebaseUser.uid);
        this.currentUserSubject.next(appUser);
      } else {
        this.currentUserSubject.next(null);
      }
      this.loadingSubject.next(false);
    });
  }

  // ── Login com Google ─────────────────────────────────────
  async loginWithGoogle(companyId: string, companySlug: string): Promise<AppUser> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);
    return this.handlePostLogin(result.user, companyId, companySlug);
  }

  // ── Login com email/senha ────────────────────────────────
  async loginWithEmail(email: string, password: string): Promise<AppUser> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    const appUser = await this.loadUser(result.user.uid);
    if (!appUser) throw new Error('Usuário não encontrado.');
    await this.logAuthAction(appUser, 'LOGIN');
    this.currentUserSubject.next(appUser);
    return appUser;
  }

  // ── Registro com email/senha ─────────────────────────────
  async registerWithEmail(
    email: string, password: string, displayName: string,
    companyId: string, companySlug: string
  ): Promise<AppUser> {
    const result = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(result.user, { displayName });
    return this.handlePostLogin(result.user, companyId, companySlug, displayName);
  }

  // ── Logout ───────────────────────────────────────────────
  async logout(): Promise<void> {
    const user = this.currentUserSubject.value;
    if (user) await this.logAuthAction(user, 'LOGOUT');
    const slug = user?.companySlug;
    await signOut(this.auth);
    this.currentUserSubject.next(null);
    if (user?.role === UserRole.SUPER_ADMIN) {
      this.router.navigate(['/super/login']);
    } else {
      this.router.navigate([slug ? `/${slug}/login` : '/']);
    }
  }

  // ── Getters ──────────────────────────────────────────────
  get currentUser(): AppUser | null { return this.currentUserSubject.value; }
  isSuperAdmin(): boolean { return this.currentUser?.role === UserRole.SUPER_ADMIN; }
  isCompanyAdmin(): boolean { return this.currentUser?.role === UserRole.COMPANY_ADMIN; }
  isAdmin(): boolean { return this.isSuperAdmin() || this.isCompanyAdmin(); }
  isActive(): boolean { return this.currentUser?.status === UserStatus.ACTIVE; }
  isPending(): boolean { return this.currentUser?.status === UserStatus.PENDING; }

  // ── Aprovar / suspender usuário ──────────────────────────
  async approveUser(uid: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), {
      status: UserStatus.ACTIVE, updatedAt: serverTimestamp()
    });
  }

  async suspendUser(uid: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), {
      status: UserStatus.SUSPENDED, updatedAt: serverTimestamp()
    });
  }

  // ── Internos ─────────────────────────────────────────────
  private async handlePostLogin(
    firebaseUser: User,
    companyId: string,
    companySlug: string,
    displayName?: string
  ): Promise<AppUser> {
    let appUser = await this.loadUser(firebaseUser.uid);
    if (!appUser) {
      appUser = await this.createUser(firebaseUser, companyId, companySlug, displayName);
      await this.logAuthAction(appUser, 'REGISTER');
    } else {
      await this.logAuthAction(appUser, 'LOGIN');
    }
    this.currentUserSubject.next(appUser);
    return appUser;
  }

  private async loadUser(uid: string): Promise<AppUser | null> {
    const snap = await getDoc(doc(this.firestore, 'users', uid));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    return {
      uid,
      email: d['email'] as string,
      displayName: d['displayName'] as string,
      photoURL: d['photoURL'] as string | undefined,
      role: d['role'] as UserRole,
      status: (d['status'] as UserStatus) ?? UserStatus.ACTIVE,
      companyId: (d['companyId'] as string) ?? '',
      companySlug: d['companySlug'] as string | undefined,
      workHoursPerDay: (d['workHoursPerDay'] as number) ?? 8,
      createdAt: d['createdAt']?.toDate?.() ?? new Date(),
      updatedAt: d['updatedAt']?.toDate?.() ?? new Date(),
    };
  }

  private async createUser(
    firebaseUser: User,
    companyId: string,
    companySlug: string,
    displayName?: string
  ): Promise<AppUser> {
    // Primeiro usuário da empresa vira CompanyAdmin
    const isFirstUser = await this.isFirstInCompany(companyId);
    const newUser: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      displayName: displayName ?? firebaseUser.displayName ?? 'Usuário',
      photoURL: firebaseUser.photoURL ?? undefined,
      role: isFirstUser ? UserRole.COMPANY_ADMIN : UserRole.USER,
      status: isFirstUser ? UserStatus.ACTIVE : UserStatus.PENDING,
      companyId,
      companySlug,
      workHoursPerDay: 8,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await setDoc(doc(this.firestore, 'users', firebaseUser.uid), {
      ...newUser,
      photoURL: newUser.photoURL ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newUser;
  }

  private async isFirstInCompany(companyId: string): Promise<boolean> {
    // Usa metadata por empresa para evitar query cara
    const ref = doc(this.firestore, 'metadata', `company_${companyId}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { initialized: true });
      return true;
    }
    return false;
  }

  private async logAuthAction(user: AppUser, action: AuthLog['action']): Promise<void> {
    await addDoc(collection(this.firestore, 'authLogs'), {
      companyId: user.companyId ?? null,
      userId: user.uid,
      email: user.email,
      displayName: user.displayName,
      action,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
    });
  }
}
