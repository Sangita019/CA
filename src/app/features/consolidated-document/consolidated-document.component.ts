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
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';

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

const DEFAULT_TABS: readonly ConsolidatedDocumentTab[] = [
  {
    id: 'officially-valid-documents',
    label: 'Officially Valid Documents',
    documents: [
      { id: 'passport', label: 'Passport', required: true },
      { id: 'driving-licence', label: 'Driving Licence', required: true },
      { id: 'epic-voter-card', label: 'EPIC / Voter Card', required: true },
      { id: 'nrega-job-card', label: 'NREGA Job Card', required: false },
      { id: 'aadhaar', label: 'Aadhaar', required: false }
    ]
  },
  {
    id: 'current-address',
    label: 'Current Address',
    documents: [
      { id: 'address-proof', label: 'Address Proof', required: true }
    ]
  },
  {
    id: 'pan-form-60',
    label: 'PAN / Form-60',
    documents: [
      { id: 'pan', label: 'PAN', required: true },
      { id: 'form-60', label: 'Form-60', required: false }
    ]
  },
  {
    id: 'supporting-documents',
    label: 'Supporting Documents',
    documents: [
      { id: 'supporting-document', label: 'Supporting Document', required: false }
    ]
  }
];

@Component({
  selector: 'ca-consolidated-document',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    ReactiveFormsModule
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
  readonly files = signal<readonly UploadedDocumentFile[]>([]);
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

  readonly selectedDocument = computed<ConsolidatedDocumentOption | null>(() => {
    const tab = this.tabs()[this.selectedTabIndex()];
    return tab?.documents.find((document) => document.id === this.selectedDocumentId()) ?? null;
  });

  readonly previewFile = computed(() => {
    const id = this.previewFileId();
    return this.files().find((file) => file.id === id) ?? this.files()[0] ?? null;
  });

  selectTab(index: number): void {
    if (index === this.selectedTabIndex()) {
      return;
    }

    const nextDocumentId = this.tabs()[index]?.documents[0]?.id ?? null;
    this.changeSelectionWithConfirmation(() => {
      this.selectedTabIndex.set(index);
      this.selectedDocumentId.set(nextDocumentId);
    });
  }

  selectDocument(documentId: string): void {
    if (documentId === this.selectedDocumentId()) {
      return;
    }

    this.changeSelectionWithConfirmation(() => this.selectedDocumentId.set(documentId));
  }

  private changeSelectionWithConfirmation(changeSelection: () => void): void {
    if (!this.files().length) {
      changeSelection();
      this.resetDocumentState();
      return;
    }

    const dialogData: ChangeDocumentDialogData = {
      currentDocument: this.selectedDocument()?.label ?? 'selected document'
    };

    this.dialog
      .open(ChangeDocumentDialogComponent, {
        width: '420px',
        data: dialogData,
        disableClose: true
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed: boolean | undefined) => {
        if (confirmed) {
          changeSelection();
          this.resetDocumentState();
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
      objectUrl: URL.createObjectURL(file)
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

  removeFile(fileId: string): void {
    const file = this.files().find((item) => item.id === fileId);
    if (file) {
      URL.revokeObjectURL(file.objectUrl);
    }

    const remaining = this.files().filter((item) => item.id !== fileId);
    this.files.set(remaining);
    this.previewFileId.set(remaining[0]?.id ?? null);
    this.ocrResult.set(null);
    this.ocrMessage.set(null);
    this.confirmedDocumentId.set(null);
    this.documentIdConfirmationMessage.set(null);
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

  save(): void {
    const document = this.selectedDocument();
    if (!document || !this.files().length) {
      this.saveMessage.set('Select a document and upload at least one file before saving.');
      return;
    }

    this.saving.set(true);
    this.saveMessage.set(null);

    this.mockService
      .save({
        documentId: document.id,
        documentLabel: document.label,
        files: this.files(),
        ocrResult: this.ocrResult(),
        confirmedDocumentId: this.confirmedDocumentId()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          if (response.saved) {
            this.saved.emit();
            this.saveMessage.set(`Mock save completed. Reference: ${response.referenceId}. No data was persisted to a backend.`);
          } else {
            this.saveMessage.set('The mock save did not complete. Please try again.');
          }
        },
        error: () => {
          this.saving.set(false);
          this.saveMessage.set('Save failed. Please try again.');
        }
      });
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
