import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('returns the expected API health payload', () => {
    expect(controller.check()).toEqual({
      status: 'ok',
      service: 'sind19mar-api',
      version: '0.1.0',
    });
  });
});
