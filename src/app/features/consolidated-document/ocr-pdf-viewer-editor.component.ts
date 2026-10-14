import { OnInit, ChangeDetectorRef, Component, ElementRef, ViewChild, Input } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Subject, takeUntil } from 'rxjs';

import { MockOcrService } from './mock-ocr.service';
import { OcrDocument, OcrItem, OcrPdfItemGroup } from './ocr.model';
import { NgxExtendedPdfViewerComponent, NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';

@Component({
  selector: 'app-ocr-pdf-viewer-editor',
  imports: [CommonModule, FormsModule, NgxExtendedPdfViewerModule],
  templateUrl: './ocr-pdf-viewer-editor.component.html',
  styleUrl: './ocr-pdf-viewer-editor.component.scss',
})
export class OcrPdfViewerComponent implements OnInit {
  @ViewChild('pdfViewer')
  pdfViewer?: NgxExtendedPdfViewerComponent;

  private readonly destroy$ = new Subject<void>();

  @Input() pdfSrc = '/assets/pdf/sample-document.pdf';
  /** Disable sample OCR when displaying a user-uploaded PDF. */
  @Input() loadSampleOcr = true;

  ocrDocument?: OcrDocument;

  selectedItem?: OcrItem;

  selectedPageNumber = 1;

  isLoading = true;

  errorMessage = '';

  highlightItem?: OcrItem;
  highlightPageNumber?: number;

  constructor(
    private readonly ocrService: MockOcrService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (this.loadSampleOcr) {
      this.loadOcr();
    } else {
      this.isLoading = false;
      this.ocrDocument = undefined;
    }
  }

  loadOcr(): void {
    this.ocrService.getOcrDocument().subscribe({
      next: (ocr) => {
        this.ocrDocument = ocr;
      },
      error: (error) => {
        console.error('Failed to load OCR data', error);
      },
    });
  }

  get allOcrItems(): Array<OcrItem & { pageNumber: number }> {
    if (!this.ocrDocument) {
      return [];
    }

    return this.ocrDocument.pages.flatMap((page) =>
      page.items.map((item) => ({
        ...item,
        pageNumber: page.pageNumber,
      })),
    );
  }

  get groupedOcrItems(): OcrPdfItemGroup[] {
    const groups = new Map<string, OcrPdfItemGroup>();

    for (const item of this.allOcrItems) {
      const key = item.text.trim().toLowerCase();

      if (!groups.has(key)) {
        groups.set(key, {
          text: item.text,
          items: [],
        });
      }

      groups.get(key)!.items.push(item);
    }

    return Array.from(groups.values());
  }

  selectOcrItem(item: OcrItem): void {
    this.selectedItem = item;
    this.highlightItem = item;
    this.highlightPageNumber = item.pageNumber;

    this.goToPage(item.pageNumber);
  }

  private goToPage(pageNumber: number): void {
    if (!this.pdfViewer) {
      console.warn('PDF viewer not ready');
      return;
    }

    this.pdfViewer.page.set(pageNumber);

    this.waitForPdfPageAndHighlight(pageNumber);
  }

  private waitForPdfPageAndHighlight(pageNumber: number): void {
    let attempts = 0;

    const maxAttempts = 50;

    const checkPage = () => {
      attempts++;

      const pageElement = document.querySelector(`.page[data-page-number="${pageNumber}"]`) as HTMLElement | null;

      if (pageElement) {
        requestAnimationFrame(() => {
          this.highlightPdfItem(pageNumber);
        });

        return;
      }

      if (attempts >= maxAttempts) {
        console.warn(`PDF page ${pageNumber} was not found after ${maxAttempts} attempts`);
        return;
      }

      requestAnimationFrame(checkPage);
    };

    checkPage();
  }

  private highlightPdfItem(pageNumber: number): void {
    const item = this.highlightItem;

    if (!item) {
      console.warn('No highlight item selected');
      return;
    }

    if (item.pageNumber !== pageNumber) {
      console.warn('Page mismatch:', {
        itemPage: item.pageNumber,
        requestedPage: pageNumber,
      });

      return;
    }

    const pageElement = document.querySelector(`.page[data-page-number="${pageNumber}"]`) as HTMLElement | null;

    if (!pageElement) {
      console.warn(`PDF page ${pageNumber} not found`);
      return;
    }

    const pageWidth = pageElement.clientWidth;
    const pageHeight = pageElement.clientHeight;

    if (!pageWidth || !pageHeight) {
      console.warn('PDF page has no dimensions yet');

      // Try again after layout.
      requestAnimationFrame(() => {
        this.highlightPdfItem(pageNumber);
      });

      return;
    }

    // Remove ALL previous highlights from the PDF.
    document.querySelectorAll('.ocr-highlight').forEach((element) => element.remove());

    // PDF page is the positioning parent.
    pageElement.style.position = 'relative';
    const coordinates = this.getHighlightCoordinates(item, pageWidth, pageHeight);

    if (!coordinates) {
      return;
    }

    const { left, top, width, height } = coordinates;

    const highlight = document.createElement('div');

    highlight.className = 'ocr-highlight';

    Object.assign(highlight.style, {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: '3px solid #2196f3',
      backgroundColor: 'rgba(33, 150, 243, 0.20)',
      boxSizing: 'border-box',
      zIndex: '9999',
      pointerEvents: 'none',
    });

    pageElement.appendChild(highlight);

    highlight.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
  }

  private getHighlightCoordinates(
    item: OcrItem,
    pageWidth: number,
    pageHeight: number,
  ): {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null {
    // Pixel coordinates take priority
    if (
      item.xPixels !== undefined &&
      item.yPixels !== undefined &&
      item.widthPixels !== undefined &&
      item.heightPixels !== undefined
    ) {
      return {
        left: item.xPixels,
        top: item.yPixels,
        width: item.widthPixels,
        height: item.heightPixels,
      };
    }

    // Percentage coordinates
    if (
      item.xPercent !== undefined &&
      item.yPercent !== undefined &&
      item.widthPercent !== undefined &&
      item.heightPercent !== undefined
    ) {
      return {
        left: (item.xPercent / 100) * pageWidth,
        top: (item.yPercent / 100) * pageHeight,
        width: (item.widthPercent / 100) * pageWidth,
        height: (item.heightPercent / 100) * pageHeight,
      };
    }

    console.warn('OCR item does not contain valid coordinates:', item);

    return null;
  }

  onPageRendered(event: any): void {
    const pageNumber = event?.pageNumber ?? event?.pageIndex + 1;

    if (!pageNumber) {
      return;
    }

    if (this.highlightPageNumber === pageNumber && this.highlightItem) {
      requestAnimationFrame(() => {
        this.highlightPdfItem(pageNumber);
      });
    }
  }
}
