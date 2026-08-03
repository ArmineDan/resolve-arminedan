import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import * as packageJson from '../../package.json';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('returns service name, version and uptime', () => {
    const result = controller.health();
    expect(result.name).toBe(packageJson.name);
    expect(result.version).toBe(packageJson.version);
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('ping returns ok status', () => {
    expect(controller.ping()).toEqual({ status: 'ok' });
  });
});
