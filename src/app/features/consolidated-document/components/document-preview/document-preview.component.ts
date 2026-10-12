import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { UploadedDocumentFile } from '../../models/consolidated-document.models';

@Component({
  selector: 'ca-document-preview',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './document-preview.component.html',
  styleUrl: './document-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentPreviewComponent {
  readonly files = input.required<readonly UploadedDocumentFile[]>();
  readonly selectedFileId = input<string | null>(null);
  readonly fileSelected = output<string>();
  readonly previewFile = computed(() => this.files().find((file) => file.id === this.selectedFileId()) ?? this.files()[0] ?? null);
}