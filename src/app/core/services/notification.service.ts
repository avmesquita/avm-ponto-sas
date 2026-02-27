import { Injectable, inject } from '@angular/core';
import { TimesheetService } from './timesheet.service';
import { HolidayService } from './holiday.service';
import { AbsenceService } from './absence.service';
import { AppUser } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly timesheetSvc: TimesheetService = inject(TimesheetService);
  private readonly holidaySvc: HolidayService = inject(HolidayService);
  private readonly absenceSvc: AbsenceService = inject(AbsenceService);

  get supported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  get permission(): NotificationPermission {
    return this.supported ? Notification.permission : 'denied';
  }

  // Solicita permissão ao usuário — chamar após interação (clique)
  async requestPermission(): Promise<boolean> {
    if (!this.supported) return false;
    if (this.permission === 'granted') return true;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  // Dispara notificação local imediata
  async notify(title: string, options: NotificationOptions = {}): Promise<void> {
    if (!this.supported || this.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.showNotification(title, {
        icon: '/icons/icon-192x192.svg',
        badge: '/icons/icon-32x32.svg',
        ...options,
      });
    } else {
      new Notification(title, { icon: '/icons/icon-192x192.svg', ...options });
    }
  }

  // Notifica sobre decisão de ausência
  async notifyAbsenceReview(status: 'approved' | 'rejected', typeName: string, startDate: string, endDate: string): Promise<void> {
    const [y1, m1, d1] = startDate.split('-');
    const [y2, m2, d2] = endDate.split('-');
    const period = startDate === endDate
      ? `${d1}/${m1}/${y1}`
      : `${d1}/${m1}/${y1} a ${d2}/${m2}/${y2}`;

    if (status === 'approved') {
      await this.notify(`✅ Ausência aprovada`, {
        body: `${typeName} — ${period} foi aprovada pelo administrador.`,
        tag: 'absence-review',
      });
    } else {
      await this.notify(`❌ Ausência rejeitada`, {
        body: `${typeName} — ${period} foi rejeitada. Consulte o sistema para mais detalhes.`,
        tag: 'absence-review',
      });
    }
  }

  // Verifica inconsistências de ontem e notifica se houver — chamar no login
  async checkYesterdayInconsistencies(user: AppUser): Promise<void> {
    if (this.permission !== 'granted') return;

    const yesterday = this.getYesterdayString();
    // Não verificar fins de semana
    const dow = new Date(yesterday + 'T12:00:00').getDay();
    if (dow === 0 || dow === 6) return;

    try {
      const [holidays, absences, entries] = await Promise.all([
        this.holidaySvc.getHolidays(user.companyId),
        this.absenceSvc.getApprovedAbsencesForPeriod(user.uid, yesterday, yesterday),
        this.timesheetSvc.getEntriesForDay(user.uid, yesterday),
      ]);

      const summary = this.timesheetSvc.calculateDailySummary(
        yesterday, entries, user.workHoursPerDay, holidays, absences
      );

      if (summary.inconsistencies.length > 0 && !summary.isAbsence && !summary.isHoliday) {
        const [y, m, d] = yesterday.split('-');
        await this.notify('⚠️ Inconsistência de ponto', {
          body: `Você tem ${summary.inconsistencies.length} inconsistência(s) em ${d}/${m}/${y}. Acesse o app para corrigir.`,
          tag: 'inconsistency-yesterday',
        });
      }
    } catch {
      // Silencioso — não bloquear o login por falha na verificação
    }
  }

  // Registra o service worker do PWA
  async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      console.warn('Service Worker não registrado:', e);
    }
  }

  private getYesterdayString(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
