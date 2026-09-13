import { describe, expect, it } from 'vitest';
import { CONFIDENCE_BANDS, DIVERGENCE_REASONS, bucketFromPercent } from '../../lib/adherence';
import { POLICY_VERSIONS, mockAdherenceRecords, mockOffices } from './adherence';

describe('mockAdherenceRecords', () => {
  it('cobre pelo menos 3 escritórios distintos', () => {
    const officeIds = new Set(mockAdherenceRecords.map((r) => r.office_id));
    expect(officeIds.size).toBeGreaterThanOrEqual(3);
  });

  it('todo office_id do dataset existe em mockOffices', () => {
    const knownIds = new Set(mockOffices.map((o) => o.id));
    for (const record of mockAdherenceRecords) {
      expect(knownIds.has(record.office_id)).toBe(true);
    }
  });

  it('registros aceitos não têm motivo de divergência, e divergentes sempre têm', () => {
    for (const record of mockAdherenceRecords) {
      if (record.accepted) expect(record.divergence_reason).toBeNull();
      else expect(record.divergence_reason).not.toBeNull();
    }
  });

  it('cobre os 5 motivos de divergência pelo menos uma vez', () => {
    const reasonsPresent = new Set(mockAdherenceRecords.filter((r) => !r.accepted).map((r) => r.divergence_reason));
    for (const reason of DIVERGENCE_REASONS) {
      expect(reasonsPresent.has(reason)).toBe(true);
    }
  });

  it('cobre as 3 bandas de confiança pelo menos uma vez', () => {
    const bandsPresent = new Set(mockAdherenceRecords.map((r) => bucketFromPercent(r.confidence_percent)));
    for (const band of CONFIDENCE_BANDS) {
      expect(bandsPresent.has(band)).toBe(true);
    }
  });

  it('tem pelo menos um registro sem confiança calculada (confidence_percent null)', () => {
    expect(mockAdherenceRecords.some((r) => r.confidence_percent === null)).toBe(true);
  });

  it('cobre pelo menos 2 versões de política', () => {
    expect(POLICY_VERSIONS.length).toBeGreaterThanOrEqual(2);
    const versionsPresent = new Set(mockAdherenceRecords.map((r) => r.policy_version));
    expect(versionsPresent.size).toBeGreaterThanOrEqual(2);
  });
});
