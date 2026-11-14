import { PaymentMethod } from '@prisma/client';

export interface CreateRideDto {
  passengerId: string;
  originAddress: string;
  originLatitude: number;
  originLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  estimatedFare?: number;
  routeQuoteToken: string;
  paymentMethod: PaymentMethod;
}

export function validateCreateRide(input: CreateRideDto): string | null {
  if (!input || typeof input !== 'object') return 'El cuerpo de la solicitud no es válido.';
  if (typeof input.passengerId !== 'string' || !input.passengerId.trim()) return 'passengerId es obligatorio.';
  if (typeof input.originAddress !== 'string' || !input.originAddress.trim()) return 'La dirección de origen es obligatoria.';
  if (typeof input.destinationAddress !== 'string' || !input.destinationAddress.trim()) return 'La dirección de destino es obligatoria.';
  const coordinates = [
    input.originLatitude, input.originLongitude,
    input.destinationLatitude, input.destinationLongitude,
  ];
  if (!coordinates.every((value) => typeof value === 'number' && Number.isFinite(value))) return 'Las coordenadas deben ser números válidos.';
  if (input.originLatitude < -90 || input.originLatitude > 90 || input.destinationLatitude < -90 || input.destinationLatitude > 90) return 'La latitud debe estar entre -90 y 90.';
  if (input.originLongitude < -180 || input.originLongitude > 180 || input.destinationLongitude < -180 || input.destinationLongitude > 180) return 'La longitud debe estar entre -180 y 180.';
  if (input.estimatedFare !== undefined && (!Number.isFinite(input.estimatedFare) || input.estimatedFare < 0)) return 'La tarifa estimada no puede ser negativa.';
  if (typeof input.routeQuoteToken !== 'string' || !input.routeQuoteToken.trim()) return 'Vuelve a calcular la ruta antes de solicitar el viaje.';
  if (!Object.values(PaymentMethod).includes(input.paymentMethod)) return 'El método de pago no es válido.';
  return null;
}
