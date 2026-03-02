import { Injectable, signal } from '@angular/core';

/**
 * Serviço de tradução mínimo que carrega arquivos JSON de /i18n/.
 * Compatível com ngx-translate: quando for instalado, basta substituir
 * as chamadas de translate() pelo TranslateService do ngx-translate.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private catalog: Record<string, string> = {};
  readonly locale = signal<string>('pt');

  async load(locale: string): Promise<void> {
    try {
      const res = await fetch(`/i18n/${locale}.json`);
      const raw = await res.json() as Record<string, unknown>;
      this.catalog = this.flatten(raw);
      this.locale.set(locale);
    } catch {
      console.warn(`[I18n] Catálogo '${locale}' não encontrado, mantendo atual.`);
    }
  }

  translate(key: string, fallback?: string): string {
    return this.catalog[key] ?? fallback ?? key;
  }

  // Flatten { holiday: { christmas: "Natal" } } → { "holiday.christmas": "Natal" }
  private flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    return Object.entries(obj).reduce((acc, [k, v]) => {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null) {
        Object.assign(acc, this.flatten(v as Record<string, unknown>, full));
      } else {
        acc[full] = String(v);
      }
      return acc;
    }, {} as Record<string, string>);
  }
}
