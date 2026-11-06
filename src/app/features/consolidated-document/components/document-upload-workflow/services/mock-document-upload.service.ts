import { Injectable } from '@angular/core';
import { DocumentUploadGateway } from '../../../services/document-workflow-gateways';
import { Observable, interval } from 'rxjs';
import { map, take } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class MockDocumentUploadService implements DocumentUploadGateway {
  upload(_file: File): Observable<number> {
    return interval(120).pipe(
      take(11),
      map((tick) => tick * 10)
    );
  }
}
