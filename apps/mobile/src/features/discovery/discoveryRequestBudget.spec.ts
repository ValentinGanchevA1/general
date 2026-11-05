import {
  DISCOVERY_REQUEST_BUDGET_LIMIT,
  DISCOVERY_REQUEST_BUDGET_WINDOW_MS,
  DiscoveryRequestBudget,
} from './discoveryRequestBudget';

describe('DiscoveryRequestBudget', () => {
  it('permits responsive map gestures before the hourly-minute budget is reached', () => {
    const budget = new DiscoveryRequestBudget();
    for (let i = 0; i < DISCOVERY_REQUEST_BUDGET_LIMIT; i += 1) {
      expect(budget.tryAcquire(i * 250)).toBe(0);
    }
    const delay = budget.tryAcquire(DISCOVERY_REQUEST_BUDGET_LIMIT * 250);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(DISCOVERY_REQUEST_BUDGET_WINDOW_MS);
  });

  it('resumes once the oldest attempt expires and preserves the sliding window', () => {
    const budget = new DiscoveryRequestBudget();
    for (let i = 0; i < DISCOVERY_REQUEST_BUDGET_LIMIT; i += 1) {
      expect(budget.tryAcquire(i)).toBe(0);
    }
    expect(budget.tryAcquire(500)).toBe(DISCOVERY_REQUEST_BUDGET_WINDOW_MS - 500 + 1);
    expect(budget.tryAcquire(DISCOVERY_REQUEST_BUDGET_WINDOW_MS)).toBe(0);
    expect(budget.tryAcquire(DISCOVERY_REQUEST_BUDGET_WINDOW_MS + 1)).toBe(0);
    expect(budget.tryAcquire(DISCOVERY_REQUEST_BUDGET_WINDOW_MS + 10)).toBeGreaterThan(0);
  });

  it('does not consume additional budget while a request is waiting', () => {
    const budget = new DiscoveryRequestBudget();
    for (let i = 0; i < DISCOVERY_REQUEST_BUDGET_LIMIT; i += 1) {
      expect(budget.tryAcquire(0)).toBe(0);
    }
    const firstDelay = budget.tryAcquire(1000);
    expect(budget.tryAcquire(1000)).toBe(firstDelay);
    expect(budget.tryAcquire(2000)).toBe(firstDelay - 1000);
  });

  it('keeps independent budgets for nearby entities and public Places', () => {
    const entities = new DiscoveryRequestBudget();
    const places = new DiscoveryRequestBudget();
    for (let i = 0; i < DISCOVERY_REQUEST_BUDGET_LIMIT; i += 1) {
      expect(entities.tryAcquire(0)).toBe(0);
    }
    expect(entities.tryAcquire(250)).toBeGreaterThan(0);
    expect(places.tryAcquire(250)).toBe(0);
  });
});
