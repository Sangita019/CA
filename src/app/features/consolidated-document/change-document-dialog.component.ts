import {
  ChangeDetectionStrategy,
  Component,
  inject
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ChangeDocumentDialogData {
  readonly currentDocument: string;
}

@Component({
  selector: 'ca-change-document-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './change-document-dialog.component.html',
  styleUrl: './change-document-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangeDocumentDialogComponent {
  readonly data = inject<ChangeDocumentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ChangeDocumentDialogComponent>);

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    this.dialogRef.close(true);
  }
}
