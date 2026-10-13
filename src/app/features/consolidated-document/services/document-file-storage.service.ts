import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface StoredDocumentFile {
  readonly id: string;
  readonly name: string;
  readonly type: 'pdf' | 'image';
  readonly size: number;
  readonly blob: Blob;
}

interface StoredDocumentBundle {
  readonly key: string;
  readonly documentId: string;
  readonly tabId: string;
  readonly documentLabel: string;
  readonly confirmedDocumentId: string | null;
  readonly files: StoredDocumentFile[];
  readonly savedAt: string;
}

const DATABASE_NAME = 'ca-consolidated-document';
const STORE_NAME = 'saved-document-bundles';
const DATABASE_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class DocumentFileStorageService {
  private readonly platformId = inject(PLATFORM_ID);

  async saveBundle(bundle: Omit<StoredDocumentBundle, 'key' | 'savedAt'>): Promise<void> {
    const database = await this.openDatabase();
    const record: StoredDocumentBundle = {
      ...bundle,
      key: this.createKey(bundle.documentId, bundle.tabId),
      savedAt: new Date().toISOString()
    };
    await this.runTransaction(database, 'readwrite', (store) => store.put(record));
  }

  async loadBundle(documentId: string, tabId: string): Promise<StoredDocumentBundle | null> {
    const database = await this.openDatabase();
    return await new Promise<StoredDocumentBundle | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME).get(this.createKey(documentId, tabId));
      request.onsuccess = () => resolve((request.result as StoredDocumentBundle | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Unable to read saved documents.'));
    });
  }

  private createKey(documentId: string, tabId: string): string {
    return `${tabId}::${documentId}`;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!isPlatformBrowser(this.platformId) || typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('Browser file storage is unavailable.'));
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open browser file storage.'));
    });
  }

  private runTransaction(
    database: IDBDatabase,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      action(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save files locally.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local file save was cancelled.'));
    });
  }
}
