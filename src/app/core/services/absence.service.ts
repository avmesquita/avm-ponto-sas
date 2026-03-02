import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, getDocs, doc, updateDoc,
  deleteDoc, query, where, orderBy, serverTimestamp, Timestamp
} from '@angular/fire/firestore';
import { Absence, AbsenceStatus, AbsenceType } from '../models';

@Injectable({ providedIn: 'root' })
export class AbsenceService {
  private readonly firestore: Firestore = inject(Firestore);

  async getAbsenceTypes(companyId: string): Promise<AbsenceType[]> {
    const q = query(
      collection(this.firestore, 'saasAbsenceTypes'),
      where('companyId', '==', companyId),
      orderBy('name', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.mapType(d.id, d.data() as Record<string, unknown>));
  }

  async addAbsenceType(type: Omit<AbsenceType, 'id' | 'createdAt'>): Promise<AbsenceType> {
    const ref = await addDoc(collection(this.firestore, 'saasAbsenceTypes'), {
      ...type, createdAt: serverTimestamp(),
    });
    return { ...type, id: ref.id, createdAt: new Date() };
  }

  async deleteAbsenceType(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'saasAbsenceTypes', id));
  }

  async requestAbsence(absence: Omit<Absence, 'id' | 'requestedAt' | 'status'>): Promise<Absence> {
    const ref = await addDoc(collection(this.firestore, 'saasAbsences'), {
      companyId: absence.companyId,
      userId: absence.userId,
      userDisplayName: absence.userDisplayName ?? null,
      absenceTypeId: absence.absenceTypeId,
      absenceTypeName: absence.absenceTypeName ?? null,
      absenceTypeColor: absence.absenceTypeColor ?? null,
      startDate: absence.startDate,
      endDate: absence.endDate,
      note: absence.note ?? null,
      status: 'pending',
      requestedAt: serverTimestamp(),
    });
    return { ...absence, id: ref.id, status: 'pending', requestedAt: new Date() };
  }

  async getAbsencesByUser(userId: string): Promise<Absence[]> {
    const q = query(
      collection(this.firestore, 'saasAbsences'),
      where('userId', '==', userId),
      orderBy('startDate', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.mapAbsence(d.id, d.data() as Record<string, unknown>));
  }

  async getAllAbsencesByCompany(companyId: string): Promise<Absence[]> {
    const q = query(
      collection(this.firestore, 'saasAbsences'),
      where('companyId', '==', companyId),
      orderBy('requestedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.mapAbsence(d.id, d.data() as Record<string, unknown>));
  }

  async getApprovedAbsencesForPeriod(userId: string, startDate: string, endDate: string): Promise<Absence[]> {
    const q = query(collection(this.firestore, 'saasAbsences'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => this.mapAbsence(d.id, d.data() as Record<string, unknown>))
      .filter(a => a.status === 'approved' && a.startDate <= endDate && a.endDate >= startDate);
  }

  async reviewAbsence(absenceId: string, status: Extract<AbsenceStatus, 'approved'|'rejected'>, reviewedBy: string, reviewNote?: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'saasAbsences', absenceId), {
      status, reviewedBy, reviewNote: reviewNote ?? null, reviewedAt: serverTimestamp(),
    });
  }

  async deleteAbsence(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'saasAbsences', id));
  }

  private mapType(id: string, d: Record<string, unknown>): AbsenceType {
    return {
      id, companyId: d['companyId'] as string,
      name: d['name'] as string, color: d['color'] as string,
      deductsBalance: (d['deductsBalance'] as boolean) ?? false,
      createdBy: d['createdBy'] as string,
      createdAt: d['createdAt'] instanceof Timestamp ? d['createdAt'].toDate() : new Date(),
    };
  }

  private mapAbsence(id: string, d: Record<string, unknown>): Absence {
    return {
      id, companyId: d['companyId'] as string,
      userId: d['userId'] as string,
      userDisplayName: d['userDisplayName'] as string | undefined,
      absenceTypeId: d['absenceTypeId'] as string,
      absenceTypeName: d['absenceTypeName'] as string | undefined,
      absenceTypeColor: d['absenceTypeColor'] as string | undefined,
      startDate: d['startDate'] as string, endDate: d['endDate'] as string,
      note: d['note'] as string | undefined, status: d['status'] as AbsenceStatus,
      requestedAt: d['requestedAt'] instanceof Timestamp ? d['requestedAt'].toDate() : new Date(),
      reviewedBy: d['reviewedBy'] as string | undefined,
      reviewedAt: d['reviewedAt'] instanceof Timestamp ? d['reviewedAt'].toDate() : undefined,
      reviewNote: d['reviewNote'] as string | undefined,
    };
  }
}
