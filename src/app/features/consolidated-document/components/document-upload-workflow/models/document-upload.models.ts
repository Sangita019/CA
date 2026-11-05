import { UploadedDocumentFile } from '../../../models/consolidated-document.models';

export type UploadStatus = 'queued' | 'uploading' | 'uploaded' | 'failed';

export interface DocumentUploadItem extends UploadedDocumentFile {
  readonly sourceFile: File;
  readonly progress: number;
  readonly status: UploadStatus;
}

export interface DocumentUploadLimits {
  readonly maxImages: number;
  readonly maxPdfFiles: number;
  readonly maxFileSizeBytes: number;
}

export const DOCUMENT_UPLOAD_LIMITS: DocumentUploadLimits = {
  maxImages: 5,
  maxPdfFiles: 1,
  maxFileSizeBytes: 10 * 1024 * 1024
};

export const DOCUMENT_UPLOAD_ACCEPT = '.jpeg,.jpg,.jfif,.png,.pdf,image/jpeg,image/png,application/pdf';
