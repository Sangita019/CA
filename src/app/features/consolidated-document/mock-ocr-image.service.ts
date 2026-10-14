import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { OcrItem } from '../ocr-pdf-viewer-editor/ocr.model';

@Injectable({
  providedIn: 'root',
})
export class MockOcrImageService {
  private readonly mockOcrUrl = '../../../assets/jsonfiles/mock-ocr-image.json';

  constructor(private readonly http: HttpClient) {}

  getOcrItem(): Observable<OcrItem[]> {
    return this.http.get<OcrItem[]>(this.mockOcrUrl);
  }
}
