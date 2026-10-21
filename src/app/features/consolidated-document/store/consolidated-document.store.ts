import { Injectable, computed, inject, signal } from '@angular/core';

import { ConsolidatedDocumentOption } from '../models/consolidated-document.models';
import {
  ConsolidatedDocumentSnapshot,
  ConsolidatedDocumentStorageService,
  PersistedDocumentRecord
} from '../services/consolidated-document-storage.service';

@Injectable({ providedIn: 'root' })
export class ConsolidatedDocumentStore {
  private readonly storage = inject(ConsolidatedDocumentStorageService);
  private readonly initialSnapshot = this.storage.load();

  readonly selectedTabId = signal(this.initialSnapshot?.selectedTabId ?? 'officially-valid-documents');
  readonly selectedDocumentId = signal<string | null>(this.initialSnapshot?.selectedDocumentId ?? 'passport');
  readonly records = signal<readonly PersistedDocumentRecord[]>(this.initialSnapshot?.records ?? []);
  readonly persistenceWarning = signal<string | null>(null);

  readonly uploadedDocumentIds = computed(
    () => new Set(this.records().filter((record) => record.status === 'saved')
      .map((record) => record.documentId))
  );

  isUnavailableInTab(option: ConsolidatedDocumentOption, tabId: string): boolean {
    return this.records().some((record) =>
      record.documentId === option.id &&
      record.tabId !== tabId &&
      record.status === 'saved'
    );
  }

  markUploaded(record: Omit<PersistedDocumentRecord, 'status' | 'updatedAt'>): void {
    this.upsert({ ...record, status: 'uploaded', updatedAt: new Date().toISOString() });
  }

  markSaved(documentId: string, tabId: string, documentLabel: string, confirmedDocumentId: string | null): void {
    this.upsert({
      documentId,
      tabId,
      documentLabel,
      status: 'saved',
      confirmedDocumentId,
      updatedAt: new Date().toISOString()
    });
  }

  clearDocument(documentId: string, tabId: string): void {
    this.records.update((records) => records.filter((record) =>
      record.documentId !== documentId || record.tabId !== tabId
    ));
    this.persist();
  }

  clearTab(tabId: string): void {
    this.records.update((records) => records.filter((record) => record.tabId !== tabId));
    this.persist();
  }

  select(tabId: string, documentId: string | null): void {
    this.selectedTabId.set(tabId);
    this.selectedDocumentId.set(documentId);
    this.persist();
  }

  private upsert(record: PersistedDocumentRecord): void {
    this.records.update((records) => [
      ...records.filter((item) => !(item.documentId === record.documentId && item.tabId === record.tabId)),
      record
    ]);
    this.persist();
  }

  private persist(): void {
    const snapshot: ConsolidatedDocumentSnapshot = {
      version: 1,
      selectedTabId: this.selectedTabId(),
      selectedDocumentId: this.selectedDocumentId(),
      records: this.records()
    };
    if (!this.storage.save(snapshot)) {
      this.persistenceWarning.set('Browser storage is unavailable. Document status may not survive refresh.');
    } else {
      this.persistenceWarning.set(null);
    }
  }
}
