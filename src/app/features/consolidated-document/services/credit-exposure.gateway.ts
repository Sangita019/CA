import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreditExposureReport, CreditExposureRequest } from '../models/credit-exposure.models';
import { MockCreditExposureService } from './mock-credit-exposure.service';

export interface CreditExposureGateway {
  fetchReport(request: CreditExposureRequest): Observable<CreditExposureReport>;
}

export const CREDIT_EXPOSURE_GATEWAY = new InjectionToken<CreditExposureGateway>(
  'CREDIT_EXPOSURE_GATEWAY',
  { providedIn: 'root', factory: () => inject(MockCreditExposureService) }
);
