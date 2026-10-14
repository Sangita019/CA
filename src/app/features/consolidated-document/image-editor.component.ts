import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  OnChanges,
  ChangeDetectorRef,
  SimpleChanges,
} from '@angular/core';
import Cropper from 'cropperjs';

import { FormsModule } from '@angular/forms';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import {
  checkIcon,
  deleteIcon,
  backArrowIcon,
  leftRotateIcon,
  rectangleIcon,
  forwardArrowIcon,
  rightRotateIcon,
  squareCloseIcon,
  zoomInIcon,
  zoomOutIcon,
  squareIcon,
  cropImageIcon,
  cancelIcon,
  cropSimple,
  compressIcon,
  expandIcon,
} from 'src/app/constants/icons.constants';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Ng2ImgMaxService } from 'ng2-img-max';
import { MatDialog } from '@angular/material/dialog';
import { ApproverDialogComponent, DIALOG_TYPE } from 'src/app/shared/dialog/approver-dialog';
import { IEditorControlManager, IImageAction } from '../../models/editor-image.model';
import { IDocFile } from '../../models/doc-file.model';
import { EditorControl, ImageActionType } from '../../constants/image-editor.constant';
import { ASPECT_RATIO } from '../../models/constants/editor.constant';
import { ImageCarouselComponent } from './image-carousel/image-carousel.component';
import { StaffErrorMsgs } from 'src/app/constants/staff-message.constants';
import { SnackbarService } from 'src/app/shared/service/snackbar.service';
import { Content, Title } from 'src/app/constants/display.constants';
import { NgxSpinnerService } from 'ngx-spinner';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { DeviceService } from 'src/app/shared/service/device.service';
import { CommonModule } from '@angular/common';
import { OcrDisplayCoordinates, OcrImageItemGroup, OcrItem } from '../ocr-pdf-viewer-editor/ocr.model';
import { MockOcrImageService } from './mock-ocr-image.service';

@Component({
  selector: 'app-image-editor',
  imports: [FormsModule, NgbCarouselModule, FontAwesomeModule, ImageCarouselComponent, CommonModule],
  templateUrl: './image-editor.component.html',
  styleUrl: './image-editor.component.scss',
})
export class ImageEditorComponent implements OnDestroy, OnChanges {
  private _imageEditor?: ElementRef;
  @ViewChild('imageEditor') set imageEditor(ref: ElementRef) {
    this._imageEditor = ref;
    this.updateImageInEditor(this.imageFiles[this.currentSilde]);
  }

  //for icons
  rightArrow = forwardArrowIcon;
  leftArrow = backArrowIcon;
  rectangleIcon = rectangleIcon;
  checkIcon = checkIcon;
  squareCloseIcon = squareCloseIcon;
  deleteIcon = deleteIcon;
  zoomOutIcon = zoomOutIcon;
  zoomInIcon = zoomInIcon;
  leftRotateIcon = leftRotateIcon;
  rightRotateIcon = rightRotateIcon;
  squareIcon = squareIcon;
  rectangleBorderIcon = rectangleIcon;
  cropImageIcon = cropImageIcon;
  cancelIcon = cancelIcon;
  cropSimple = cropSimple;
  compressIcon = compressIcon;
  expandIcon = expandIcon;

  private cropper: Cropper | null = null;
  // for props
  @Input() imageFiles: IDocFile[] = [];
  /** Set false when the editor is bound to user-uploaded files. */
  @Input() useSampleImage = true;
  /** Set false when OCR data is supplied by the parent feature. */
  @Input() loadSampleOcr = true;
  @Input() showControls!: IEditorControlManager;
  @Output() imageAction: EventEmitter<IImageAction> = new EventEmitter<IImageAction>();
  @Input() maxCompressSizeInMb!: number;
  @Input() isStaff?: boolean = false;
  @Input() ocrItems: OcrItem[] = [];

  // variable for show controls
  EditorControl = EditorControl;
  showToolbar = false;
  appliedChanges = false; //indicates crop/rotate is applied or compress option is used
  madeChanges = false; //indicates roate right/rotate left or crop option is used and not not applied yet.
  currentSilde = 0;
  format: string = 'jpeg'; //don't change this. toDataUrl doesn't support many formats
  currentImageObj!: IDocFile;
  currentImgFileSize!: number;
  aspect = NaN;
  displayImageOverlay = false;
  cropperOptions: Cropper.Options = {
    aspectRatio: this.aspect,
    autoCropArea: 0.8,
    autoCrop: false,
    modal: true,
    guides: true,
    center: true,
    viewMode: 0,
    scalable: true,
    zoomable: true,
    background: false,
    cropBoxMovable: true,
    cropBoxResizable: true,
    movable: false,
    dragMode: 'move',
    toggleDragModeOnDblclick: false,

    zoom: () => {
      requestAnimationFrame(() => {
        this.updateOcrOverlay();
      });
    },
  };

