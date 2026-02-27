import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => console.log('[SW] Registrado:', reg.scope))
      .catch(err => console.warn('[SW] Falha ao registrar:', err));
  });
}

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
