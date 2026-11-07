import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'ca.additional-document-tabs.v1';

@Injectable({ providedIn: 'root' })
export class AdditionalDocumentTabsStorage {
  private readonly platformId = inject(PLATFORM_ID);

  loadIds(): readonly string[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '0');
      if (Array.isArray(value) && value.every((item): item is string =>
        typeof item === 'string' && /^additional-document-\d+$/.test(item)
      )) {
        return [...new Set(value)].slice(0, 50);
      }
      // Migrate the previous count-only format without losing existing tabs.
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 50) {
        return Array.from({ length: value }, (_, index) => `additional-document-${index + 1}`);
      }
      return [];
    } catch {
      return [];
    }
  }

  saveIds(ids: readonly string[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, 50)));
    } catch {
      // The tabs remain available for the current session if browser storage is unavailable.
    }
  }
}
