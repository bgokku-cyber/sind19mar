import { BadGatewayException, BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { assertRideWithinMapCoverage } from '../maps/map-coverage';
import { calculateFareQuote, getFareTariffFromEnv } from '../rides/fare-estimator';

interface Coordinate { latitude: number; longitude: number; }
interface OsrmRouteResponse {
  code?: string;
  routes?: Array<{ distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }>;
}

@Injectable()
export class RoutingService {
  async quote(origin: Coordinate, destination: Coordinate) {
    const coordinates = [origin.latitude, origin.longitude, destination.latitude, destination.longitude];
    if (!coordinates.every(Number.isFinite) ||
        origin.latitude < -90 || origin.latitude > 90 || destination.latitude < -90 || destination.latitude > 90 ||
        origin.longitude < -180 || origin.longitude > 180 || destination.longitude < -180 || destination.longitude > 180) {
      throw new BadRequestException('Las coordenadas de origen y destino no son válidas.');
    }

    assertRideWithinMapCoverage(origin.latitude, origin.longitude, destination.latitude, destination.longitude);

    const baseUrl = (process.env.ROUTING_BASE_URL || 'https://router.project-osrm.org').replace(/\/+$/, '');
    let response: Response;
    try {
      response = await fetch(
        `${baseUrl}/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=simplified&geometries=geojson&steps=false`,
        { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } },
      );
    } catch {
      throw new ServiceUnavailableException('El proveedor de rutas no está disponible temporalmente.');
    }
    if (!response.ok) throw new ServiceUnavailableException('El proveedor de rutas no pudo calcular el recorrido.');

    let payload: OsrmRouteResponse;
    try { payload = await response.json() as OsrmRouteResponse; }
    catch { throw new BadGatewayException('El proveedor de rutas devolvió una respuesta no válida.'); }

    const route = payload.routes?.[0];
    if (payload.code !== 'Ok' || !route || !Number.isFinite(route.distance) || route.distance <= 0 ||
        !Number.isFinite(route.duration) || route.duration < 0) {
      throw new BadRequestException('No se encontró una ruta vial entre esos puntos.');
    }

    const distanceKm = route.distance / 1000;
    const tariff = getFareTariffFromEnv();
    return {
      provider: process.env.ROUTING_PROVIDER || 'osrm',
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationMinutes: Math.max(1, Math.round(route.duration / 60)),
      geometry: route.geometry?.coordinates ? { type: 'LineString', coordinates: route.geometry.coordinates } : null,
      fare: tariff ? calculateFareQuote(distanceKm, tariff) : null,
      fareUnavailableReason: tariff ? null : 'La tarifa oficial aún no está configurada.',
    };
  }
}
