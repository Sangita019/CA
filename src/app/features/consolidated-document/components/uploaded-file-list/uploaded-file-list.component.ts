import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { UploadedDocumentFile } from '../../models/consolidated-document.models';

@Component({
  selector: 'ca-uploaded-file-list',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './uploaded-file-list.component.html',
  styleUrl: './uploaded-file-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploadedFileListComponent {
  readonly files = input<readonly UploadedDocumentFile[]>([]);
  readonly removeRequested = output<string>();
}
