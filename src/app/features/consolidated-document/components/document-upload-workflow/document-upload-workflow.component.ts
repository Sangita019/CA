import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { ConsolidatedDocumentOption } from '../../models/consolidated-document.models';
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_LIMITS,
  DocumentUploadItem
} from './models/document-upload.models';
import { MockDocumentUploadService } from './services/mock-document-upload.service';

@Component({
  selector: 'ca-document-upload-workflow',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatProgressBarModule,
  ],
  templateUrl: './document-upload-workflow.component.html',
  styleUrl: './document-upload-workflow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentUploadWorkflowComponent {
  readonly document = input.required<ConsolidatedDocumentOption>();
  readonly selected = input(false);
  readonly ocrCompleted = input(false);
  readonly selectionChange = output<boolean>();
  readonly finalizeOcrRequested = output<readonly DocumentUploadItem[]>();

  readonly uploads = signal<readonly DocumentUploadItem[]>([]);
  readonly validationMessage = signal<string | null>(null);
  readonly uploadComplete = computed(() =>
    this.uploads().length > 0 && this.uploads().every((file) => file.status === 'uploaded')
  );
  readonly isUploading = computed(() =>
    this.uploads().some((file) => file.status === 'uploading' || file.status === 'queued')
  );
  readonly accept = DOCUMENT_UPLOAD_ACCEPT;
  private readonly uploader = inject(MockDocumentUploadService);
  private readonly destroyRef = inject(DestroyRef);
  private currentDocumentId: string | null = null;

  constructor() {
    effect(() => {
      const documentId = this.document().id;
      if (this.currentDocumentId !== null && this.currentDocumentId !== documentId) {
        this.clearUploads();
        this.uploads.set([]);
        this.validationMessage.set(null);
      }
      this.currentDocumentId = documentId;
    });
    this.destroyRef.onDestroy(() => this.clearUploads());
  }

  onDocumentChecked(checked: boolean): void {
    this.validationMessage.set(null);
    if (!checked) {
      this.clearUploads();
      this.uploads.set([]);
    }
    this.selectionChange.emit(checked);
  }

  onFilesSelected(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const selectedFiles = Array.from(inputElement.files ?? []);
    inputElement.value = '';

    if (!selectedFiles.length) return;
    if (!this.selected()) {
      this.validationMessage.set('Select this document before choosing files.');
      return;
    }

    const validationError = this.validateFiles(selectedFiles);
    if (validationError) {
      this.validationMessage.set(validationError);
      return;
    }

    const items: DocumentUploadItem[] = selectedFiles.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name,
      type: this.isPdf(file) ? 'pdf' : 'image',
      size: file.size,
      objectUrl: URL.createObjectURL(file),
      sourceFile: file,
      progress: 0,
      status: 'uploading'
    }));

    this.clearUploads();
    this.uploads.set(items);
    this.validationMessage.set(null);
    items.forEach((item) => this.startUpload(item));
  }

  finalizeOcr(): void {
    if (!this.uploadComplete()) return;
    this.finalizeOcrRequested.emit(this.uploads());
  }

  private startUpload(item: DocumentUploadItem): void {
    this.uploader.upload(item.sourceFile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (progress) => this.updateUpload(item.id, {
          progress,
          status: progress === 100 ? 'uploaded' : 'uploading'
        }),
        error: () => this.updateUpload(item.id, { status: 'failed' })
      });
  }

  private updateUpload(
    fileId: string,
    update: Pick<DocumentUploadItem, 'status'> & Partial<Pick<DocumentUploadItem, 'progress'>>
  ): void {
    this.uploads.update((items) => items.map((item) =>
      item.id === fileId ? { ...item, ...update } : item
    ));
  }

  private validateFiles(files: readonly File[]): string | null {
    if (files.some((file) => !this.isAllowedFile(file))) {
      return 'Only PDF, JPEG, JPG, JFIF and PNG files are supported.';
    }
    if (files.some((file) => file.size > DOCUMENT_UPLOAD_LIMITS.maxFileSizeBytes)) {
      return 'Each file must be 10 MB or smaller.';
    }

    const pdfCount = files.filter((file) => this.isPdf(file)).length;
    const imageCount = files.length - pdfCount;
    if (pdfCount > DOCUMENT_UPLOAD_LIMITS.maxPdfFiles ||
        imageCount > DOCUMENT_UPLOAD_LIMITS.maxImages ||
        (pdfCount > 0 && imageCount > 0)) {
      return 'Choose either one PDF or up to five images. PDF and image files cannot be mixed.';
    }
    return null;
  }

  private isAllowedFile(file: File): boolean {
    return this.isPdf(file) || /\.(jpe?g|jfif|png)$/i.test(file.name);
  }

  private isPdf(file: File): boolean {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  }

  private clearUploads(): void {
    this.uploads().forEach((item) => URL.revokeObjectURL(item.objectUrl));
  }
}
