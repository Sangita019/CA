export interface OcrDocument {
  documentId: string;
  fileName: string;
  totalPages: number;
  pages: OcrPage[];
}

export interface OcrPage {
  pageNumber: number;
  items: OcrItem[];
}

export interface OcrItem {
  id: string;
  label: string;
  text: string;

  pageNumber: number;

  // Percentage coordinates
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;

  // Pixel coordinates
  xPixels?: number;
  yPixels?: number;
  widthPixels?: number;
  heightPixels?: number;

  confidence?: number;
}

export interface OcrDisplayCoordinates {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OcrImageItemGroup {
  text: string;
  items: OcrItem[];
}

export interface OcrPdfItemGroup {
  text: string;
  items: Array<OcrItem & { pageNumber: number }>;
}
