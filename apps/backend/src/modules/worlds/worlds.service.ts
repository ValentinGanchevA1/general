import { Injectable, NotFoundException } from '@nestjs/common';
import { WORLD_DEFINITIONS, WORLD_IDS, type WorldDefinition, type WorldId } from '@g88/shared';

/**
 * Registry is intentionally read-only. No database writes or permissions granted.
 * Preview worlds must not be interpreted as accessible domain features.
 */
@Injectable()
export class WorldsService {
  list(): readonly WorldDefinition[] {
    return WORLD_IDS.map((id) => WORLD_DEFINITIONS[id]);
  }

  get(id: string): WorldDefinition {
    if (!this.isWorldId(id)) throw new NotFoundException('World not found');
    return WORLD_DEFINITIONS[id];
  }

  private isWorldId(id: string): id is WorldId {
    return WORLD_IDS.some((worldId) => worldId === id);
  }
}