  selectedOcrItem?: OcrItem;

  currentOcrItems: OcrItem[] = [];

  groupedOcrItems: OcrImageItemGroup[] = [];

  ocrOverlayCoordinates = new Map<string, OcrDisplayCoordinates>();

  ocrItem?: OcrItem;

  constructor(
    private ng2ImgMaxService: Ng2ImgMaxService,
    private dialog: MatDialog,
    private cdf: ChangeDetectorRef,
    private snackBar: SnackbarService,
    private spinner: NgxSpinnerService,
    private deviceService: DeviceService,
    private readonly ocrService: MockOcrImageService,
  ) {}

  showImageOverlay() {
    this.displayImageOverlay = true;
  }
  hideImageOverlay() {
    this.displayImageOverlay = false;
  }
  setControls() {
    if (this.showControls && this.showControls.controls.length > 0) {
      this.showToolbar = true;

      if (this.showControls.controls.includes(EditorControl.PHOTOCROP)) this.aspect = ASPECT_RATIO.PHOTO;
      if (this.showControls.controls.includes(EditorControl.SIGNCROP)) this.aspect = ASPECT_RATIO.SIGNATURE;
      if (this.deviceService.isMobileOrTab()) {
        //remove zoom buttons as the user can pinch zoom
        this.showControls.controls = this.showControls.controls.filter((control) => control != EditorControl.ZOOM);
      }
    } else {
      this.showToolbar = false;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes['imageFiles'] &&
      changes['imageFiles'].previousValue !== this.imageFiles &&
      this.imageFiles.length > 0
    ) {
      this.currentSilde = this.imageFiles.length - 1; //select the last uploaded item to show
      this.updateImageInEditor(this.imageFiles[this.currentSilde]);
    }
    if (changes['showControls'] && changes['showControls'].previousValue !== this.showControls) {
      this.setControls();
    }
  }

  ngOnInit(): void {
    this.loadTestImage();
    this.loadOcr();
  }

  loadOcr(): void {
    this.ocrService.getOcrItem().subscribe({
      next: (ocr) => {
        this.ocrItems = ocr;
        this.currentOcrItems = ocr;

        this.selectedOcrItem = undefined;
        this.groupOcrItems();

        if (this.cropper) {
          this.updateOcrOverlay();
        }

        this.cdf.detectChanges();
      },
      error: (error) => {
        console.error('Failed to load OCR data', error);
      },
    });
  }

