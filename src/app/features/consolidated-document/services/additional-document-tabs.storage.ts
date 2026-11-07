import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'ca.additional-document-tabs.v1';

@Injectable({ providedIn: 'root' })
export class AdditionalDocumentTabsStorage {
  private readonly platformId = inject(PLATFORM_ID);

  loadCount(): number {
    if (!isPlatformBrowser(this.platformId)) return 0;
    try {
      const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '0');
      return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 50
        ? value
        : 0;
    } catch {
      return 0;
    }
  }

  saveCount(count: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(count));
    } catch {
      // The tabs remain available for the current session if browser storage is unavailable.
    }
  }
}
