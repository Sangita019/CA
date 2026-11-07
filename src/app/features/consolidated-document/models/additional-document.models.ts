import { ConsolidatedDocumentOption } from './consolidated-document.models';

export const ADDITIONAL_DOCUMENT_OPTIONS: readonly ConsolidatedDocumentOption[] = [
  { id: 'additional-registration-certificate', label: 'Registration Certificate', required: false },
  { id: 'additional-udyam-registration', label: 'Udyam Registration Certificate', required: false },
  { id: 'additional-gst-certificate', label: 'GST Certificate', required: false },
  { id: 'additional-import-export-code', label: 'Importer Exporter Code (IEC)', required: false },
  { id: 'additional-trade-certificate', label: 'Trade Certificate', required: false },
  { id: 'additional-shop-establishment', label: 'Certificate issued under Shop & Establishment Act', required: false },
  { id: 'additional-income-tax-return', label: 'Income Tax Return', required: false },
  { id: 'additional-gst-return', label: 'GST Return', required: false },
  { id: 'additional-license-to-practice', label: 'License to Practice', required: false },
  { id: 'additional-declaration', label: 'Declaration', required: false },
  { id: 'additional-list-of-names', label: 'List of Names', required: false },
  { id: 'additional-shareholding-pattern', label: 'Share Holding Pattern', required: false },
  { id: 'additional-sebi-document', label: 'SEBI Document', required: false },
  { id: 'additional-rbi-license', label: 'RBI License', required: false },
  { id: 'additional-government-letter', label: 'Letter from Organisation (government letter)', required: false },
  { id: 'additional-partnership-letter', label: 'Partnership Letter (COS-37)', required: false },
  { id: 'additional-rent-agreement', label: 'Rent Agreement (under Others)', required: false },
  { id: 'additional-miscellaneous', label: 'Others (Miscellaneous Document)', required: false }
];
