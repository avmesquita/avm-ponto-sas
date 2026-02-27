import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, getDocs, doc,
  updateDoc, query, where, serverTimestamp, Timestamp
} from '@angular/fire/firestore';
import { Invite, InviteStatus } from '../models';

@Injectable({ providedIn: 'root' })
export class InviteService {
  private readonly firestore: Firestore = inject(Firestore);

  async create(invite: Omit<Invite, 'id' | 'createdAt' | 'status'>): Promise<Invite> {
    const ref = await addDoc(collection(this.firestore, 'invites'), {
      ...invite,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return { ...invite, id: ref.id, status: 'pending', createdAt: new Date() };
  }

  // Gera token UUID simples (sem dependências externas)
  generateToken(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  async getByToken(token: string): Promise<Invite | null> {
    const q = query(collection(this.firestore, 'invites'), where('token', '==', token));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0]!;
    return this.map(d.id, d.data() as Record<string, unknown>);
  }

  async getByCompany(companyId: string): Promise<Invite[]> {
    const q = query(
      collection(this.firestore, 'invites'),
      where('companyId', '==', companyId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.map(d.id, d.data() as Record<string, unknown>));
  }

  async accept(inviteId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'invites', inviteId), {
      status: 'accepted' as InviteStatus,
      acceptedAt: serverTimestamp(),
    });
  }

  async revoke(inviteId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'invites', inviteId), {
      status: 'expired' as InviteStatus,
    });
  }

  isValid(invite: Invite): boolean {
    return invite.status === 'pending' && new Date() < invite.expiresAt;
  }

  private map(id: string, d: Record<string, unknown>): Invite {
    return {
      id,
      companyId: d['companyId'] as string,
      companySlug: d['companySlug'] as string,
      companyName: d['companyName'] as string,
      email: d['email'] as string,
      token: d['token'] as string,
      status: d['status'] as InviteStatus,
      createdBy: d['createdBy'] as string,
      createdAt: d['createdAt'] instanceof Timestamp ? d['createdAt'].toDate() : new Date(),
      expiresAt: d['expiresAt'] instanceof Timestamp ? d['expiresAt'].toDate() : new Date(),
      acceptedAt: d['acceptedAt'] instanceof Timestamp ? d['acceptedAt'].toDate() : undefined,
    };
  }
}
