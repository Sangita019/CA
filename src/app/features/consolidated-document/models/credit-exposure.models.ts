export type CreditExposureAnswer = 'yes' | 'no';

export interface CreditExposureRequest {
  readonly hasOtherBankExposure: CreditExposureAnswer;
}

export interface CreditExposureMetric {
  readonly parameter: string;
  readonly result: string;
  readonly assessment: 'GREEN' | 'AMBER' | 'RED';
  readonly assessmentText: string;
}

export interface CreditExposureReport {
  readonly referenceId: string;
  readonly fetchedAt: string;
  readonly decision: 'Eligible to proceed' | 'Review required' | 'Not eligible';
  readonly decisionTone: 'GREEN' | 'AMBER' | 'RED';
  readonly metrics: readonly CreditExposureMetric[];
  readonly reportUrl: string | null;
}
