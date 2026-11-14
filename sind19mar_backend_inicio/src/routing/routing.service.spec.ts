import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { RoutingService } from './routing.service';

describe('RoutingService', () => {
  const originalFetch = global.fetch;
  const originalBase = process.env.ROUTING_BASE_URL;
  const originalCoverage = {
    lat: process.env.MAP_CENTER_LATITUDE,
    lon: process.env.MAP_CENTER_LONGITUDE,
    radius: process.env.MAP_COVERAGE_RADIUS_KM,
  };
  const service = new RoutingService();

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.ROUTING_BASE_URL;
    else process.env.ROUTING_BASE_URL = originalBase;
    for (const [key, value] of Object.entries({
      MAP_CENTER_LATITUDE: originalCoverage.lat,
      MAP_CENTER_LONGITUDE: originalCoverage.lon,
      MAP_COVERAGE_RADIUS_KM: originalCoverage.radius,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete process.env.FARE_BASE_BOB;
    delete process.env.FARE_PER_KM_BOB;
    delete process.env.FARE_MINIMUM_BOB;
  });

  it('requests a road route and returns distance and duration', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ distance: 4200, duration: 900, geometry: { coordinates: [[-68.15, -16.5], [-68.14, -16.51]] } }] }),
    });
    global.fetch = fetchMock as any;
    const result = await service.quote(
      { latitude: -16.5, longitude: -68.15 },
      { latitude: -16.51, longitude: -68.14 },
    );
    expect(result.distanceKm).toBe(4.2);
    expect(result.durationMinutes).toBe(15);
    expect(result.fare).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toContain('-68.15,-16.5;-68.14,-16.51');
  });

  it('calculates fare only when all official tariff variables are configured', async () => {
    process.env.FARE_BASE_BOB = '5';
    process.env.FARE_PER_KM_BOB = '2';
    process.env.FARE_MINIMUM_BOB = '8';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ distance: 3000, duration: 600 }] }),
    }) as any;
    const result = await service.quote(
      { latitude: -16.5, longitude: -68.15 },
      { latitude: -16.51, longitude: -68.14 },
    );
    expect(result.fare).toEqual({ currency: 'BOB', distanceKm: 3, amount: 11, pricingVersion: 'env-v1' });
  });

  it('rejects invalid coordinates before calling the provider', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    await expect(service.quote(
      { latitude: 999, longitude: 0 },
      { latitude: -16.51, longitude: -68.14 },
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects locations outside the configured coverage area', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    await expect(service.quote(
      { latitude: 0, longitude: 0 },
      { latitude: 0.01, longitude: 0.01 },
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports provider outages without fabricating a route', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as any;
    await expect(service.quote(
      { latitude: -16.5, longitude: -68.15 },
      { latitude: -16.51, longitude: -68.14 },
    )).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects a provider response without a valid route', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 'NoRoute', routes: [] }) }) as any;
    await expect(service.quote(
      { latitude: -16.5, longitude: -68.15 },
      { latitude: -16.51, longitude: -68.14 },
    )).rejects.toBeInstanceOf(BadRequestException);
  });
});
