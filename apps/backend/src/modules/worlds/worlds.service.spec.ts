import { NotFoundException } from '@nestjs/common';
import { WORLD_IDS } from '@g88/shared';
import { WorldsService } from './worlds.service';

describe('WorldsService', () => {
  const service = new WorldsService();

  it('returns exactly ten stable world definitions', () => {
    expect(service.list().map((world) => world.id)).toEqual([...WORLD_IDS]);
    expect(service.list()).toHaveLength(10);
  });

  it('keeps unfinished worlds in preview state', () => {
    expect(service.get('nexus').status).toBe('available');
    expect(service.get('sanctuary').status).toBe('preview');
  });

  it('rejects invalid world identifiers without reflection or fallback', () => {
    expect(() => service.get('__proto__')).toThrow(NotFoundException);
    expect(() => service.get('invalid')).toThrow(NotFoundException);
  });
});
