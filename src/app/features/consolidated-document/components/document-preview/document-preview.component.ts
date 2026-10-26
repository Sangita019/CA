import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { OcrPdfViewerComponent } from '../../ocr-pdf-viewer-editor.component';
import { ImageEditorComponent } from '../../image-editor.component';
import { UploadedDocumentFile } from '../../models/consolidated-document.models';

type PreviewDocumentFile = UploadedDocumentFile & { readonly sourceFile?: File };

@Component({
  selector: 'ca-document-preview',
  standalone: true,
  imports: [MatButtonModule, OcrPdfViewerComponent, ImageEditorComponent],
  templateUrl: './document-preview.component.html',
  styleUrl: './document-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentPreviewComponent {
  readonly files = input.required<readonly PreviewDocumentFile[]>();
  readonly selectedFileId = input<string | null>(null);
  readonly fileSelected = output<string>();
  readonly previewFile = computed(() => this.files().find((file) => file.id === this.selectedFileId()) ?? this.files()[0] ?? null);
  readonly imageEditorFiles = signal<Array<{ content: string; fileId: null; localFileId: string }>>([]);
  readonly pdfViewerSource = signal<Uint8Array | null>(null);
  readonly pdfPreviewError = signal<string | null>(null);
  readonly imageEditorControls = { controls: [], isEditable: false };
  private conversionVersion = 0;

  constructor() {
    effect(() => {
      const file = this.previewFile();
      const version = ++this.conversionVersion;
      this.imageEditorFiles.set([]);
      this.pdfViewerSource.set(null);
      this.pdfPreviewError.set(null);
      if (!file) return;
      if (file.type !== 'image') {
        const source = file.sourceFile
          ? file.sourceFile.arrayBuffer()
          : fetch(file.objectUrl).then((response) => {
              if (!response.ok) throw new Error('Could not read uploaded PDF.');
              return response.arrayBuffer();
            });
        void source
          .then((buffer) => {
            if (version === this.conversionVersion) {
              this.pdfViewerSource.set(new Uint8Array(buffer));
            }
          })
          .catch(() => {
            if (version === this.conversionVersion) {
              this.pdfPreviewError.set('Unable to load this PDF preview. Please remove the file and upload it again.');
            }
          });
        return;
      }
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
