import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';

import {
  ConsolidatedDocumentOption,
  ConsolidatedDocumentTab,
  OcrResult,
  UploadedDocumentFile
} from './models/consolidated-document.models';
import {
  ChangeDocumentDialogComponent,
  ChangeDocumentDialogData
} from './change-document-dialog.component';
import { ConsolidatedDocumentMockService } from './services/consolidated-document-mock.service';
import { DocumentFileStorageService } from './services/document-file-storage.service';
import { ConsolidatedDocumentStore } from './store/consolidated-document.store';
import { UploadedFileListComponent } from './components/uploaded-file-list/uploaded-file-list.component';
import { ApplicableDocumentSelectorComponent } from './components/applicable-document-selector/applicable-document-selector.component';
import { DocumentPreviewComponent } from './components/document-preview/document-preview.component';
import { OcrResponseComponent } from './components/ocr-response/ocr-response.component';

const DEFAULT_TABS: readonly ConsolidatedDocumentTab[] = [
  {
    id: 'overseas-address',
    label: 'Overseas Address',
    documents: [
      { id: 'passport', label: 'Passport', required: true },
      { id: 'overseas-address-proof', label: 'Overseas Address Proof', required: true }
    ]
  },
  {
    id: 'current-address',
    label: 'Indian Address',
    documents: [
      { id: 'passport', label: 'Passport', required: true },
      { id: 'address-proof', label: 'Address Proof', required: true }
    ]
  },
  {
    id: 'officially-valid-documents',
    label: 'Identity',
    documents: [
      { id: 'passport', label: 'Passport', required: true },
      { id: 'driving-licence', label: 'Driving Licence', required: true },
      { id: 'epic-voter-card', label: 'EPIC / Voter Card', required: true },
      { id: 'nrega-job-card', label: 'NREGA Job Card', required: false },
      { id: 'aadhaar', label: 'Aadhaar', required: false },
      { id: 'pan', label: 'PAN', required: true },
      { id: 'form-60', label: 'Form-60', required: false },
      { id: 'supporting-document', label: 'Supporting Document', required: false }
    ]
  }
];

