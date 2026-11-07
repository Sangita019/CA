import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { CREDIT_EXPOSURE_GATEWAY } from '../../services/credit-exposure.gateway';
import { CreditExposureAnswer, CreditExposureReport } from '../../models/credit-exposure.models';

@Component({
  selector: 'ca-credit-exposure-check',
  standalone: true,
  imports: [MatButtonModule, ReactiveFormsModule],
  templateUrl: './credit-exposure-check.component.html',
  styleUrl: './credit-exposure-check.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditExposureCheckComponent {
  readonly form = new FormGroup({
    hasOtherBankExposure: new FormControl<CreditExposureAnswer | null>(null, Validators.required)
  });
  readonly report = signal<CreditExposureReport | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  private readonly gateway = inject(CREDIT_EXPOSURE_GATEWAY);
  private readonly destroyRef = inject(DestroyRef);

  fetchReport(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    const answer = this.form.controls.hasOtherBankExposure.value;
    if (!answer) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.report.set(null);
    this.gateway.fetchReport({ hasOtherBankExposure: answer })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.report.set(report);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('Unable to fetch the CRIF report. Please try again.');
        }
      });
  }

  formattedFetchedAt(value: string): string {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    }).format(new Date(value));
  }
}
