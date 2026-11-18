import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { WorldDefinition } from '@g88/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorldsService } from './worlds.service';

/** Authenticated metadata only. Not a grant of access to private world data. */
@Controller('worlds')
@UseGuards(JwtAuthGuard)
export class WorldsController {
  constructor(private readonly worlds: WorldsService) {}

  @Get()
  list(): readonly WorldDefinition[] {
    return this.worlds.list();
  }

  @Get(':id/config')
  config(@Param('id') id: string): WorldDefinition {
    return this.worlds.get(id);
  }
}
