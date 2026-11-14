import { BadRequestException } from '@nestjs/common';

const DEFAULT_CENTER = { latitude: -16.5, longitude: -68.15 };
const DEFAULT_RADIUS_KM = 25;

function readCoordinate(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function readRadius() {
  return readCoordinate('MAP_COVERAGE_RADIUS_KM', DEFAULT_RADIUS_KM, 1, 200);
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Rechaza solicitudes cuyo origen o destino queden fuera del radio operativo configurado. */
export function assertRideWithinMapCoverage(
  originLatitude: number,
  originLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
) {
  const centerLatitude = readCoordinate('MAP_CENTER_LATITUDE', DEFAULT_CENTER.latitude, -90, 90);
  const centerLongitude = readCoordinate('MAP_CENTER_LONGITUDE', DEFAULT_CENTER.longitude, -180, 180);
  const radius = readRadius();
  const originDistance = distanceKm(centerLatitude, centerLongitude, originLatitude, originLongitude);
  const destinationDistance = distanceKm(centerLatitude, centerLongitude, destinationLatitude, destinationLongitude);

  if (originDistance > radius || destinationDistance > radius) {
    throw new BadRequestException('El origen y el destino deben estar dentro de la zona de cobertura de Sind.19-Mar.');
  }
}
