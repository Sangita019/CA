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
import { MatTabsModule } from '@angular/material/tabs';

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
    MatTabsModule,
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

  readonly documentIdControl = new FormControl('', { nonNullable: true });

  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly selectedDocument = computed<ConsolidatedDocumentOption | null>(() => {
    const tab = this.tabs()[this.selectedTabIndex()];
    return tab?.documents.find((document) => document.id === this.selectedDocumentId()) ?? null;
  });

  readonly previewFile = computed(() => {
    const id = this.previewFileId();
    return this.files().find((file) => file.id === id) ?? this.files()[0] ?? null;
  });

  selectTab(index: number): void {
    this.selectedTabIndex.set(index);
    const firstDocument = this.tabs()[index]?.documents[0];
    this.selectedDocumentId.set(firstDocument?.id ?? null);
    this.resetDocumentState();
  }

  selectDocument(documentId: string): void {
    if (documentId === this.selectedDocumentId()) {
      return;
    }

    if (this.files().length) {
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
            this.selectedDocumentId.set(documentId);
            this.resetDocumentState();
          }
        });
      return;
    }

    this.selectedDocumentId.set(documentId);
    this.resetDocumentState();
  }

  filesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedFiles = Array.from(input.files ?? []);
    const validFiles = this.validateFiles(selectedFiles);

    this.revokeUrls(this.files());

    const uploaded = validFiles.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      type: this.isPdf(file) ? 'pdf' as const : 'image' as const,
      size: file.size,
      objectUrl: URL.createObjectURL(file)
    }));

    this.files.set(uploaded);
    this.previewFileId.set(uploaded[0]?.id ?? null);
    this.ocrResult.set(null);
    input.value = '';
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
  }

  selectPreview(fileId: string): void {
    this.previewFileId.set(fileId);
  }

  triggerOcr(): void {
    if (!this.files().length) {
      return;
    }

    this.ocrLoading.set(true);
    this.ocrRequested.emit(this.files());
  }

  setOcrResult(result: OcrResult): void {
    this.ocrResult.set(result);
    this.documentIdControl.setValue(result.documentId);
    this.ocrLoading.set(false);
  }

  confirmDocumentId(): void {
    this.documentIdConfirmed.emit(this.documentIdControl.value.trim());
  }

  save(): void {
    this.saving.set(true);
    this.saved.emit();
    this.saving.set(false);
  }

  private validateFiles(files: readonly File[]): readonly File[] {
    const pdfs = files.filter((file) => this.isPdf(file));
    if (pdfs.length > 1 || (pdfs.length === 1 && files.length > 1)) {
      return pdfs.slice(0, 1);
    }

    return files
      .filter((file) => this.isImage(file))
      .slice(0, 5);
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
  }

  private revokeUrls(files: readonly UploadedDocumentFile[]): void {
    for (const file of files) {
      URL.revokeObjectURL(file.objectUrl);
    }
  }
}
