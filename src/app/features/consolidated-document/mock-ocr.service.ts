import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { OcrDocument } from './ocr.model';

@Injectable({
  providedIn: 'root',
})
export class MockOcrService {
  private readonly mockOcrUrl = '../../../assets/jsonfiles/mock-ocr.json';

  constructor(private readonly http: HttpClient) {}

  getOcrDocument(): Observable<OcrDocument> {
    return this.http.get<OcrDocument>(this.mockOcrUrl);
  }
}
