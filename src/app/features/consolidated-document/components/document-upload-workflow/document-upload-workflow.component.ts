import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ConsolidatedDocumentOption } from '../../models/consolidated-document.models';
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_LIMITS,
  DocumentUploadItem
} from './models/document-upload.models';
import { DOCUMENT_UPLOAD_GATEWAY } from '../../services/document-workflow-gateways';

@Component({
  selector: 'ca-document-upload-workflow',
  standalone: true,
  imports: [
    MatButtonModule,
    MatProgressBarModule,
    ReactiveFormsModule,
  ],
  templateUrl: './document-upload-workflow.component.html',
  styleUrl: './document-upload-workflow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentUploadWorkflowComponent {
  readonly document = input.required<ConsolidatedDocumentOption>();
  readonly ocrCompleted = input(false);
  readonly restoredUploads = input<readonly DocumentUploadItem[]>([]);
  readonly filesChanged = output<readonly DocumentUploadItem[]>();
  readonly uploadStateChange = output<'selected' | 'uploading' | 'uploaded'>();
  readonly finalizeOcrRequested = output<readonly DocumentUploadItem[]>();

  readonly uploadForm = new FormGroup({
    files: new FormControl<readonly File[]>([], { nonNullable: true })
  });
  readonly uploads = signal<readonly DocumentUploadItem[]>([]);
  readonly validationMessage = signal<string | null>(null);
  readonly uploadComplete = computed(() =>
    this.uploads().length > 0 && this.uploads().every((file) => file.status === 'uploaded')
  );
  readonly isUploading = computed(() =>
    this.uploads().some((file) => file.status === 'uploading')
  );
  readonly pendingUploadCount = computed(() =>
    this.uploads().filter((file) => file.status === 'queued' || file.status === 'failed').length
  );
  readonly uploadButtonLabel = computed(() => {
    if (this.isUploading()) return 'Uploading…';
    const count = this.pendingUploadCount();
    return count > 0
      ? `Upload ${count} ${count === 1 ? 'file' : 'files'}`
      : 'Upload complete';
  });
  readonly accept = DOCUMENT_UPLOAD_ACCEPT;
  private readonly uploader = inject(DOCUMENT_UPLOAD_GATEWAY);
  private readonly destroyRef = inject(DestroyRef);
  private currentDocumentId: string | null = null;

  constructor() {
    effect(() => {
      const documentId = this.document().id;
      if (this.currentDocumentId !== null && this.currentDocumentId !== documentId) {
        this.clearUploads();
        this.uploads.set([]);
        this.uploadForm.controls.files.setValue([]);
        this.validationMessage.set(null);
      }
      this.currentDocumentId = documentId;
    });
    effect(() => {
      const restored = this.restoredUploads();
      untracked(() => this.clearUploads());
      this.uploads.set(restored);
      this.uploadForm.controls.files.setValue(restored.map((item) => item.sourceFile));
      if (restored.length && restored.every((file) => file.status === 'uploaded')) {
        this.uploadStateChange.emit('uploaded');
      }
    });
    this.destroyRef.onDestroy(() => this.clearUploads());
  }

  onFilesSelected(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const selectedFiles = Array.from(inputElement.files ?? []);
    inputElement.value = '';

    if (!selectedFiles.length) return;

    const existingUploads = this.uploads();
    const validationError = this.validateFiles([
      ...existingUploads.map((item) => item.sourceFile),
      ...selectedFiles
    ]);
    if (validationError) {
      this.validationMessage.set(validationError);
      return;
    }

    const existingKeys = new Set(existingUploads.map((item) =>
      `${item.name}-${item.size}-${item.sourceFile.lastModified}`
    ));
    const newFiles = selectedFiles.filter((file) =>
      !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`)
    );
    if (!newFiles.length) {
      this.validationMessage.set('The selected file is already in the upload list.');
      return;
    }

    const items: DocumentUploadItem[] = newFiles.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name,
      type: this.isPdf(file) ? 'pdf' : 'image',
      size: file.size,
      objectUrl: URL.createObjectURL(file),
      sourceFile: file,
      progress: 0,
      status: 'queued'
    }));

    this.uploads.set([...existingUploads, ...items]);
    this.uploadForm.controls.files.setValue([...existingUploads, ...items].map((item) => item.sourceFile));
    this.validationMessage.set(null);
    this.filesChanged.emit(this.uploads());
    this.uploadStateChange.emit('selected');
  }

  uploadSelectedFiles(): void {
    const pendingItems = this.uploads().filter((item) =>
      item.status === 'queued' || item.status === 'failed'
    );
    if (pendingItems.length) this.uploadStateChange.emit('uploading');
    pendingItems.forEach((item) => {
      this.updateUpload(item.id, { status: 'uploading', progress: 0 });
      this.startUpload(item);
    });
  }

  finalizeOcr(): void {
    if (!this.uploadComplete()) return;
    this.finalizeOcrRequested.emit(this.uploads());
  }

  private startUpload(item: DocumentUploadItem): void {
    this.uploader.upload(item.sourceFile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (progress) => {
          this.updateUpload(item.id, {
            progress,
            status: progress === 100 ? 'uploaded' : 'uploading'
          });
          if (progress === 100 && this.uploads().every((file) => file.status === 'uploaded')) {
            this.uploadStateChange.emit('uploaded');
          }
        },
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
