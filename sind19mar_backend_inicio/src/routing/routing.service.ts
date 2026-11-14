import { BadGatewayException, BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { assertRideWithinMapCoverage } from '../maps/map-coverage';
import { calculateFareQuote, getFareTariffFromEnv } from '../rides/fare-estimator';

interface Coordinate { latitude: number; longitude: number; }
interface SignedFareQuote { origin: Coordinate; destination: Coordinate; fare: { currency: 'BOB'; distanceKm: number; amount: number; pricingVersion: 'env-v1' }; expiresAt: number; }
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
    const fare = tariff ? calculateFareQuote(distanceKm, tariff) : null;
    const quoteToken = fare ? this.signQuote({ origin, destination, fare, expiresAt: Date.now() + 5 * 60_000 }) : null;
    return {
      provider: process.env.ROUTING_PROVIDER || 'osrm',
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationMinutes: Math.max(1, Math.round(route.duration / 60)),
      geometry: route.geometry?.coordinates ? { type: 'LineString', coordinates: route.geometry.coordinates } : null,
      fare,
      quoteToken,
      fareUnavailableReason: tariff ? null : 'La tarifa oficial aún no está configurada.',
    };
  }

  verifyQuoteToken(token: string, origin: Coordinate, destination: Coordinate) {
    if (typeof token !== 'string' || !token.trim()) throw new ConflictException('La cotización venció o no es válida. Vuelve a calcular la ruta.');
    const parts = token.split('.');
    if (parts.length !== 2) throw new ConflictException('La cotización no es válida.');
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new ServiceUnavailableException('Falta configurar el secreto de firma del servidor.');
    const expected = createHmac('sha256', secret).update(parts[0]).digest();
    let received: Buffer;
    try { received = Buffer.from(parts[1], 'base64url'); } catch { throw new ConflictException('La cotización no es válida.'); }
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new ConflictException('La cotización no es válida.');
    let quote: SignedFareQuote;
    try { quote = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as SignedFareQuote; }
    catch { throw new ConflictException('La cotización no es válida.'); }
    const same = quote.origin?.latitude === origin.latitude && quote.origin?.longitude === origin.longitude &&
      quote.destination?.latitude === destination.latitude && quote.destination?.longitude === destination.longitude;
    if (!same || !Number.isFinite(quote.expiresAt) || quote.expiresAt < Date.now() ||
        quote.fare?.currency !== 'BOB' || !Number.isFinite(quote.fare.amount) || quote.fare.amount < 0) {
      throw new ConflictException('La cotización venció o no corresponde a estas ubicaciones. Vuelve a calcular la ruta.');
    }
    return quote.fare;
  }

  private signQuote(quote: SignedFareQuote) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new ServiceUnavailableException('Falta configurar el secreto de firma del servidor.');
    const payload = Buffer.from(JSON.stringify(quote)).toString('base64url');
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');
    return payload + '.' + signature;
  }
}
