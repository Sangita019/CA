export type DocumentFileType = 'pdf' | 'image';

export interface ConsolidatedDocumentTab {
  readonly id: string;
  readonly label: string;
  readonly documents: ConsolidatedDocumentOption[];
}

export interface ConsolidatedDocumentOption {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
}

export interface OcrField {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

export interface UploadedDocumentFile {
  readonly id: string;
  readonly name: string;
  readonly type: DocumentFileType;
  readonly size: number;
  readonly objectUrl: string;
}

export interface OcrResult {
  readonly fields: OcrField[];
  readonly documentId: string;
}

export interface ConsolidatedDocumentState {
  readonly selectedDocumentId: string | null;
  readonly files: UploadedDocumentFile[];
  readonly ocrResult: OcrResult | null;
}