  private loadTestImage(): void {
    fetch('/assets/images/ocr-test.jpg')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status}`);
        }

        return response.blob();
      })
      .then((blob) => {
        const reader = new FileReader();

        reader.onload = () => {
          const dataUrl = reader.result as string;

          const content = dataUrl.split(',')[1];

          this.imageFiles = [
            {
              content,
              fileId: null,
              localFileId: 'test-image-1',
            },
          ];

          this.currentSilde = 0;
          this.updateImageInEditor(this.imageFiles[0]);
        };

        reader.onerror = () => {
          console.error('Failed to convert test image to base64');
        };

        reader.readAsDataURL(blob);
      })
      .catch((error) => {
        console.error('Failed to load test image:', error);
      });
  }

  ngOnDestroy(): void {
    if (this.cropper) {
      this.cropper.destroy();
    }
  }

  updateImageInEditor(file: IDocFile) {
    this.appliedChanges = false;
    this.madeChanges = false;
    if (file.localFileId === this.currentImageObj?.localFileId && file.content === this.currentImageObj.content) {
      this.currentImageObj.fileId = file.fileId; //in case of file upload, after upload, this will update the reference
      return;
    }
    if (!this._imageEditor) {
      return;
    }
    if (this.cropper) {
      this.cropper.destroy(); // destroing old image editor frame
    }
    this.currentImageObj = { ...file };
    this.currentImgFileSize = this.getB64ImgSize(file.content);
    this.cdf.detectChanges();
  }

  onImageLoadInEditor() {
    const imageElement = this._imageEditor!.nativeElement;
    this.cropper = new Cropper(imageElement, this.cropperOptions);

    this.setCurrentOcrItems();

    requestAnimationFrame(() => {
      this.updateOcrOverlay();
    });
  }

  rotateRight() {
    this.madeChanges = true;
    this.cropper!.rotate(90);
  }

  rotateLeft() {
    this.madeChanges = true;
    this.cropper!.rotate(-90);
  }

  crop(left?: number, right?: number) {
    this.madeChanges = true;
    // if left and right present then crop as per aspect ratio given
    if (left && right) {
      this.aspect = left / right;
      this.cropper!.setAspectRatio(left / right);
    } else {
      this.aspect = NaN;
      this.cropper!.setAspectRatio(NaN);
    }
    this.cropper!.setDragMode('move');
    this.cropper!.crop();
  }

  move() {
    this.cropper!.setDragMode('move');
  }

  zoomIn() {
    this.cropper!.zoom(0.1);
  }

  zoomOut() {
    this.cropper!.zoom(-0.1);
  }

  flipH() {
    this.cropper!.scaleX(-this.cropper!.getImageData().scaleX);
  }

  flipV() {
    this.cropper!.scaleY(-this.cropper!.getImageData().scaleY);
  }

  reset() {
    this.cropper?.clear(); //clears the crop
    this.cropper?.reset(); //clears zoom, rotate
    this.updateImageInEditor(this.imageFiles[this.currentSilde]);
    return;
  }

  applyChanges() {
    if (!this.madeChanges) {
      this.snackBar.info(StaffErrorMsgs.NO_CHANGE_TO_APPLY);
      return;
    }
    const cropedImage = this.cropper!.getCroppedCanvas({
      imageSmoothingEnabled: true, //this is required to avoid text quality loss/pixelation of text on crop
      imageSmoothingQuality: 'high',
      fillColor: 'white',
      maxHeight: 1000,
      maxWidth: 1000,
    });

    if (!cropedImage) {
      this.snackBar.error(StaffErrorMsgs.ERROR_NO_CANVAS_ON_APPLY);
      return;
    }
    const outputImage = cropedImage.toDataURL('image/' + this.format, 1); // toDataURL return base64
    this.updateImageInEditor({ ...this.currentImageObj, content: this.trimMimeDataFromImg(outputImage) });
    this.appliedChanges = true;
  }

  slideBack() {
    if (this.currentSilde > 0) {
      this.currentSilde = this.currentSilde - 1;
      this.updateImageInEditor(this.imageFiles[this.currentSilde]);
    }
  }

  slideNext() {
    if (this.currentSilde + 1 < this.imageFiles.length) {
      this.currentSilde = this.currentSilde + 1;

      this.updateImageInEditor(this.imageFiles[this.currentSilde]);
    }
  }

  setCarouselImg(index: number) {
    if (this.currentSilde !== index) {
      this.currentSilde = index;
      this.updateImageInEditor(this.imageFiles[this.currentSilde]);
    }
  }

  getB64ImgSize(base64File: string) {
    const data = base64File.split(',')[1] || base64File;
    const padding = (data.match(/=+$/) || [''])[0].length;
    return (data.length * 3) / 4 - padding;
  }

  compressImage() {
    if (this.madeChanges) {
      this.snackBar.info(StaffErrorMsgs.APPLY_CHANGES_FIRST);
      return;
    }
    this.compressCurrentImage$.subscribe();
  }

  compressCurrentImage$: Observable<unknown> = of(null).pipe(
    map(() => {
      if (this.currentImgFileSize < this.maxCompressSizeInMb * 1024 * 1024) {
        throw new Error(StaffErrorMsgs.ALREADY_COMPRESSED);
      }
      if (!this.currentImageObj) {
        throw new Error(StaffErrorMsgs.COMPRESSION_ERR);
      }
      this.spinner.show();
      const res = this.dataURItoBlob(this.currentImageObj.content, 'image/' + this.format);
      const finalImg = new File([res], Date.now() + '.' + this.format, { type: 'image/' + this.format });
      return finalImg;
    }),
    switchMap((img: File) => this.ng2ImgMaxService.resizeImage(img, 1000, 1000)),
    //no need to check file size before compress. If size is less than required size, the compress method will not have any effect
    switchMap((resizedImg) => this.ng2ImgMaxService.compressImage(resizedImg, this.maxCompressSizeInMb)),
    switchMap((compressedImg) => this.fileToBase64$(compressedImg)),
    map((base64Img) => {
      this.updateImageInEditor({
        ...this.currentImageObj,
        content: this.trimMimeDataFromImg(base64Img),
      });
      this.appliedChanges = true;
      this.spinner.hide();
    }),
    catchError((err: Error) => {
      this.spinner.hide();
      this.snackBar.error(err.message);
      return of();
    }),
  );

  dataURItoBlob(dataURI: string, contentType: string) {
    const byteString = atob(dataURI);

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    const bb = new Blob([ab], { type: contentType });
    return bb;
  }

  submit() {
    if (this.madeChanges) {
      this.snackBar.info(StaffErrorMsgs.APPLY_CHANGES_FIRST);
      return;
    }
    const diagRef = this.dialog.open(ApproverDialogComponent, {
      data: {
        type: DIALOG_TYPE.CONFIRM,
        content: Content.REPLACE_FILE,
        title: Title.REPLACE_FILE,
      },
    });
    diagRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        if (this.currentImgFileSize > this.maxCompressSizeInMb * 1024 * 1024) {
          this.compressCurrentImage$.subscribe(() => {
            this.imageAction.emit({
              ...this.currentImageObj,
              action: ImageActionType.SUBMIT,
            });
          });
        } else {
          this.imageAction.emit({
            ...this.currentImageObj,
            action: ImageActionType.SUBMIT,
          });
        }
      }
    });
  }

  deleteImage() {
    const diagRef = this.dialog.open(ApproverDialogComponent, {
      data: {
        type: DIALOG_TYPE.CONFIRM,
        content: Content.DELETE_IMAGE,
        title: Title.DELETE_IMAGE,
      },
    });
    diagRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.imageAction.emit({
          content: '',
          fileId: this.currentImageObj.fileId,
          localFileId: this.currentImageObj.localFileId,
          action: ImageActionType.DELETE,
        });
        this.slideBack();
      }
    });
  }

  trimMimeDataFromImg(image: string) {
    return image.split(',').length > 1 ? image.split(',')[1] : image;
  }

  fileToBase64$(file: File): Observable<string> {
    return new Observable<string>((observer) => {
      const reader = new FileReader();

      reader.onload = () => {
        observer.next(reader.result as string);
        observer.complete();
      };

      reader.onerror = (err) => {
        observer.error(err);
      };

      reader.readAsDataURL(file);

      // Optional cleanup
      return () => {
        reader.abort();
      };
    });
  }

  get isKycCompliant() {
    return this.currentImgFileSize / 1048576 <= this.maxCompressSizeInMb;
  }

  selectOcrItem(item: OcrItem): void {
    this.selectedOcrItem = item;

    this.updateOcrOverlay();

    this.cdf.detectChanges();
  }

  updateOcrOverlay(): void {
    this.ocrOverlayCoordinates.clear();

    if (!this.selectedOcrItem || !this.cropper) {
      this.cdf.detectChanges();
      return;
    }

    const imageData = this.cropper.getImageData();
    const canvasData = this.cropper.getCanvasData();

    if (!imageData.width || !imageData.height) {
      return;
    }

    const item = this.selectedOcrItem;

    const coordinates: OcrDisplayCoordinates = {
      left: canvasData.left + imageData.left + (item.xPercent / 100) * imageData.width,

      top: canvasData.top + imageData.top + (item.yPercent / 100) * imageData.height,

      width: (item.widthPercent / 100) * imageData.width,

      height: (item.heightPercent / 100) * imageData.height,
    };

    this.ocrOverlayCoordinates.set(item.id, coordinates);

    this.cdf.detectChanges();
  }

  getOcrCoordinates(item: OcrItem): OcrDisplayCoordinates | undefined {
    return this.ocrOverlayCoordinates.get(item.id);
  }

  private setCurrentOcrItems(): void {
    this.currentOcrItems = this.ocrItems ?? [];

    this.selectedOcrItem = undefined;
    this.groupOcrItems();
    this.updateOcrOverlay();
  }

  private normalizeOcrText(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private groupOcrItems(): void {
    const groups = new Map<string, OcrImageItemGroup>();

    for (const item of this.currentOcrItems) {
      const key = this.normalizeOcrText(item.text);

      if (!groups.has(key)) {
        groups.set(key, {
          text: item.text,
          items: [],
        });
      }

      groups.get(key)!.items.push(item);
    }

    this.groupedOcrItems = Array.from(groups.values());
  }

  isOcrItemMatching(item: OcrItem): boolean {
    if (!this.selectedOcrItem) {
      return false;
    }

    return this.normalizeOcrText(item.text) === this.normalizeOcrText(this.selectedOcrItem.text);
  }
}
