import { TestBed } from '@angular/core/testing';
import { CreditExposureCheckComponent } from './credit-exposure-check.component';

describe('CreditExposureCheckComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreditExposureCheckComponent]
    }).compileComponents();
  });

  it('creates the reactive credit exposure form', () => {
    const fixture = TestBed.createComponent(CreditExposureCheckComponent);
    expect(fixture.componentInstance.form.controls.hasOtherBankExposure.value).toBeNull();
  });
});
