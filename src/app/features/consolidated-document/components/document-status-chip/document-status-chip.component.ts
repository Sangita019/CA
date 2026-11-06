import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type DocumentStatusTone = 'neutral' | 'info' | 'success' | 'warning';

@Component({
  selector: 'ca-document-status-chip',
  standalone: true,
  templateUrl: './document-status-chip.component.html',
  styleUrl: './document-status-chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentStatusChipComponent {
  readonly label = input.required<string>();
  readonly tone = input<DocumentStatusTone>('neutral');
  readonly cssClass = computed(() => `status-chip--${this.tone()}`);
}