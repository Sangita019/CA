import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsolidatedDocumentComponent } from './consolidated-document.component';

describe('ConsolidatedDocumentComponent', () => {
  let fixture: ComponentFixture<ConsolidatedDocumentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsolidatedDocumentComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ConsolidatedDocumentComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should start with no selected document', () => {
    expect(fixture.componentInstance.selectedDocumentId()).toBeNull();
  });
});
