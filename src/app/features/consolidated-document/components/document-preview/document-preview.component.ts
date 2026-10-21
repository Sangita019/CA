import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
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
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => {
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext('2d');
          if (!context) {
            bitmap.close();
            throw new Error('Could not prepare image preview.');
          }
          context.drawImage(bitmap, 0, 0);
          bitmap.close();
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          return dataUrl.slice(dataUrl.indexOf(',') + 1);
        })
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