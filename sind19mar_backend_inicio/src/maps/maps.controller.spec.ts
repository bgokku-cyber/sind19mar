import { MapsController } from './maps.controller';

describe('MapsController', () => {
  const names = [
    'MAP_CITY', 'MAP_COUNTRY', 'MAP_CENTER_LATITUDE', 'MAP_CENTER_LONGITUDE',
    'MAP_DEFAULT_ZOOM', 'MAP_COVERAGE_RADIUS_KM', 'MAP_PROVIDER', 'MAP_TILE_URL_TEMPLATE',
  ] as const;
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

  afterEach(() => {
    for (const name of names) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('provides a La Paz default configuration without requiring a map API key', () => {
    for (const name of names) delete process.env[name];

    expect(new MapsController().getConfig()).toEqual({
      city: 'La Paz',
      country: 'Bolivia',
      center: { latitude: -16.5, longitude: -68.15 },
      defaultZoom: 12,
      coverageRadiusKm: 25,
      provider: 'openstreetmap',
      tileUrlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      locationMode: 'gps_or_manual',
      attributionRequired: true,
    });
  });

  it('allows the deployment to configure another city and map provider', () => {
    process.env.MAP_CITY = 'Cochabamba';
    process.env.MAP_COUNTRY = 'Bolivia';
    process.env.MAP_CENTER_LATITUDE = '-17.39';
    process.env.MAP_CENTER_LONGITUDE = '-66.16';
    process.env.MAP_DEFAULT_ZOOM = '13';
    process.env.MAP_COVERAGE_RADIUS_KM = '18';
    process.env.MAP_PROVIDER = 'custom';
    process.env.MAP_TILE_URL_TEMPLATE = 'https://maps.example/{z}/{x}/{y}.png';

    expect(new MapsController().getConfig()).toMatchObject({
      city: 'Cochabamba',
      country: 'Bolivia',
      center: { latitude: -17.39, longitude: -66.16 },
      defaultZoom: 13,
      coverageRadiusKm: 18,
      provider: 'custom',
      tileUrlTemplate: 'https://maps.example/{z}/{x}/{y}.png',
    });
  });
});
