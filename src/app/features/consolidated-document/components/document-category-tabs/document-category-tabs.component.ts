import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ConsolidatedDocumentTab } from '../../models/consolidated-document.models';

@Component({
  selector: 'ca-document-category-tabs',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './document-category-tabs.component.html',
  styleUrl: './document-category-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentCategoryTabsComponent {
  readonly tabs = input.required<readonly ConsolidatedDocumentTab[]>();
  readonly selectedIndex = input.required<number>();
  readonly tabSelected = output<number>();
}