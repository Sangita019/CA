import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { OcrResult } from '../../models/consolidated-document.models';

@Component({
  selector: 'ca-ocr-response',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  templateUrl: './ocr-response.component.html',
  styleUrl: './ocr-response.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OcrResponseComponent {
  readonly result = input.required<OcrResult>();
  readonly documentIdControl = input.required<FormControl<string>>();
  readonly confirmationMessage = input<string | null>(null);
  readonly documentIdConfirmed = input(false);
  readonly confirmRequested = output<void>();
}