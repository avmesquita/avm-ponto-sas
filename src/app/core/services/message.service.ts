import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, getDocs, doc, updateDoc,
  deleteDoc, query, where, orderBy, serverTimestamp, Timestamp, setDoc
} from '@angular/fire/firestore';
import { AppMessage } from '../models';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly firestore: Firestore = inject(Firestore);

  // Mensagens ativas da empresa + mensagens globais (companyId = '')
  async getActiveMessages(companyId: string): Promise<AppMessage[]> {
    const [company, global] = await Promise.all([
      this.fetchActive(companyId),
      this.fetchActive(''),
    ]);
    return [...global, ...company].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  private async fetchActive(companyId: string): Promise<AppMessage[]> {
    const q = query(
      collection(this.firestore, 'saasMessages'),
      where('companyId', '==', companyId),
      where('active', '==', true),
      orderBy('publishedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.map(d.id, d.data() as Record<string, unknown>));
  }

  async getAllByCompany(companyId: string): Promise<AppMessage[]> {
    const q = query(
      collection(this.firestore, 'saasMessages'),
      where('companyId', '==', companyId),
      orderBy('publishedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.map(d.id, d.data() as Record<string, unknown>));
  }

  async getAllGlobal(): Promise<AppMessage[]> {
    return this.getAllByCompany('');
  }

  async create(msg: Omit<AppMessage, 'id' | 'publishedAt'>): Promise<AppMessage> {
    const ref = await addDoc(collection(this.firestore, 'saasMessages'), {
      ...msg, icon: msg.icon ?? null, iconColor: msg.iconColor ?? null,
      link: msg.link ?? null, publishedAt: serverTimestamp(),
    });
    return { ...msg, id: ref.id, publishedAt: new Date() };
  }

  async update(id: string, data: Partial<AppMessage>): Promise<void> {
    await updateDoc(doc(this.firestore, 'saasMessages', id), {
      ...data, icon: data.icon ?? null, iconColor: data.iconColor ?? null, link: data.link ?? null,
    });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'saasMessages', id));
  }

  async getReadIds(userId: string): Promise<Set<string>> {
    const q = query(collection(this.firestore, 'saasMessageReads'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return new Set(snap.docs.map(d => (d.data() as Record<string,unknown>)['messageId'] as string));
  }

  async markAsRead(userId: string, messageId: string): Promise<void> {
    await setDoc(doc(this.firestore, 'saasMessageReads', `${userId}_${messageId}`), {
      userId, messageId, readAt: serverTimestamp(),
    });
  }

  async markAllAsRead(userId: string, messageIds: string[]): Promise<void> {
    await Promise.all(messageIds.map(mid => this.markAsRead(userId, mid)));
  }

  private map(id: string, d: Record<string, unknown>): AppMessage {
    return {
      id, companyId: (d['companyId'] as string) ?? '',
      title: d['title'] as string, body: d['body'] as string,
      icon: d['icon'] as string | undefined, iconColor: d['iconColor'] as string | undefined,
      link: d['link'] as string | undefined,
      publishedAt: d['publishedAt'] instanceof Timestamp ? d['publishedAt'].toDate() : new Date(),
      createdBy: d['createdBy'] as string, active: (d['active'] as boolean) ?? true,
    };
  }
}
