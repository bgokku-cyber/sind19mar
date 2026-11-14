import { BadRequestException } from '@nestjs/common';
import { assertRideWithinMapCoverage } from './map-coverage';

describe('assertRideWithinMapCoverage', () => {
  const names = ['MAP_CENTER_LATITUDE', 'MAP_CENTER_LONGITUDE', 'MAP_COVERAGE_RADIUS_KM'] as const;
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    process.env.MAP_CENTER_LATITUDE = '-16.5';
    process.env.MAP_CENTER_LONGITUDE = '-68.15';
    process.env.MAP_COVERAGE_RADIUS_KM = '25';
  });

  afterEach(() => {
    for (const name of names) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('accepts origin and destination within the configured radius', () => {
    expect(() => assertRideWithinMapCoverage(-16.51, -68.16, -16.52, -68.17)).not.toThrow();
  });

  it('rejects an origin outside the configured radius', () => {
    expect(() => assertRideWithinMapCoverage(-16.5, -68.15, -16.8, -68.15))
      .toThrow(BadRequestException);
  });

  it('rejects a destination outside the configured radius', () => {
    expect(() => assertRideWithinMapCoverage(-16.51, -68.16, -17.2, -68.15))
      .toThrow(BadRequestException);
  });

  it('uses the configured center and radius for another city', () => {
    process.env.MAP_CENTER_LATITUDE = '-17.39';
    process.env.MAP_CENTER_LONGITUDE = '-66.16';
    process.env.MAP_COVERAGE_RADIUS_KM = '10';
    expect(() => assertRideWithinMapCoverage(-17.391, -66.161, -17.392, -66.162)).not.toThrow();
    expect(() => assertRideWithinMapCoverage(-16.5, -68.15, -17.392, -66.162)).toThrow(BadRequestException);
  });
});