@Component({
  selector: 'ca-consolidated-document',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatChipsModule,
    MatExpansionModule,
    ReactiveFormsModule,
    UploadedFileListComponent,
    ApplicableDocumentSelectorComponent,
    DocumentPreviewComponent,
    OcrResponseComponent
  ],
  templateUrl: './consolidated-document.component.html',
  styleUrl: './consolidated-document.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConsolidatedDocumentComponent {
  readonly tabs = input<readonly ConsolidatedDocumentTab[]>(DEFAULT_TABS);
  readonly saved = output<void>();
  readonly ocrRequested = output<readonly UploadedDocumentFile[]>();
  readonly documentIdConfirmed = output<string>();

  readonly selectedTabIndex = signal(0);
  readonly selectedDocumentId = signal<string | null>(DEFAULT_TABS[0]?.documents[0]?.id ?? null);
  readonly files = signal<readonly (UploadedDocumentFile & { sourceFile: File })[]>([]);
  readonly previewFileId = signal<string | null>(null);
  readonly ocrResult = signal<OcrResult | null>(null);
  readonly ocrLoading = signal(false);
  readonly saving = signal(false);
  readonly uploadMessage = signal<string | null>(null);
  readonly uploadMode = signal<'add' | 'replace'>('add');
  readonly ocrMessage = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);
  readonly documentIdConfirmationMessage = signal<string | null>(null);
  readonly confirmedDocumentId = signal<string | null>(null);

  readonly documentIdControl = new FormControl('', { nonNullable: true });

  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mockService = inject(ConsolidatedDocumentMockService);
  private readonly fileStorage = inject(DocumentFileStorageService);
  readonly documentStore = inject(ConsolidatedDocumentStore);

  constructor() {
    void this.restoreSavedDocument();
  }

  readonly selectedDocument = computed<ConsolidatedDocumentOption | null>(() => {
    const tab = this.tabs()[this.selectedTabIndex()];
    return tab?.documents.find((document) => document.id === this.selectedDocumentId()) ?? null;
  });

  readonly unavailableDocumentIds = computed<ReadonlySet<string>>(() => {
    const tab = this.tabs()[this.selectedTabIndex()];
    return new Set((tab?.documents ?? [])
      .filter((document) => tab && this.documentStore.isUnavailableInTab(document, tab.id))
      .map((document) => document.id));
  });

  categorySaved(tab: ConsolidatedDocumentTab): boolean {
    return this.documentStore.records().some((record) =>
      record.tabId === tab.id && record.status === 'saved'
    );
  }

  categoryDocumentLabel(tab: ConsolidatedDocumentTab): string {
    const selected = tab.documents.find((document) =>
      document.id === this.selectedDocumentId() && this.tabs()[this.selectedTabIndex()]?.id === tab.id
    );
    const saved = this.documentStore.records().find((record) =>
      record.tabId === tab.id && record.status === 'saved'
    );
    return selected?.label ?? saved?.documentLabel ?? 'No document selected';
  }

  categoryStatus(tab: ConsolidatedDocumentTab, index: number): string {
    if (index === this.selectedTabIndex() && this.ocrLoading()) return 'OCR in Progress';
    if (index === this.selectedTabIndex() && this.ocrResult()) return 'OCR Complete';
    if (this.documentStore.records().some((record) => record.tabId === tab.id && record.status === 'saved')) {
      return 'Saved';
    }
    if (index === this.selectedTabIndex() && this.files().length) return 'Files Selected';
    return 'Not Started';
  }

  categoryStatusColor(tab: ConsolidatedDocumentTab, index: number): 'primary' | 'accent' | 'warn' {
    const status = this.categoryStatus(tab, index);
    if (status === 'Saved' || status === 'OCR Complete') return 'primary';
    if (status === 'OCR in Progress' || status === 'Files Selected') return 'accent';
    return 'warn';
  }

  selectTab(index: number): void {
    if (index === this.selectedTabIndex()) {
      return;
    }

    const nextTab = this.tabs()[index];
    const nextDocumentId = nextTab?.documents.find((document) =>
      !this.documentStore.isUnavailableInTab(document, nextTab.id)
    )?.id ?? nextTab?.documents[0]?.id ?? null;
    this.changeSelectionWithConfirmation(() => {
      this.selectedTabIndex.set(index);
      this.selectedDocumentId.set(nextDocumentId);
      this.documentStore.select(nextTab?.id ?? '', nextDocumentId);
    });
  }

  selectDocument(documentId: string): void {
    if (documentId === this.selectedDocumentId()) {
      return;
    }

    this.changeSelectionWithConfirmation(() => {
      this.selectedDocumentId.set(documentId);
      this.documentStore.select(this.tabs()[this.selectedTabIndex()]?.id ?? '', documentId);
    });
  }

  private changeSelectionWithConfirmation(changeSelection: () => void): void {
    const currentDocument = this.selectedDocument();
    const currentTab = this.tabs()[this.selectedTabIndex()];
    const currentDocumentSaved = Boolean(currentDocument && currentTab &&
      this.documentStore.records().some((record) =>
        record.documentId === currentDocument.id &&
        record.tabId === currentTab.id &&
        record.status === 'saved'
      ));

    const proceed = (): void => {
      changeSelection();
      this.resetDocumentState();
      const nextTab = this.tabs()[this.selectedTabIndex()];
      const nextDocument = this.selectedDocument();
      if (nextTab && nextDocument) {
        void this.restoreDocumentFiles(nextDocument.id, nextTab.id);
      }
    };

    if (!this.files().length || currentDocumentSaved) {
      proceed();
      return;
    }

    const dialogData: ChangeDocumentDialogData = {
      currentDocument: currentDocument?.label ?? 'selected document'
    };

    this.dialog
      .open(ChangeDocumentDialogComponent, {
        width: 'min(420px, calc(100vw - 32px))',
        data: dialogData,
        disableClose: true
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed: boolean | undefined) => {
        if (confirmed) {
          proceed();
        }
      });
  }

  chooseFiles(mode: 'add' | 'replace', input: HTMLInputElement): void {
    this.uploadMode.set(mode);
    input.click();
  }

  filesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(input.files, this.uploadMode());
    input.value = '';
    this.uploadMode.set('add');
  }

  addFiles(fileList: FileList | null, mode: 'add' | 'replace' = 'add'): void {
    if (!fileList?.length) {
      return;
    }

    const selectedFiles = Array.from(fileList);
    const previousFiles = this.files();
    const currentFiles = mode === 'replace' ? [] : previousFiles;
    const selectedPdfs = selectedFiles.filter((file) => this.isPdf(file));
    const selectedImages = selectedFiles.filter((file) => this.isImage(file));
    const invalidCount = selectedFiles.length - selectedPdfs.length - selectedImages.length;

    if (invalidCount > 0) {
      this.uploadMessage.set('Only PDF, JPEG, JPG, JFIF and PNG files are supported.');
      return;
    }

    const hasPdf = currentFiles.some((file) => file.type === 'pdf');
    if (hasPdf || selectedPdfs.length > 0) {
      if (currentFiles.length > 0 || selectedPdfs.length !== 1 || selectedImages.length > 0) {
        this.uploadMessage.set('Upload either one PDF or up to five image files.');
        return;
      }
    }

    if (!hasPdf && currentFiles.length + selectedImages.length > 5) {
      this.uploadMessage.set('You can upload a maximum of five image files.');
      return;
    }

    const existingKeys = new Set(currentFiles.map((file) => `${file.name}-${file.size}`));
    const newFiles = selectedFiles.filter((file) =>
      !existingKeys.has(`${file.name}-${file.size}`)
    );

    if (!newFiles.length) {
      this.uploadMessage.set('The selected file is already in the uploaded list.');
      return;
    }

    const uploaded = newFiles.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${index}`,
      name: file.name,
      type: this.isPdf(file) ? 'pdf' as const : 'image' as const,
      size: file.size,
      objectUrl: URL.createObjectURL(file),
      sourceFile: file
    }));

    if (mode === 'replace') {
      this.revokeUrls(previousFiles);
    }

    const nextFiles = [...currentFiles, ...uploaded];
    this.files.set(nextFiles);
    this.previewFileId.set(uploaded[0]?.id ?? this.previewFileId());
    this.ocrResult.set(null);
    this.confirmedDocumentId.set(null);
    this.ocrMessage.set(null);
    this.documentIdConfirmationMessage.set(null);
    this.saveMessage.set(null);
    this.uploadMessage.set(null);
  }

  async removeFile(fileId: string): Promise<void> {
    const currentFiles = this.files();
    const file = currentFiles.find((item) => item.id === fileId);
    if (!file) {
      return;
    }

    const remaining = currentFiles.filter((item) => item.id !== fileId);
    const document = this.selectedDocument();
    const tab = this.tabs()[this.selectedTabIndex()];
    const wasSaved = Boolean(document && tab && this.documentStore.records().some((record) =>
      record.documentId === document.id && record.tabId === tab.id && record.status === 'saved'
    ));

    this.files.set(remaining);
    this.previewFileId.set(remaining[0]?.id ?? null);
    this.ocrResult.set(null);
    this.ocrMessage.set(null);
    this.confirmedDocumentId.set(null);
    this.documentIdConfirmationMessage.set(null);
    URL.revokeObjectURL(file.objectUrl);

    if (!document || !tab) {
      return;
    }

    if (!remaining.length) {
      // A category can contain stale records from an earlier selected document.
      // Clear its status immediately so the collapsed header returns to Not Started.
      const savedRecords = this.documentStore.records().filter((record) => record.tabId === tab.id);
      this.documentStore.clearTab(tab.id);
      try {
        const documentIds = new Set([document.id, ...savedRecords.map((record) => record.documentId)]);
        await Promise.all(Array.from(documentIds, (savedDocumentId) =>
          this.fileStorage.deleteBundle(savedDocumentId, tab.id)
        ));
        this.saveMessage.set('The file was deleted from this browser.');
      } catch {
        this.saveMessage.set('The file was removed from this view and the category status was reset, but saved browser data could not be fully cleared.');
      }
      return;
    }

    try {
      if (wasSaved) {
        await this.fileStorage.saveBundle({
          documentId: document.id,
          tabId: tab.id,
          documentLabel: document.label,
          confirmedDocumentId: this.confirmedDocumentId(),
          files: remaining.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            size: item.size,
            blob: item.sourceFile
          }))
        });
        this.saveMessage.set('The file was removed from the saved document.');
      }
    } catch {
      this.saveMessage.set('The file was removed from the current view, but browser storage could not be updated.');
    }
  }

  selectPreview(fileId: string): void {
    this.previewFileId.set(fileId);
  }

  triggerOcr(): void {
    const files = this.files();
    const document = this.selectedDocument();

    if (!files.length || !document || this.ocrLoading()) {
      return;
    }

    this.ocrLoading.set(true);
    this.ocrMessage.set(null);
    this.saveMessage.set(null);
    this.documentIdConfirmationMessage.set(null);
    this.ocrRequested.emit(files);

    this.mockService
      .processOcr(document.id, files)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.setOcrResult(result);
          this.ocrMessage.set('Mock OCR completed. Values below are sample data, not extracted from the file.');
        },
        error: () => {
          this.ocrLoading.set(false);
          this.ocrMessage.set('OCR processing failed. Please try again.');
        }
      });
  }

  setOcrResult(result: OcrResult): void {
    this.ocrResult.set(result);
    this.documentIdControl.setValue(result.documentId);
    this.ocrLoading.set(false);
  }

  confirmDocumentId(): void {
    const documentId = this.documentIdControl.value.trim();
    if (!documentId) {
      this.documentIdConfirmationMessage.set('Enter a document ID before confirming.');
      return;
    }

    this.confirmedDocumentId.set(documentId);
    this.documentIdConfirmed.emit(documentId);
    this.documentIdConfirmationMessage.set('Document ID confirmed for this mock session.');
  }

  async save(): Promise<void> {
    const document = this.selectedDocument();
    if (!document || !this.files().length) {
      this.saveMessage.set('Select a document and upload at least one file before saving.');
      return;
    }

    const tab = this.tabs()[this.selectedTabIndex()];
    if (!tab) {
      this.saveMessage.set('The selected document category is unavailable.');
      return;
    }

    this.saving.set(true);
    this.saveMessage.set(null);

    try {
      await this.fileStorage.saveBundle({
        documentId: document.id,
        tabId: tab.id,
        documentLabel: document.label,
        confirmedDocumentId: this.confirmedDocumentId(),
        files: this.files().map((file) => ({
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          blob: file.sourceFile
        }))
      });

      this.documentStore.markSaved(
        document.id,
        tab.id,
        document.label,
        this.confirmedDocumentId()
      );
      this.saved.emit();
      this.saveMessage.set('Saved in this browser. Files will remain available after refresh on this browser and device; they are not sent to a backend.');
    } catch {
      this.saveMessage.set('Could not save files in browser storage. Check available storage and try again.');
    } finally {
      this.saving.set(false);
    }
  }

  private async restoreSavedDocument(): Promise<void> {
    const snapshotTabId = this.documentStore.selectedTabId();
    const tabIndex = this.tabs().findIndex((tab) => tab.id === snapshotTabId);
    const resolvedTabIndex = tabIndex >= 0 ? tabIndex : 0;
    const tab = this.tabs()[resolvedTabIndex];
    const preferredDocumentId = this.documentStore.selectedDocumentId();
    const document = tab?.documents.find((option) => option.id === preferredDocumentId)
      ?? tab?.documents[0];

    this.selectedTabIndex.set(resolvedTabIndex);
    this.selectedDocumentId.set(document?.id ?? null);
    if (tab && document) {
      await this.restoreDocumentFiles(document.id, tab.id);
    }
  }

  private async restoreDocumentFiles(documentId: string, tabId: string): Promise<void> {
    try {
      const bundle = await this.fileStorage.loadBundle(documentId, tabId);
      if (!bundle || !bundle.files.length) {
        return;
      }
      const restored = bundle.files.map((file) => {
        const blob = file.blob;
        return {
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          objectUrl: URL.createObjectURL(blob),
          sourceFile: new File([blob], file.name, { type: file.type === 'pdf' ? 'application/pdf' : blob.type })
        };
      });
      this.files.set(restored);
      this.previewFileId.set(restored[0]?.id ?? null);
    } catch {
      this.saveMessage.set('Previously saved files could not be loaded from browser storage.');
    }
  }

  private isPdf(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }

  private isImage(file: File): boolean {
    const name = file.name.toLowerCase();
    return ['.jpeg', '.jpg', '.jfif', '.png'].some((extension) => name.endsWith(extension));
  }

  private resetDocumentState(): void {
    this.revokeUrls(this.files());
    this.files.set([]);
    this.previewFileId.set(null);
    this.ocrResult.set(null);
    this.documentIdControl.reset();
    this.ocrLoading.set(false);
    this.ocrMessage.set(null);
    this.saveMessage.set(null);
    this.confirmedDocumentId.set(null);
    this.documentIdConfirmationMessage.set(null);
    this.uploadMessage.set(null);
  }

  private revokeUrls(files: readonly UploadedDocumentFile[]): void {
    for (const file of files) {
      URL.revokeObjectURL(file.objectUrl);
    }
  }
}
