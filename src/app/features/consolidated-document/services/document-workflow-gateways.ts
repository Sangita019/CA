import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { OcrResult, UploadedDocumentFile } from '../models/consolidated-document.models';
import { ConsolidatedDocumentMockService } from './consolidated-document-mock.service';
import { MockDocumentUploadService } from '../components/document-upload-workflow/services/mock-document-upload.service';

export interface DocumentUploadGateway {
  upload(file: File): Observable<number>;
}

export interface DocumentOcrGateway {
  processOcr(documentId: string, files: readonly UploadedDocumentFile[]): Observable<OcrResult>;
}

export const DOCUMENT_UPLOAD_GATEWAY = new InjectionToken<DocumentUploadGateway>(
  'DOCUMENT_UPLOAD_GATEWAY',
  { providedIn: 'root', factory: () => inject(MockDocumentUploadService) }
);

export const DOCUMENT_OCR_GATEWAY = new InjectionToken<DocumentOcrGateway>(
  'DOCUMENT_OCR_GATEWAY',
  { providedIn: 'root', factory: () => inject(ConsolidatedDocumentMockService) }
);
