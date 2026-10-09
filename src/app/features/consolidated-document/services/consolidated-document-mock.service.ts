import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

import {
  OcrField,
  OcrResult,
  UploadedDocumentFile
} from '../models/consolidated-document.models';

export interface MockDocumentSaveRequest {
  readonly documentId: string;
  readonly documentLabel: string;
  readonly files: readonly UploadedDocumentFile[];
  readonly ocrResult: OcrResult | null;
  readonly confirmedDocumentId: string | null;
}

export interface MockDocumentSaveResponse {
  readonly saved: boolean;
  readonly savedAt: string;
  readonly referenceId: string;
}

/**
 * Local mock only. Replace these methods with HttpClient calls when API contracts exist.
 * No document content is uploaded or persisted by this service.
 */
@Injectable({ providedIn: 'root' })
export class ConsolidatedDocumentMockService {
  processOcr(documentId: string, files: readonly UploadedDocumentFile[]): Observable<OcrResult> {
    const primaryFile = files[0];
    const fields: OcrField[] = [
      { key: 'documentType', label: 'Document type', value: this.labelFor(documentId) },
      { key: 'sourceFile', label: 'Source file', value: primaryFile?.name ?? '' },
      { key: 'holderName', label: 'Name (mock)', value: 'SAMPLE APPLICANT' },
      { key: 'dateOfBirth', label: 'Date of birth (mock)', value: '01/01/1990' }
    ];

    return of({
      fields,
      documentId: this.mockDocumentId(documentId)
    }).pipe(delay(900));
  }

  save(request: MockDocumentSaveRequest): Observable<MockDocumentSaveResponse> {
    return of({
      saved: true,
      savedAt: new Date().toISOString(),
      referenceId: `MOCK-CA-${request.documentId.toUpperCase()}-${Date.now()}`
    }).pipe(delay(400));
  }

  private labelFor(documentId: string): string {
    const labels: Readonly<Record<string, string>> = {
      passport: 'Passport',
      'driving-licence': 'Driving Licence',
      'epic-voter-card': 'EPIC / Voter Card',
      'nrega-job-card': 'NREGA Job Card',
      aadhaar: 'Aadhaar',
      'address-proof': 'Address Proof',
      pan: 'PAN',
      'form-60': 'Form-60',
      'supporting-document': 'Supporting Document'
    };

    return labels[documentId] ?? 'Document';
  }

  private mockDocumentId(documentId: string): string {
    if (documentId === 'pan') {
      return 'ABCDE1234F';
    }
    if (documentId === 'aadhaar') {
      return '1234 5678 9012';
    }
    if (documentId === 'passport') {
      return 'P1234567';
    }
    return 'DOC123456';
  }
}
