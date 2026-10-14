import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { OcrPdfViewerComponent } from '../../ocr-pdf-viewer-editor.component';
import { ImageEditorComponent } from '../../image-editor.component';
import { UploadedDocumentFile } from '../../models/consolidated-document.models';

@Component({
  selector: 'ca-document-preview',
  standalone: true,
  imports: [MatButtonModule, OcrPdfViewerComponent, ImageEditorComponent],
  templateUrl: './document-preview.component.html',
  styleUrl: './document-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentPreviewComponent {
  readonly files = input.required<readonly UploadedDocumentFile[]>();
  readonly selectedFileId = input<string | null>(null);
  readonly fileSelected = output<string>();
  readonly previewFile = computed(() => this.files().find((file) => file.id === this.selectedFileId()) ?? this.files()[0] ?? null);
  readonly imageEditorFiles = signal<Array<{ content: string; fileId: null; localFileId: string }>>([]);
  readonly imageEditorControls = { controls: [], isEditable: false };
  private conversionVersion = 0;
  private readonly sanitizer = inject(DomSanitizer);
  readonly safePreviewUrl = computed<SafeResourceUrl | null>(() => {
    const file = this.previewFile();
    return file?.type === 'pdf' ? this.sanitizer.bypassSecurityTrustResourceUrl(file.objectUrl) : null;
  });

  constructor() {
    effect(() => {
      const file = this.previewFile();
      const version = ++this.conversionVersion;
      this.imageEditorFiles.set([]);
      if (!file || file.type !== 'image') return;
      void fetch(file.objectUrl)
        .then((response) => {
          if (!response.ok) throw new Error('Could not read uploaded image.');
          return response.blob();
        })
        .then((blob) => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
          reader.onerror = () => reject(new Error('Could not convert uploaded image.'));
          reader.readAsDataURL(blob);
        }))
        .then((content) => {
          if (version === this.conversionVersion) {
            this.imageEditorFiles.set([{ content, fileId: null, localFileId: file.id }]);
          }
        })
        .catch(() => {
          if (version === this.conversionVersion) this.imageEditorFiles.set([]);
        });
    });
  }
}