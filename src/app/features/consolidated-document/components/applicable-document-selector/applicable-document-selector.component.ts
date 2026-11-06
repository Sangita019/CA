import { ChangeDetectionStrategy, Component, forwardRef, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { ConsolidatedDocumentOption } from '../../models/consolidated-document.models';

@Component({
  selector: 'ca-applicable-document-selector',
  standalone: true,
  imports: [MatCardModule, MatChipsModule],
  templateUrl: './applicable-document-selector.component.html',
  styleUrl: './applicable-document-selector.component.scss',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => ApplicableDocumentSelectorComponent),
    multi: true
  }],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApplicableDocumentSelectorComponent implements ControlValueAccessor {
  readonly documents = input.required<readonly ConsolidatedDocumentOption[]>();
  readonly unavailableDocumentIds = input<ReadonlySet<string>>(new Set<string>());
  readonly unavailableDocumentMessages = input<ReadonlyMap<string, string>>(new Map<string, string>());
  readonly documentSelected = output<string>();
  readonly selectedDocumentId = signal<string | null>(null);
  readonly disabled = signal(false);

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.selectedDocumentId.set(value);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onDocumentChange(documentId: string): void {
    if (this.disabled() || this.unavailableDocumentIds().has(documentId)) return;
    this.selectedDocumentId.set(documentId);
    this.onChange(documentId);
    this.onTouched();
    this.documentSelected.emit(documentId);
  }
}