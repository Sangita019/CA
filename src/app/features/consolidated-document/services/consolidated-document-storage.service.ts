import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface PersistedDocumentRecord {
  readonly documentId: string;
  readonly documentLabel: string;
  readonly tabId: string;
  readonly status: 'uploaded' | 'saved';
  readonly confirmedDocumentId: string | null;
  readonly updatedAt: string;
}

export interface ConsolidatedDocumentSnapshot {
  readonly version: 1;
  readonly selectedTabId: string;
  readonly selectedDocumentId: string | null;
  readonly records: readonly PersistedDocumentRecord[];
}

const STORAGE_KEY = 'ca.consolidated-document.v1';

@Injectable({ providedIn: 'root' })
export class ConsolidatedDocumentStorageService {
  private readonly platformId = inject(PLATFORM_ID);

  load(): ConsolidatedDocumentSnapshot | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      if (!this.isSnapshot(parsed)) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  save(snapshot: ConsolidatedDocumentSnapshot): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      return true;
    } catch {
      return false;
    }
  }

  private isSnapshot(value: unknown): value is ConsolidatedDocumentSnapshot {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<ConsolidatedDocumentSnapshot>;
    return candidate.version === 1
      && typeof candidate.selectedTabId === 'string'
      && (typeof candidate.selectedDocumentId === 'string' || candidate.selectedDocumentId === null)
      && Array.isArray(candidate.records);
  }
}
