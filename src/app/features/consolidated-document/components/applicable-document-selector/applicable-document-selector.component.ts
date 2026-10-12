import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { ConsolidatedDocumentOption } from '../../models/consolidated-document.models';

@Component({
  selector: 'ca-applicable-document-selector',
  standalone: true,
  imports: [MatCardModule, MatRadioModule],
  templateUrl: './applicable-document-selector.component.html',
  styleUrl: './applicable-document-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApplicableDocumentSelectorComponent {
  readonly documents = input.required<readonly ConsolidatedDocumentOption[]>();
  readonly selectedDocumentId = input<string | null>(null);
  readonly unavailableDocumentIds = input<ReadonlySet<string>>(new Set<string>());
  readonly documentSelected = output<string>();
}