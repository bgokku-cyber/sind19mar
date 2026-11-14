import { Controller, Get } from '@nestjs/common';

const DEFAULTS = {
  city: 'La Paz',
  country: 'Bolivia',
  latitude: -16.5,
  longitude: -68.15,
  zoom: 12,
  coverageRadiusKm: 25,
  provider: 'openstreetmap',
  tileUrlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && process.env[name]?.trim() !== '' ? value : fallback;
}

@Controller('maps')
export class MapsController {
  // Configuración pública para que pasajero, conductor y panel usen la misma región y proveedor.
  @Get('config')
  getConfig() {
    return {
      city: process.env.MAP_CITY?.trim() || DEFAULTS.city,
      country: process.env.MAP_COUNTRY?.trim() || DEFAULTS.country,
      center: {
        latitude: numberFromEnv('MAP_CENTER_LATITUDE', DEFAULTS.latitude),
        longitude: numberFromEnv('MAP_CENTER_LONGITUDE', DEFAULTS.longitude),
      },
      defaultZoom: numberFromEnv('MAP_DEFAULT_ZOOM', DEFAULTS.zoom),
      coverageRadiusKm: numberFromEnv('MAP_COVERAGE_RADIUS_KM', DEFAULTS.coverageRadiusKm),
      provider: process.env.MAP_PROVIDER?.trim() || DEFAULTS.provider,
      tileUrlTemplate: process.env.MAP_TILE_URL_TEMPLATE?.trim() || DEFAULTS.tileUrlTemplate,
      locationMode: 'gps_or_manual',
      attributionRequired: true,
    };
  }
}
