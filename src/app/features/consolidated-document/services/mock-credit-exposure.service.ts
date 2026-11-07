import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { CreditExposureGateway } from './credit-exposure.gateway';
import { CreditExposureReport, CreditExposureRequest } from '../models/credit-exposure.models';

/** Local demonstration data only. Replace this gateway implementation with HttpClient when the CRIF API contract is available. */
@Injectable({ providedIn: 'root' })
export class MockCreditExposureService implements CreditExposureGateway {
  fetchReport(request: CreditExposureRequest): Observable<CreditExposureReport> {
    const metrics = request.hasOtherBankExposure === 'yes'
      ? [
          { parameter: 'Bureau score', result: '742', assessment: 'GREEN' as const, assessmentText: 'Within the acceptable band' },
          { parameter: 'Overdue / SMA accounts', result: 'None', assessment: 'GREEN' as const, assessmentText: 'No overdue accounts' },
          { parameter: 'Written-off / suit-filed accounts', result: 'None', assessment: 'GREEN' as const, assessmentText: 'No adverse accounts' },
          { parameter: 'Exposure with other banks', result: '21.45 crore · 2 facilities', assessment: 'GREEN' as const, assessmentText: 'Within the Bank’s exposure requirements' }
        ]
      : [
          { parameter: 'Bureau score', result: '742', assessment: 'GREEN' as const, assessmentText: 'Within the acceptable band' },
          { parameter: 'Overdue / SMA accounts', result: 'None', assessment: 'GREEN' as const, assessmentText: 'No overdue accounts' },
          { parameter: 'Written-off / suit-filed accounts', result: 'None', assessment: 'GREEN' as const, assessmentText: 'No adverse accounts' },
          { parameter: 'Exposure with other banks', result: 'No exposure declared', assessment: 'GREEN' as const, assessmentText: 'No other-bank exposure declared' }
        ];

    return of({
      referenceId: `MOCK-CRIF-${Date.now()}`,
      fetchedAt: new Date().toISOString(),
      decision: 'Eligible to proceed' as const,
      decisionTone: 'GREEN' as const,
      metrics,
      reportUrl: null
    }).pipe(delay(700));
  }
}
