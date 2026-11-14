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

function numberFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function textFromEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function tileTemplateFromEnv(): string {
  const value = process.env.MAP_TILE_URL_TEMPLATE?.trim();
  // Sólo se publican plantillas HTTPS con placeholders estándar de teselas.
  if (!value || !value.startsWith('https://') ||
      !value.includes('{z}') || !value.includes('{x}') || !value.includes('{y}')) {
    return DEFAULTS.tileUrlTemplate;
  }
  return value;
}

@Controller('maps')
export class MapsController {
  // Configuración pública compartida por pasajero, conductor y panel administrativo.
  @Get('config')
  getConfig() {
    return {
      city: textFromEnv('MAP_CITY', DEFAULTS.city),
      country: textFromEnv('MAP_COUNTRY', DEFAULTS.country),
      center: {
        latitude: numberFromEnv('MAP_CENTER_LATITUDE', DEFAULTS.latitude, -90, 90),
        longitude: numberFromEnv('MAP_CENTER_LONGITUDE', DEFAULTS.longitude, -180, 180),
      },
      defaultZoom: numberFromEnv('MAP_DEFAULT_ZOOM', DEFAULTS.zoom, 1, 20),
      coverageRadiusKm: numberFromEnv('MAP_COVERAGE_RADIUS_KM', DEFAULTS.coverageRadiusKm, 1, 200),
      provider: textFromEnv('MAP_PROVIDER', DEFAULTS.provider),
      tileUrlTemplate: tileTemplateFromEnv(),
      locationMode: 'gps_or_manual',
      attributionRequired: true,
    };
  }
}
