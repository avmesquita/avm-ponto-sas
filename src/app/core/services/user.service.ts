import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, getDocs, doc, updateDoc, getDoc,
  query, where, orderBy, serverTimestamp, Timestamp
} from '@angular/fire/firestore';
import { AppUser, UserRole, UserStatus } from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly firestore: Firestore = inject(Firestore);

  async getByCompany(companyId: string): Promise<AppUser[]> {
    const q = query(
      collection(this.firestore, 'saasUsers'),
      where('companyId', '==', companyId),
      orderBy('displayName', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.mapUser(d.id, d.data() as Record<string, unknown>));
  }

  async getPendingByCompany(companyId: string): Promise<AppUser[]> {
    const q = query(
      collection(this.firestore, 'saasUsers'),
      where('companyId', '==', companyId),
      where('status', '==', UserStatus.PENDING)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.mapUser(d.id, d.data() as Record<string, unknown>));
  }

  async getAllUsers(): Promise<AppUser[]> {
    const q = query(collection(this.firestore, 'saasUsers'), orderBy('displayName', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => this.mapUser(d.id, d.data() as Record<string, unknown>));
  }

  async getUserById(uid: string): Promise<AppUser | null> {
    const snap = await getDoc(doc(this.firestore, 'saasUsers', uid));
    if (!snap.exists()) return null;
    return this.mapUser(snap.id, snap.data() as Record<string, unknown>);
  }

  async updateRole(uid: string, role: UserRole): Promise<void> {
    await updateDoc(doc(this.firestore, 'saasUsers', uid), { role, updatedAt: serverTimestamp() });
  }

  async updateStatus(uid: string, status: UserStatus): Promise<void> {
    await updateDoc(doc(this.firestore, 'saasUsers', uid), { status, updatedAt: serverTimestamp() });
  }

  async updateWorkHours(uid: string, workHoursPerDay: number): Promise<void> {
    await updateDoc(doc(this.firestore, 'saasUsers', uid), { workHoursPerDay, updatedAt: serverTimestamp() });
  }

  private mapUser(id: string, d: Record<string, unknown>): AppUser {
    return {
      uid: id,
      email: d['email'] as string,
      displayName: d['displayName'] as string,
      photoURL: d['photoURL'] as string | undefined,
      role: d['role'] as UserRole,
      status: (d['status'] as UserStatus) ?? UserStatus.ACTIVE,
      companyId:      (d['companyId']      as string) ?? '',
      companySlug:    d['companySlug']    as string | undefined,
      companyCountry: (d['companyCountry'] as string | undefined) ?? 'BR',
      workHoursPerDay: (d['workHoursPerDay'] as number) ?? 8,
      createdAt: d['createdAt'] instanceof Timestamp ? d['createdAt'].toDate() : new Date(),
      updatedAt: d['updatedAt'] instanceof Timestamp ? d['updatedAt'].toDate() : new Date(),
    };
  }
}
