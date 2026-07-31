import { Controller, Get } from '@nestjs/common';
import * as packageJson from '../../package.json';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      name: packageJson.name,
      version: packageJson.version,
      uptime: process.uptime(),
    };
  }
}
