import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, getDocs, doc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, Timestamp
} from '@angular/fire/firestore';
import { Plan } from '../models';

@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly firestore: Firestore = inject(Firestore);

  async getAll(): Promise<Plan[]> {
    const q = query(collection(this.firestore, 'plans'), orderBy('price', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => this.map(d.id, d.data() as Record<string, unknown>));
  }

  async getActive(): Promise<Plan[]> {
    const q = query(
      collection(this.firestore, 'plans'),
      where('active', '==', true),
      orderBy('price', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.map(d.id, d.data() as Record<string, unknown>));
  }

  async create(plan: Omit<Plan, 'id' | 'createdAt'>): Promise<Plan> {
    const ref = await addDoc(collection(this.firestore, 'plans'), {
      ...plan, createdAt: serverTimestamp(),
    });
    return { ...plan, id: ref.id, createdAt: new Date() };
  }

  async update(id: string, data: Partial<Plan>): Promise<void> {
    await updateDoc(doc(this.firestore, 'plans', id), { ...data });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'plans', id));
  }

  private map(id: string, d: Record<string, unknown>): Plan {
    return {
      id,
      name: d['name'] as string,
      maxUsers: d['maxUsers'] as number,
      price: d['price'] as number,
      currency: (d['currency'] as string) ?? 'BRL',
      active: (d['active'] as boolean) ?? true,
      createdAt: d['createdAt'] instanceof Timestamp ? d['createdAt'].toDate() : new Date(),
    };
  }
}
