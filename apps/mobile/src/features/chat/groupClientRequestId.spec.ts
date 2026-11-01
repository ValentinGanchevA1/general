import { createGroupClientRequestId } from './groupClientRequestId';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('createGroupClientRequestId', () => {
  it('returns a UUID accepted by the group create contract', () => {
    expect(createGroupClientRequestId()).toMatch(UUID_PATTERN);
  });

  it('returns a fresh id for a separate draft attempt', () => {
    const first = createGroupClientRequestId();
    const second = createGroupClientRequestId();

    expect(second).not.toBe(first);
  });
});
