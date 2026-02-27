import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, getDocs, doc, getDoc,
  updateDoc, query, where, orderBy, serverTimestamp, Timestamp
} from '@angular/fire/firestore';
import { Company, CompanyStatus } from '../models';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly firestore: Firestore = inject(Firestore);

  async getAll(): Promise<Company[]> {
    const q = query(collection(this.firestore, 'companies'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => this.map(d.id, d.data() as Record<string, unknown>));
  }

  async getBySlug(slug: string): Promise<Company | null> {
    const q = query(collection(this.firestore, 'companies'), where('slug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0]!;
    return this.map(d.id, d.data() as Record<string, unknown>);
  }

  async getById(id: string): Promise<Company | null> {
    const snap = await getDoc(doc(this.firestore, 'companies', id));
    if (!snap.exists()) return null;
    return this.map(snap.id, snap.data() as Record<string, unknown>);
  }

  async create(company: Omit<Company, 'id' | 'createdAt'>): Promise<Company> {
    const ref = await addDoc(collection(this.firestore, 'companies'), {
      ...company,
      logoURL: company.logoURL ?? null,
      planName: company.planName ?? null,
      createdAt: serverTimestamp(),
    });
    return { ...company, id: ref.id, createdAt: new Date() };
  }

  async update(id: string, data: Partial<Company>): Promise<void> {
    await updateDoc(doc(this.firestore, 'companies', id), { ...data });
  }

  async getActiveCompanies(): Promise<Company[]> {
    const q = query(
      collection(this.firestore, 'companies'),
      where('status', 'in', [CompanyStatus.ACTIVE, CompanyStatus.TRIAL]),
      orderBy('name', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.map(d.id, d.data() as Record<string, unknown>));
  }

  async countActiveUsers(companyId: string): Promise<number> {
    const q = query(
      collection(this.firestore, 'users'),
      where('companyId', '==', companyId),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    return snap.size;
  }

  private map(id: string, d: Record<string, unknown>): Company {
    return {
      id,
      name: d['name'] as string,
      slug: d['slug'] as string,
      logoURL: d['logoURL'] as string | undefined,
      planId: d['planId'] as string,
      planName: d['planName'] as string | undefined,
      maxUsers: d['maxUsers'] as number,
      status: d['status'] as CompanyStatus,
      createdAt: d['createdAt'] instanceof Timestamp ? d['createdAt'].toDate() : new Date(),
      createdBy: d['createdBy'] as string,
    };
  }
}
