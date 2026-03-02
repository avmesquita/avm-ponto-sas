import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, addDoc, getDocs, doc,
  deleteDoc, query, where, orderBy, serverTimestamp, Timestamp
} from '@angular/fire/firestore';
import { Holiday } from '../models';

@Injectable({ providedIn: 'root' })
export class HolidayService {
  private readonly firestore: Firestore = inject(Firestore);

  /**
   * Retorna feriados aplicáveis a uma empresa:
   *   1. Feriados nacionais do país da empresa  (companyId='', country=X)
   *   2. Feriados personalizados da empresa      (companyId=X)
   * Se dois feriados caírem na mesma data, o da empresa sobrescreve o nacional.
   */
  async getHolidays(companyId: string, country: string): Promise<Holiday[]> {
    const [national, company] = await Promise.all([
      this.fetchNational(country),
      this.fetchByCompany(companyId),
    ]);
    const map = new Map<string, Holiday>();
    for (const h of [...national, ...company]) map.set(h.date, h);
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Feriados nacionais de um país (companyId = '', country = 'BR' | 'PT' | ...) */
  private async fetchNational(country: string): Promise<Holiday[]> {
    const q = query(
      collection(this.firestore, 'saasHolidays'),
      where('companyId', '==', ''),
      where('country', '==', country),
      orderBy('date', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.map(d.id, d.data() as Record<string, unknown>));
  }

  /** Feriados personalizados de uma empresa específica */
  private async fetchByCompany(companyId: string): Promise<Holiday[]> {
    if (!companyId) return [];
    const q = query(
      collection(this.firestore, 'saasHolidays'),
      where('companyId', '==', companyId),
      orderBy('date', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => this.map(d.id, d.data() as Record<string, unknown>));
  }

  async addHoliday(holiday: Omit<Holiday, 'id' | 'createdAt'>): Promise<Holiday> {
    const ref = await addDoc(collection(this.firestore, 'saasHolidays'), {
      ...holiday,
      nameKey: holiday.nameKey ?? '',
      name: holiday.name ?? null,
      hoursExpected: holiday.hoursExpected ?? null,
      createdAt: serverTimestamp(),
    });
    return { ...holiday, id: ref.id, createdAt: new Date() };
  }

  async deleteHoliday(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'saasHolidays', id));
  }

  /**
   * Popula feriados nacionais para um país/ano.
   * Cada país tem sua própria função de cálculo.
   * Retorna quantos feriados foram inseridos (ignora duplicatas por data).
   */
  async seedNationalHolidays(year: number, country: string, createdBy: string): Promise<number> {
    const holidays = this.getHolidaysForCountry(year, country);
    if (holidays.length === 0) return 0;

    const existing = await this.fetchNational(country);
    const existingDates = new Set(existing.filter(h => {
      const [y] = h.date.split('-').map(Number);
      return y === year;
    }).map(h => h.date));

    let added = 0;
    for (const h of holidays) {
      if (!existingDates.has(h.date)) {
        await this.addHoliday({
          companyId: '',
          country,
          date: h.date,
          nameKey: h.nameKey,
          name: h.name,
          national: true,
          createdBy,
        });
        added++;
      }
    }
    return added;
  }

  // ── Catálogo de feriados por país ──────────────────────────────────────────

  getHolidaysForCountry(year: number, country: string): Array<{ date: string; nameKey: string; name: string }> {
    switch (country) {
      case 'BR': return this.holidaysBR(year);
      case 'PT': return this.holidaysPT(year);
      case 'US': return this.holidaysUS(year);
      default:   return [];
    }
  }

  private holidaysBR(year: number) {
    const easter = this.calcEaster(year);
    return [
      { date: this.fmt(year, 1, 1),   nameKey: 'holiday.new_year',          name: 'Confraternização Universal' },
      { date: this.fmtOffset(easter, -48), nameKey: 'holiday.carnival_mon',  name: 'Carnaval (segunda)' },
      { date: this.fmtOffset(easter, -47), nameKey: 'holiday.carnival_tue',  name: 'Carnaval (terça)' },
      { date: this.fmtOffset(easter, -2),  nameKey: 'holiday.good_friday',   name: 'Sexta-feira Santa' },
      { date: this.fmtEaster(easter),       nameKey: 'holiday.easter',        name: 'Páscoa' },
      { date: this.fmt(year, 4, 21),  nameKey: 'holiday.br.tiradentes',      name: 'Tiradentes' },
      { date: this.fmt(year, 5, 1),   nameKey: 'holiday.labor_day',          name: 'Dia do Trabalho' },
      { date: this.fmtOffset(easter, 60),  nameKey: 'holiday.corpus_christi', name: 'Corpus Christi' },
      { date: this.fmt(year, 9, 7),   nameKey: 'holiday.br.independence',    name: 'Independência do Brasil' },
      { date: this.fmt(year, 10, 12), nameKey: 'holiday.br.aparecida',       name: 'Nossa Senhora Aparecida' },
      { date: this.fmt(year, 11, 2),  nameKey: 'holiday.br.finados',         name: 'Finados' },
      { date: this.fmt(year, 11, 15), nameKey: 'holiday.br.republic',        name: 'Proclamação da República' },
      { date: this.fmt(year, 11, 20), nameKey: 'holiday.br.black_awareness', name: 'Consciência Negra' },
      { date: this.fmt(year, 12, 25), nameKey: 'holiday.christmas',          name: 'Natal' },
    ];
  }

  private holidaysPT(year: number) {
    const easter = this.calcEaster(year);
    return [
      { date: this.fmt(year, 1, 1),        nameKey: 'holiday.new_year',          name: 'Ano Novo' },
      { date: this.fmtOffset(easter, -47), nameKey: 'holiday.carnival_tue',      name: 'Carnaval' },
      { date: this.fmtOffset(easter, -2),  nameKey: 'holiday.good_friday',       name: 'Sexta-feira Santa' },
      { date: this.fmtEaster(easter),      nameKey: 'holiday.easter',            name: 'Páscoa' },
      { date: this.fmt(year, 4, 25),       nameKey: 'holiday.pt.freedom_day',    name: 'Dia da Liberdade' },
      { date: this.fmt(year, 5, 1),        nameKey: 'holiday.labor_day',         name: 'Dia do Trabalhador' },
      { date: this.fmtOffset(easter, 60),  nameKey: 'holiday.corpus_christi',    name: 'Corpo de Deus' },
      { date: this.fmt(year, 6, 10),       nameKey: 'holiday.pt.portugal_day',   name: 'Dia de Portugal' },
      { date: this.fmt(year, 8, 15),       nameKey: 'holiday.assumption',        name: 'Assunção de Nossa Senhora' },
      { date: this.fmt(year, 10, 5),       nameKey: 'holiday.pt.republic_day',   name: 'Implantação da República' },
      { date: this.fmt(year, 11, 1),       nameKey: 'holiday.all_saints',        name: 'Todos os Santos' },
      { date: this.fmt(year, 12, 1),       nameKey: 'holiday.pt.restoration',    name: 'Restauração da Independência' },
      { date: this.fmt(year, 12, 8),       nameKey: 'holiday.immaculate_conc',   name: 'Imaculada Conceição' },
      { date: this.fmt(year, 12, 25),      nameKey: 'holiday.christmas',         name: 'Natal' },
    ];
  }

  private holidaysUS(year: number) {
    return [
      { date: this.fmt(year, 1, 1),   nameKey: 'holiday.new_year',         name: "New Year's Day" },
      { date: this.nthWeekday(year, 1, 1, 3),  nameKey: 'holiday.us.mlk',  name: 'Martin Luther King Jr. Day' },
      { date: this.nthWeekday(year, 2, 1, 3),  nameKey: 'holiday.us.presidents', name: "Presidents' Day" },
      { date: this.lastWeekday(year, 5, 1),    nameKey: 'holiday.us.memorial', name: 'Memorial Day' },
      { date: this.fmt(year, 6, 19),  nameKey: 'holiday.us.juneteenth',    name: 'Juneteenth' },
      { date: this.fmt(year, 7, 4),   nameKey: 'holiday.us.independence',  name: 'Independence Day' },
      { date: this.nthWeekday(year, 9, 1, 1),  nameKey: 'holiday.labor_day', name: 'Labor Day' },
      { date: this.nthWeekday(year, 11, 4, 4), nameKey: 'holiday.us.thanksgiving', name: 'Thanksgiving Day' },
      { date: this.fmt(year, 12, 25), nameKey: 'holiday.christmas',        name: 'Christmas Day' },
    ];
  }

  // ── Helpers de data ────────────────────────────────────────────────────────

  private calcEaster(year: number): Date {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  private fmt(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private fmtEaster(easter: Date): string {
    return this.fmt(easter.getFullYear(), easter.getMonth() + 1, easter.getDate());
  }

  private fmtOffset(base: Date, offsetDays: number): string {
    const d = new Date(base);
    d.setDate(d.getDate() + offsetDays);
    return this.fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  /** N-ésima ocorrência de um dia da semana num mês (weekday: 0=dom, 1=seg...) */
  private nthWeekday(year: number, month: number, weekday: number, nth: number): string {
    const d = new Date(year, month - 1, 1);
    let count = 0;
    while (true) {
      if (d.getDay() === weekday) { count++; if (count === nth) break; }
      d.setDate(d.getDate() + 1);
    }
    return this.fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  /** Última ocorrência de um dia da semana num mês */
  private lastWeekday(year: number, month: number, weekday: number): string {
    const d = new Date(year, month, 0); // último dia do mês
    while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
    return this.fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  private map(id: string, d: Record<string, unknown>): Holiday {
    return {
      id,
      companyId: (d['companyId'] as string) ?? '',
      country:   (d['country'] as string)   ?? 'BR',
      date:       d['date'] as string,
      nameKey:   (d['nameKey'] as string)   ?? '',
      name:       d['name'] as string | undefined,
      national:  (d['national'] as boolean) ?? false,
      hoursExpected: d['hoursExpected'] as number | undefined,
      createdBy:  d['createdBy'] as string,
      createdAt:  d['createdAt'] instanceof Timestamp ? d['createdAt'].toDate() : new Date(),
    };
  }
}
