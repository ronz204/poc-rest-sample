import { describe, it, expect } from 'vitest';
import { Rule } from '@context/engine/entities/rule.entity';
import type { CreateAction } from '@context/engine/entities/rule.interfaces';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const base: CreateAction = {
  flagId: 'flag-id',
  segmentId: 'segment-id',
  priority: 1,
  outcome: true,
  rollout: 50,
};

const makeRule = (overrides: Partial<CreateAction> = {}) => {
  const result = Rule.factory({ ...base, ...overrides });
  if (!result.ok) throw new Error(`Unexpected factory failure: ${JSON.stringify(result.error)}`);
  return result.value;
};

// ---------------------------------------------------------------------------

describe('Rule.factory()', () => {
  it('F-01: creates a valid rule with all fields', () => {
    const result = Rule.factory(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.flagId).toBe(base.flagId);
    expect(result.value.segmentId).toBe(base.segmentId);
    expect(result.value.priority).toBe(base.priority);
    expect(result.value.outcome).toBe(base.outcome);
    expect(result.value.rollout).toBe(base.rollout);
  });

  it('F-02: defaults rollout to 100 when omitted', () => {
    const { rollout: _omitted, ...withoutRollout } = base;
    const result = Rule.factory(withoutRollout);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rollout).toBe(100);
  });

  it('F-03: accepts outcome = false', () => {
    const result = Rule.factory({ ...base, outcome: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe(false);
  });

  it('F-04: accepts rollout at lower bound (0)', () => {
    const result = Rule.factory({ ...base, rollout: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rollout).toBe(0);
  });

  it('F-05: accepts rollout at upper bound (100)', () => {
    const result = Rule.factory({ ...base, rollout: 100 });
    expect(result.ok).toBe(true);
  });

  it('F-06: generates unique ids on each call', () => {
    const a = Rule.factory(base);
    const b = Rule.factory(base);
    if (!a.ok || !b.ok) return;
    expect(a.value.id).not.toBe(b.value.id);
  });

  it('F-07: generated id is a UUID v4', () => {
    const result = Rule.factory(base);
    if (!result.ok) return;
    expect(result.value.id).toMatch(UUID_PATTERN);
  });

  it('F-08: rejects priority = 0', () => {
    const result = Rule.factory({ ...base, priority: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: 'INVALID_RULE_PRIORITY', priority: 0 });
  });

  it('F-09: rejects negative priority', () => {
    const result = Rule.factory({ ...base, priority: -1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: 'INVALID_RULE_PRIORITY', priority: -1 });
  });

  it('F-10: rejects negative rollout', () => {
    const result = Rule.factory({ ...base, rollout: -1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: 'INVALID_RULE_ROLLOUT', rollout: -1 });
  });

  it('F-11: rejects rollout above 100', () => {
    const result = Rule.factory({ ...base, rollout: 101 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: 'INVALID_RULE_ROLLOUT', rollout: 101 });
  });
});

// ---------------------------------------------------------------------------

describe('rule.refresh()', () => {
  it('R-01: updates priority, leaves other fields unchanged', () => {
    const rule = makeRule();
    const result = rule.refresh({ priority: 2 });
    expect(result.ok).toBe(true);
    expect(rule.priority).toBe(2);
    expect(rule.outcome).toBe(base.outcome);
    expect(rule.rollout).toBe(base.rollout);
    expect(rule.segmentId).toBe(base.segmentId);
  });

  it('R-02: updates outcome', () => {
    const rule = makeRule();
    const result = rule.refresh({ outcome: false });
    expect(result.ok).toBe(true);
    expect(rule.outcome).toBe(false);
  });

  it('R-03: updates segmentId', () => {
    const rule = makeRule();
    const result = rule.refresh({ segmentId: 'other-segment' });
    expect(result.ok).toBe(true);
    expect(rule.segmentId).toBe('other-segment');
  });

  it('R-04: updates rollout to a specific value', () => {
    const rule = makeRule();
    const result = rule.refresh({ rollout: 25 });
    expect(result.ok).toBe(true);
    expect(rule.rollout).toBe(25);
  });

  it('R-05: sets rollout to null (removes rollout filter)', () => {
    const rule = makeRule();
    const result = rule.refresh({ rollout: null });
    expect(result.ok).toBe(true);
    expect(rule.rollout).toBeNull();
  });

  it('R-06: empty cmd succeeds without mutating anything', () => {
    const rule = makeRule();
    const before = rule.primitives();
    const result = rule.refresh({});
    expect(result.ok).toBe(true);
    expect(rule.primitives()).toEqual(before);
  });

  it('R-07: updates multiple fields simultaneously', () => {
    const rule = makeRule();
    const originalSegmentId = rule.segmentId;
    rule.refresh({ priority: 3, outcome: false, rollout: 10 });
    expect(rule.priority).toBe(3);
    expect(rule.outcome).toBe(false);
    expect(rule.rollout).toBe(10);
    expect(rule.segmentId).toBe(originalSegmentId);
  });

  it('R-08: rejects priority < 1, does not mutate state', () => {
    const rule = makeRule({ priority: 1 });
    const result = rule.refresh({ priority: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('INVALID_RULE_PRIORITY');
    expect(rule.priority).toBe(1);
  });

  it('R-09: rejects rollout out of range, does not mutate state', () => {
    const rule = makeRule({ rollout: 50 });
    const result = rule.refresh({ rollout: 101 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('INVALID_RULE_ROLLOUT');
    expect(rule.rollout).toBe(50);
  });

  it('R-10: failed validation leaves all fields in cmd unchanged (atomicity)', () => {
    const rule = makeRule({ priority: 1, outcome: true });
    const result = rule.refresh({ priority: 0, outcome: false });
    expect(result.ok).toBe(false);
    expect(rule.priority).toBe(1);
    expect(rule.outcome).toBe(true);
  });

  it('R-11: rollout = 0 is valid', () => {
    const rule = makeRule();
    const result = rule.refresh({ rollout: 0 });
    expect(result.ok).toBe(true);
    expect(rule.rollout).toBe(0);
  });

  it('R-12: rollout = 100 is valid', () => {
    const rule = makeRule();
    const result = rule.refresh({ rollout: 100 });
    expect(result.ok).toBe(true);
    expect(rule.rollout).toBe(100);
  });
});

// ---------------------------------------------------------------------------

describe('Rule.hydrate()', () => {
  const row = {
    id: 'hydrated-id',
    flagId: 'hydrated-flag',
    segmentId: 'hydrated-segment',
    priority: 2,
    outcome: true,
    rollout: 75,
  };

  it('H-01: maps all fields from row to getters', () => {
    const rule = Rule.hydrate(row);
    expect(rule.id).toBe(row.id);
    expect(rule.flagId).toBe(row.flagId);
    expect(rule.segmentId).toBe(row.segmentId);
    expect(rule.priority).toBe(row.priority);
    expect(rule.outcome).toBe(row.outcome);
    expect(rule.rollout).toBe(row.rollout);
  });

  it('H-02: preserves rollout = null from DB without converting to 100', () => {
    const rule = Rule.hydrate({ ...row, rollout: null });
    expect(rule.rollout).toBeNull();
  });

  it('H-03: preserves outcome = false from DB', () => {
    const rule = Rule.hydrate({ ...row, outcome: false });
    expect(rule.outcome).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('rule.primitives()', () => {
  it('P-01: returns correct current values', () => {
    const rule = makeRule();
    const p = rule.primitives();
    expect(p.flagId).toBe(base.flagId);
    expect(p.segmentId).toBe(base.segmentId);
    expect(p.priority).toBe(base.priority);
    expect(p.outcome).toBe(base.outcome);
    expect(p.rollout).toBe(base.rollout);
  });

  it('P-02: returned object is a clone — mutating it does not affect entity state', () => {
    const rule = makeRule();
    const p = rule.primitives();
    p.priority = 99;
    expect(rule.priority).toBe(base.priority);
  });

  it('P-03: reflects state after a successful refresh', () => {
    const rule = makeRule();
    rule.refresh({ priority: 5 });
    expect(rule.primitives().priority).toBe(5);
  });
});
