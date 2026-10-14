import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { closeIcon } from 'src/app/constants/icons.constants';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { IDocFile } from '../../../models/doc-file.model';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-image-carousel',
    imports: [FontAwesomeModule, NgbCarouselModule, MatButtonModule],
    templateUrl: './image-carousel.component.html',
    styleUrl: './image-carousel.component.scss'
})
export class ImageCarouselComponent {
  /**
   * Array of base64 encoded images to be displayed as carousel in full screen
   */
  @Input() carsouselImages: IDocFile[] = [];
  @Output() hideImageOverlay = new EventEmitter();

  closeIcon = closeIcon;

  close() {
    this.hideImageOverlay.emit();
  }
}
