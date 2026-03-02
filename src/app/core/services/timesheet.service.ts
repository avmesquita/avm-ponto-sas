import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, query, where, getDocs,
  orderBy, doc, deleteDoc, updateDoc, serverTimestamp, Timestamp
} from '@angular/fire/firestore';
import { TimeEntry, DailySummary, Inconsistency, Holiday, AppUser, ImportRow, ImportResult, Absence } from '../models';

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function differenceInMinutes(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 60000);
}

@Injectable({ providedIn: 'root' })
export class TimesheetService {

  private readonly firestore: Firestore = inject(Firestore);

  async punch(user: AppUser): Promise<TimeEntry> {
    const now = new Date();
    const dateStr = this.getTodayString();
    const todayEntries = await this.getEntriesForDay(user.uid, dateStr);
    const sorted = todayEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const lastType = sorted[sorted.length - 1]?.type;
    const type = lastType === 'entry' ? 'exit' : 'entry';

    const entry: Omit<TimeEntry, 'id'> = {
      companyId: user.companyId,
      userId: user.uid,
      date: dateStr,
      timestamp: now,
      type,
      createdAt: now,
    };
    const ref = await addDoc(collection(this.firestore, 'saasTimeEntries'), {
      ...entry,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    return { ...entry, id: ref.id };
  }

  async getEntriesForDay(userId: string, date: string): Promise<TimeEntry[]> {
    const q = query(
      collection(this.firestore, 'saasTimeEntries'),
      where('userId', '==', userId),
      where('date', '==', date),
      orderBy('timestamp', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.mapEntry(d.id, d.data()));
  }

  async getEntriesForPeriod(userId: string, startDate: string, endDate: string): Promise<TimeEntry[]> {
    const q = query(
      collection(this.firestore, 'saasTimeEntries'),
      where('userId', '==', userId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc'),
      orderBy('timestamp', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.mapEntry(d.id, d.data()));
  }

  async getDailySummary(user: AppUser, date: string, holidays: Holiday[], absences: Absence[] = []): Promise<DailySummary> {
    const entries = await this.getEntriesForDay(user.uid, date);
    return this.calculateDailySummary(date, entries, user.workHoursPerDay, holidays, absences);
  }

  calculateDailySummary(date: string, entries: TimeEntry[], workHoursPerDay: number, holidays: Holiday[], absences: Absence[] = []): DailySummary {
    const dateObj = new Date(date + 'T12:00:00');
    const dayIsWeekend = isWeekend(dateObj);
    const matchingHoliday = holidays.find(h => h.date === date);
    const dayIsHoliday = !!matchingHoliday;
    const matchingAbsence = absences.find(a =>
      a.status === 'approved' && a.startDate <= date && a.endDate >= date
    );
    const dayIsAbsence = !!matchingAbsence;

    let expectedMinutes: number;
    if (dayIsWeekend || dayIsAbsence) {
      expectedMinutes = 0;
    } else if (dayIsHoliday) {
      const partial = matchingHoliday?.hoursExpected ?? 0;
      expectedMinutes = partial > 0 ? partial * 60 : 0;
    } else {
      expectedMinutes = workHoursPerDay * 60;
    }

    const sorted = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    let workedMinutes = 0;
    for (let i = 0; i + 1 < sorted.length; i += 2) {
      const a = sorted[i]; const b = sorted[i + 1];
      if (a && b) { const diff = differenceInMinutes(b.timestamp, a.timestamp); if (diff > 0) workedMinutes += diff; }
    }

    const today = new Date();
    const isToday = date === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    if (isToday && sorted.length % 2 !== 0 && sorted[sorted.length - 1]?.type === 'entry') {
      const lastEntry = sorted[sorted.length - 1]!;
      const diff = differenceInMinutes(today, lastEntry.timestamp);
      if (diff > 0) workedMinutes += diff;
    }

    const balanceMinutes = dayIsAbsence ? 0 : workedMinutes - expectedMinutes;
    const inconsistencies = dayIsAbsence ? [] : this.detectInconsistencies('', date, sorted, workHoursPerDay);

    return {
      date, entries: sorted, workedMinutes, expectedMinutes, balanceMinutes,
      isHoliday: dayIsHoliday, isWeekend: dayIsWeekend,
      isAbsence: dayIsAbsence,
      absenceTypeName: matchingAbsence?.absenceTypeName,
      absenceTypeColor: matchingAbsence?.absenceTypeColor,
      inconsistencies,
    };
  }

  detectInconsistencies(userId: string, date: string, entries: TimeEntry[], _workHoursPerDay: number): Inconsistency[] {
    const inc: Inconsistency[] = [];
    const sorted = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    if (sorted.length > 0 && sorted.length % 2 !== 0) {
      inc.push({ userId, date, type: 'ODD_PUNCHES', description: `Número ímpar de batidas (${sorted.length}): última entrada sem saída correspondente.`, resolved: false, createdAt: new Date() });
    } else if (sorted.length > 0 && sorted[sorted.length - 1]?.type === 'entry') {
      inc.push({ userId, date, type: 'MISSING_EXIT', description: 'Sequência irregular: último par termina em entrada.', resolved: false, createdAt: new Date() });
    }
    let total = 0;
    for (let i = 0; i + 1 < sorted.length; i += 2) {
      const a = sorted[i]; const b = sorted[i + 1];
      if (a && b) total += differenceInMinutes(b.timestamp, a.timestamp);
    }
    if (total > 12 * 60) {
      inc.push({ userId, date, type: 'EXCESSIVE_HOURS', description: `Total trabalhado (${Math.floor(total/60)}h) excede 12h.`, resolved: false, createdAt: new Date() });
    }
    return inc;
  }

  async addManualEntry(userId: string, companyId: string, date: string, time: string, type: 'entry'|'exit', note: string, editorUid: string): Promise<TimeEntry> {
    const [h, m] = time.split(':').map(Number);
    const timestamp = new Date(date + 'T12:00:00');
    timestamp.setHours(h!, m!, 0, 0);
    const now = new Date();
    const ref = await addDoc(collection(this.firestore, 'saasTimeEntries'), {
      companyId, userId, date, timestamp: serverTimestamp(), type,
      manual: true, manualNote: note, manualBy: editorUid, manualAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    return {
      id: ref.id, companyId, userId, date, timestamp, type,
      manual: true, manualNote: note, manualBy: editorUid, manualAt: now,
      createdAt: now,
    };
  }

  async updateManualEntry(entryId: string, time: string, type: 'entry'|'exit', note: string, editorUid: string): Promise<void> {
    const [h, m] = time.split(':').map(Number);
    const now = new Date(); now.setHours(h!, m!, 0, 0);
    await updateDoc(doc(this.firestore, 'saasTimeEntries', entryId), {
      timestamp: serverTimestamp(), type,
      manual: true, manualNote: note, manualBy: editorUid, manualAt: serverTimestamp(),
    });
  }

  async deleteEntry(entryId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'saasTimeEntries', entryId));
  }

  async importEntries(rows: ImportRow[], companyId: string, importedBy: string): Promise<ImportResult> {
    let success = 0; const errors: string[] = [];
    for (const row of rows) {
      try {
        const [datePart, timePart] = row.datetime.split(' ');
        if (!datePart || !timePart) throw new Error('Formato inválido');
        const [h, min] = timePart.split(':').map(Number);
        const ts = new Date(datePart + 'T12:00:00'); ts.setHours(h!, min!, 0, 0);
        await addDoc(collection(this.firestore, 'saasTimeEntries'), {
          companyId, userId: row.userId, date: datePart,
          timestamp: serverTimestamp(), type: row.type,
          note: row.note ?? null, imported: true, importedBy, importedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        success++;
      } catch (e: unknown) {
        errors.push(`${row.userId} ${row.datetime}: ${e instanceof Error ? e.message : 'erro'}`);
      }
    }
    return { success, failed: errors.length, errors };
  }

  getTodayString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  isCurrentMonth(date: string): boolean {
    const now = new Date();
    const [y, m] = date.split('-').map(Number);
    return y === now.getFullYear() && m === (now.getMonth() + 1);
  }

  formatMinutes(mins: number): string {
    const sign = mins < 0 ? '-' : '+';
    const abs = Math.abs(mins);
    return `${sign}${String(Math.floor(abs/60)).padStart(2,'0')}h${String(abs%60).padStart(2,'0')}min`;
  }

  formatMinutesSimple(mins: number): string {
    const abs = Math.abs(mins);
    return `${String(Math.floor(abs/60)).padStart(2,'0')}h${String(abs%60).padStart(2,'0')}min`;
  }

  private mapEntry(id: string, d: Record<string, unknown>): TimeEntry {
    const ts = d['timestamp'];
    const timestamp = ts instanceof Timestamp ? ts.toDate() : (ts instanceof Date ? ts : new Date());
    return {
      id, companyId: (d['companyId'] as string) ?? '',
      userId: d['userId'] as string,
      date: d['date'] as string, timestamp,
      type: d['type'] as 'entry'|'exit',
      note: d['note'] as string | undefined,
      manual: d['manual'] as boolean | undefined,
      manualNote: d['manualNote'] as string | undefined,
      manualBy: d['manualBy'] as string | undefined,
      manualAt: d['manualAt'] instanceof Timestamp ? d['manualAt'].toDate() : undefined,
      imported: d['imported'] as boolean | undefined,
      importedBy: d['importedBy'] as string | undefined,
      importedAt: d['importedAt'] instanceof Timestamp ? d['importedAt'].toDate() : undefined,
      createdAt: d['createdAt'] instanceof Timestamp ? d['createdAt'].toDate() : new Date(),
    };
  }
}
