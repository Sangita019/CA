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
import { DOCUMENT_OCR_GATEWAY } from './services/document-workflow-gateways';
import { DocumentFileStorageService } from './services/document-file-storage.service';
import { ConsolidatedDocumentStore } from './store/consolidated-document.store';
import { DocumentPreviewComponent } from './components/document-preview/document-preview.component';
import { ApplicableDocumentSelectorComponent } from './components/applicable-document-selector/applicable-document-selector.component';
import { DocumentUploadWorkflowComponent } from './components/document-upload-workflow/document-upload-workflow.component';
import { DocumentUploadItem } from './components/document-upload-workflow/models/document-upload.models';
import { DocumentStatusChipComponent } from './components/document-status-chip/document-status-chip.component';

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
    MatExpansionModule,
    ReactiveFormsModule,
    DocumentPreviewComponent,
    ApplicableDocumentSelectorComponent,
    DocumentUploadWorkflowComponent,
    DocumentStatusChipComponent
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
  readonly selectedDocumentId = signal<string | null>(null);
  readonly uploadStage = signal<'none' | 'selected' | 'uploading' | 'uploaded'>('none');
  readonly files = signal<readonly (UploadedDocumentFile & { sourceFile: File })[]>([]);
  readonly restoredUploads = signal<readonly DocumentUploadItem[]>([]);
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
  readonly documentSelectionControl = new FormControl<string | null>(null);

  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ocrGateway = inject(DOCUMENT_OCR_GATEWAY);
  private readonly fileStorage = inject(DocumentFileStorageService);
  readonly documentStore = inject(ConsolidatedDocumentStore);

  constructor() {
    void this.restoreSavedDocument();
  }

  readonly selectedDocument = computed<ConsolidatedDocumentOption | null>(() => {
    const tab = this.tabs()[this.selectedTabIndex()];
    return tab?.documents.find((document) => document.id === this.selectedDocumentId()) ?? null;
  });

  readonly unavailableDocumentMessages = computed<ReadonlyMap<string, string>>(() => {
    const activeTab = this.tabs()[this.selectedTabIndex()];
    const messages = new Map<string, string>();
    if (!activeTab) return messages;

    for (const document of activeTab.documents) {
      const existingRecord = this.documentStore.records().find((record) =>
        record.documentId === document.id &&
        record.tabId !== activeTab.id &&
        (record.status === 'uploaded' || record.status === 'saved')
      );
      if (!existingRecord) continue;

      const existingTab = this.tabs().find((tab) => tab.id === existingRecord.tabId);
      messages.set(
        document.id,
        existingTab
          ? `Already uploaded in ${existingTab.label}`
          : 'Already uploaded in another category'
      );
    }
    return messages;
  });

  readonly unavailableDocumentIds = computed<ReadonlySet<string>>(() =>
    new Set(this.unavailableDocumentMessages().keys())
  );

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
      record.tabId === tab.id &&
      (record.status === 'uploaded' || record.status === 'saved')
    );
    return selected?.label ?? saved?.documentLabel ?? 'No document selected';
  }

  categoryStatus(tab: ConsolidatedDocumentTab, index: number): string {
    const isActive = index === this.selectedTabIndex();
    const records = this.documentStore.records().filter((record) => record.tabId === tab.id);
    const selectedRecord = isActive
      ? records.find((record) => record.documentId === this.selectedDocumentId())
      : records[0];
    if (isActive && this.ocrLoading()) return 'OCR in Progress';
    if (selectedRecord?.status === 'saved') return 'Complete';
    if (isActive && this.ocrResult()) return 'OCR done – Save identifier';
    if (selectedRecord?.status === 'uploaded') return 'Uploaded – OCR pending';
    if (isActive && this.uploadStage() === 'uploading') return 'Upload in Progress';
    if (isActive && this.uploadStage() === 'uploaded') return 'Uploaded – OCR pending';
    if (isActive && this.uploadStage() === 'selected') return 'Upload pending';
    if (isActive && this.selectedDocument()) return 'Selected – No files yet';
    return 'Not Started';
  }

  categoryStatusTone(tab: ConsolidatedDocumentTab, index: number): 'neutral' | 'info' | 'success' | 'warning' {
    const status = this.categoryStatus(tab, index);
    if (status === 'Complete') return 'success';
    if (status === 'OCR done – Save identifier' || status === 'Uploaded – OCR pending') return 'info';
    if (status === 'Upload pending' || status === 'Upload in Progress' || status === 'OCR in Progress') return 'warning';
    return 'neutral';
  }

  selectTab(index: number): void {
    if (index === this.selectedTabIndex()) {
      return;
    }

    const nextTab = this.tabs()[index];
    const nextDocumentId = nextTab?.documents.find((document) =>
      this.documentStore.records().some((record) =>
        record.tabId === nextTab.id && record.documentId === document.id &&
        (record.status === 'uploaded' || record.status === 'saved')
      )
    )?.id ?? null;
    this.changeSelectionWithConfirmation(() => {
      this.selectedTabIndex.set(index);
      this.selectedDocumentId.set(nextDocumentId);
      this.documentSelectionControl.setValue(nextDocumentId);
      this.documentStore.select(nextTab?.id ?? '', nextDocumentId);
    });
  }

  selectDocument(documentId: string): void {
    if (documentId === this.selectedDocumentId()) {
      return;
    }

    this.changeSelectionWithConfirmation(() => {
      this.selectedDocumentId.set(documentId);
      this.documentSelectionControl.setValue(documentId);
      this.documentStore.select(this.tabs()[this.selectedTabIndex()]?.id ?? '', documentId);
    });
  }

  onWorkflowFilesChanged(items: readonly DocumentUploadItem[]): void {
    const selectedFiles = items.map((item) => ({
      id: item.id, name: item.name, type: item.type, size: item.size,
      objectUrl: item.objectUrl, sourceFile: item.sourceFile
    }));
    this.uploadStage.set(selectedFiles.length ? 'selected' : 'none');
    this.files.set(selectedFiles);
    this.previewFileId.set(selectedFiles[0]?.id ?? null);
    this.ocrResult.set(null);
    this.confirmedDocumentId.set(null);
    this.documentIdControl.reset();
    this.ocrMessage.set(null);
    this.documentIdConfirmationMessage.set(null);
    this.saveMessage.set(null);

    const tab = this.tabs()[this.selectedTabIndex()];
    const document = this.selectedDocument();
    if (!selectedFiles.length) {
      const records = tab
        ? this.documentStore.records().filter((record) => record.tabId === tab.id)
        : [];
      if (tab) this.documentStore.clearTab(tab.id);
      const documentIds = new Set([
        ...(document ? [document.id] : []),
        ...records.map((record) => record.documentId)
      ]);
      void Promise.all(Array.from(documentIds, (documentId) =>
        this.fileStorage.deleteBundle(documentId, tab?.id ?? '')
      )).catch(() => {
        this.saveMessage.set('Files were removed from this view, but saved browser data could not be fully cleared.');
      });
      return;
    }

    void this.persistDraftBundle(selectedFiles);
  }

  onUploadStageChange(stage: 'none' | 'selected' | 'uploading' | 'uploaded'): void {
    this.uploadStage.set(stage);
  }

  finalizeWorkflowOcr(items: readonly DocumentUploadItem[]): void {
    this.uploadStage.set('uploaded');
    const workflowFiles = items.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      size: item.size,
      objectUrl: item.objectUrl,
      sourceFile: item.sourceFile
    }));
    this.files.set(workflowFiles);
    this.previewFileId.set(workflowFiles[0]?.id ?? null);
    this.triggerOcr();
  }

  saveWorkflowChanges(documentId: string): void {
    this.documentIdControl.setValue(documentId.trim());
    this.confirmDocumentId();
    if (this.confirmedDocumentId()) {
      void this.saveDocument();
    }
  }

  updateDocumentIdentificationNumber(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.documentIdControl.setValue(inputElement.value);
    this.confirmedDocumentId.set(null);
  }

  private changeSelectionWithConfirmation(changeSelection: () => void): void {
    const currentDocument = this.selectedDocument();
    const currentTab = this.tabs()[this.selectedTabIndex()];
    const currentDocumentSaved = Boolean(currentDocument && currentTab &&
      this.documentStore.records().some((record) =>
        record.documentId === currentDocument.id &&
        record.tabId === currentTab.id &&
        (record.status === 'uploaded' || record.status === 'saved')
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

    // Keep an IndexedDB draft as soon as files are selected, so refresh does not discard them.
    void this.persistDraftBundle(nextFiles);
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
      this.saveMessage.set(wasSaved
        ? 'The file was removed from the saved document.'
        : 'The file was removed from the local draft.');
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

    this.ocrGateway
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
    this.confirmedDocumentId.set(null);
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

  async saveDocument(): Promise<void> {
    const document = this.selectedDocument();
    const tab = this.tabs()[this.selectedTabIndex()];
    const files = this.files();
    if (!document || !tab || !files.length) {
      this.saveMessage.set('Select a document and upload at least one file before saving this document.');
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
        files: files.map((file) => ({
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          blob: file.sourceFile
        }))
      });
      if (this.confirmedDocumentId()) {
        this.documentStore.markSaved(document.id, tab.id, document.label, this.confirmedDocumentId());
      } else {
        this.documentStore.markUploaded({
          documentId: document.id,
          tabId: tab.id,
          documentLabel: document.label,
          confirmedDocumentId: null
        });
      }
      this.saveMessage.set('Document saved. Use Save Tab to finalize this entire category.');
    } catch {
      this.saveMessage.set('Could not save this document in browser storage. Check available storage and try again.');
    } finally {
      this.saving.set(false);
    }
  }

  async saveTab(): Promise<void> {
    const tab = this.tabs()[this.selectedTabIndex()];
    if (!tab) {
      this.saveMessage.set('The selected document category is unavailable.');
      return;
    }
    if (!this.documentStore.hasUploadedDocuments(tab.id) &&
        !this.documentStore.records().some((record) => record.tabId === tab.id && record.status === 'saved')) {
      this.saveMessage.set('Save at least one document in this category before saving the tab.');
      return;
    }

    this.saving.set(true);
    this.saveMessage.set(null);
    try {
      this.documentStore.markTabSaved(tab.id);
      this.saved.emit();
      this.saveMessage.set('The document category has been saved in this browser.');
    } finally {
      this.saving.set(false);
    }
  }

  private async persistDraftBundle(
    files: readonly (UploadedDocumentFile & { sourceFile: File })[]
  ): Promise<void> {
    const document = this.selectedDocument();
    const tab = this.tabs()[this.selectedTabIndex()];
    if (!document || !tab) {
      return;
    }

    try {
      if (!files.length) {
        await this.fileStorage.deleteBundle(document.id, tab.id);
        return;
      }

      await this.fileStorage.saveBundle({
        documentId: document.id,
        tabId: tab.id,
        documentLabel: document.label,
        confirmedDocumentId: this.confirmedDocumentId(),
        files: files.map((file) => ({
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          blob: file.sourceFile
        }))
      });
    } catch {
      this.saveMessage.set(
        'Files are selected, but browser storage could not keep a draft. They may be lost after refresh.'
      );
    }
  }

  private async restoreSavedDocument(): Promise<void> {
    const snapshotTabId = this.documentStore.selectedTabId();
    const tabIndex = this.tabs().findIndex((tab) => tab.id === snapshotTabId);
    const resolvedTabIndex = tabIndex >= 0 ? tabIndex : 0;
    const tab = this.tabs()[resolvedTabIndex];
    const preferredDocumentId = this.documentStore.selectedDocumentId();
    const document = tab?.documents.find((option) => option.id === preferredDocumentId);

    this.selectedTabIndex.set(resolvedTabIndex);
    this.selectedDocumentId.set(document?.id ?? null);
    this.documentSelectionControl.setValue(document?.id ?? null);
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
      this.uploadStage.set('uploaded');
      this.restoredUploads.set(restored.map((file) => ({
        ...file,
        progress: 100,
        status: 'uploaded' as const
      })));
      this.confirmedDocumentId.set(bundle.confirmedDocumentId);
      this.documentIdControl.setValue(bundle.confirmedDocumentId ?? '');
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
    this.uploadStage.set('none');
    this.files.set([]);
    this.restoredUploads.set([]);
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
