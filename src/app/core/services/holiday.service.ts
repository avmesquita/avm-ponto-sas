import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, getDocs, doc,
  deleteDoc, query, where, orderBy, serverTimestamp, Timestamp
} from '@angular/fire/firestore';
import { Holiday } from '../models';

@Injectable({ providedIn: 'root' })
export class HolidayService {
  private readonly firestore: Firestore = inject(Firestore);

  // Retorna feriados nacionais + feriados da empresa
  async getHolidays(companyId: string): Promise<Holiday[]> {
    const [national, company] = await Promise.all([
      this.fetchByCompany(''),         // feriados nacionais (companyId = '')
      this.fetchByCompany(companyId),  // feriados da empresa
    ]);
    const map = new Map<string, Holiday>();
    for (const h of [...national, ...company]) map.set(h.date, h);
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  private async fetchByCompany(companyId: string): Promise<Holiday[]> {
    const q = query(
      collection(this.firestore, 'holidays'),
      where('companyId', '==', companyId),
      orderBy('date', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.map(d.id, d.data() as Record<string, unknown>));
  }

  async addHoliday(holiday: Omit<Holiday, 'id' | 'createdAt'>): Promise<Holiday> {
    const ref = await addDoc(collection(this.firestore, 'holidays'), {
      ...holiday, createdAt: serverTimestamp(),
    });
    return { ...holiday, id: ref.id, createdAt: new Date() };
  }

  async deleteHoliday(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'holidays', id));
  }

  private map(id: string, d: Record<string, unknown>): Holiday {
    return {
      id, companyId: (d['companyId'] as string) ?? '',
      date: d['date'] as string, name: d['name'] as string,
      national: (d['national'] as boolean) ?? false,
      hoursExpected: d['hoursExpected'] as number | undefined,
      createdBy: d['createdBy'] as string,
      createdAt: d['createdAt'] instanceof Timestamp ? d['createdAt'].toDate() : new Date(),
    };
  }
}
