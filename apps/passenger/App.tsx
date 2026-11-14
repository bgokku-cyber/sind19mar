import React, { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { cancelRide, getMapConfig, getMyRides, MapConfig, login, logout, PassengerRide, register, restoreSession, getRouteQuote, RouteQuote, createRide } from './src/api';

const C = {
  dark: '#073B2B',
  green: '#16A34A',
  bright: '#28C76F',
  pale: '#EAF7EF',
  white: '#FFFFFF',
  ink: '#14231B',
  muted: '#718078',
  line: '#DCE8E0',
  bg: '#F5F8F6',
  red: '#B42318',
};

type Mode = 'login' | 'register';

export default function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoordinates, setOriginCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationCoordinates, setDestinationCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [rides, setRides] = useState<PassengerRide[]>([]);
  const [routeQuote, setRouteQuote] = useState<RouteQuote | null>(null);
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  const [loadingRides, setLoadingRides] = useState(false);
  const [rideActionBusy, setRideActionBusy] = useState(false);

  useEffect(() => {
    getMapConfig().then(setMapConfig).catch(() => setMapConfig(null));
    restoreSession().then(async ok => { setAuthenticated(ok); if (ok) await refreshRides(); }).finally(() => setCheckingSession(false));
  }, []);

  // Mantiene el historial y el estado de los viajes al día mientras la sesión está abierta.
  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(() => {
      void getMyRides().then(setRides).catch(() => {
        // La consulta periódica no interrumpe la experiencia; el usuario puede reintentar manualmente.
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [authenticated]);

  async function refreshRides() { setLoadingRides(true); try { setRides(await getMyRides()); } catch (error) { Alert.alert('No se pudo cargar el historial', error instanceof Error ? error.message : 'Inténtalo nuevamente.'); } finally { setLoadingRides(false); } }

  async function useCurrentLocation() {
    setLocationBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Activa el permiso de ubicación para usar tu posición como punto de recogida.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setOriginCoordinates(coordinates);
      setRouteQuote(null);
      const places = await Location.reverseGeocodeAsync(coordinates);
      const place = places[0];
      const address = place ? [place.name, place.street, place.district, place.city].filter(Boolean).join(', ') : '';
      setOrigin(address || coordinates.latitude.toFixed(6) + ', ' + coordinates.longitude.toFixed(6));
    } catch (error) {
      Alert.alert('No pudimos obtener tu ubicación', error instanceof Error ? error.message : 'Comprueba que el GPS esté activado.');
    } finally { setLocationBusy(false); }
  }

  async function confirmRideRequest(target: { latitude: number; longitude: number }) {
    if (!originCoordinates) return;
    setRideActionBusy(true);
    try {
      await createRide({ originAddress: origin.trim(), originLatitude: originCoordinates.latitude, originLongitude: originCoordinates.longitude, destinationAddress: destination.trim(), destinationLatitude: target.latitude, destinationLongitude: target.longitude, paymentMethod: 'CASH' });
      setRouteQuote(null);
      await refreshRides();
      Alert.alert('Solicitud enviada', 'Tu solicitud fue registrada. Los conductores disponibles podrán aceptarla.');
    } catch (error) { Alert.alert('No se pudo solicitar el viaje', error instanceof Error ? error.message : 'Inténtalo nuevamente.'); }
    finally { setRideActionBusy(false); }
  }

  async function submitRide() {
    if (!originCoordinates) { Alert.alert('Falta el punto de recogida', 'Usa tu ubicación actual para registrar coordenadas reales del origen.'); return; }
    if (!destination.trim()) { Alert.alert('Falta el destino', 'Escribe la dirección de destino.'); return; }
    setRideActionBusy(true);
    try {
      let target = destinationCoordinates;
      if (!target) {
        const query = [destination.trim(), mapConfig?.city, mapConfig?.country].filter(Boolean).join(', ');
        const results = await Location.geocodeAsync(query);
        if (!results.length) throw new Error('No encontramos esa dirección. Revisa el texto e inténtalo nuevamente.');
        target = { latitude: results[0].latitude, longitude: results[0].longitude };
        setDestinationCoordinates(target);
      }
      if (!mapConfig) throw new Error('No se pudo cargar la configuración geográfica del servicio.');
      const quote = await getRouteQuote({ originLatitude: originCoordinates.latitude, originLongitude: originCoordinates.longitude, destinationLatitude: target.latitude, destinationLongitude: target.longitude });
      setRouteQuote(quote);
      if (!quote.fare) { Alert.alert('Ruta calculada', 'Distancia vial: ' + quote.distanceKm.toFixed(2) + ' km · Tiempo estimado: ' + quote.durationMinutes + ' min. ' + (quote.fareUnavailableReason || 'La tarifa oficial no está configurada.')); return; }
      Alert.alert('Confirmar solicitud', 'Distancia: ' + quote.distanceKm.toFixed(2) + ' km\nTiempo estimado: ' + quote.durationMinutes + ' min\nTarifa estimada: Bs ' + quote.fare.amount.toFixed(2).replace('.', ',') + '\n\n¿Deseas solicitar este viaje?', [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Solicitar viaje', onPress: () => { void confirmRideRequest(target!); } },
      ]);
    } catch (error) { Alert.alert('No se pudo cotizar el viaje', error instanceof Error ? error.message : 'Inténtalo nuevamente.'); }
    finally { setRideActionBusy(false); }
  }
  async function handleCancelRide(id: string) { setRideActionBusy(true); try { await cancelRide(id); await refreshRides(); } catch (error) { Alert.alert('No se pudo cancelar', error instanceof Error ? error.message : 'Inténtalo nuevamente.'); } finally { setRideActionBusy(false); } }

  async function submitAuth() {
    if (!phone.trim() || !password) {
      Alert.alert('Faltan datos', 'Ingresa tu número de teléfono y contraseña.');
      return;
    }
    if (mode === 'register' && name.trim().length < 3) {
      Alert.alert('Nombre incompleto', 'Escribe tu nombre completo.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(phone.trim(), password);
      else await register(name.trim(), phone.trim(), password);
      setAuthenticated(true);
      await refreshRides();
    } catch (error) {
      Alert.alert('No pudimos continuar', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logout();
    setAuthenticated(false);
    setRides([]);
    setPassword('');
  }

  if (checkingSession) {
    return <SafeAreaView style={[styles.safe, styles.center]}><StatusBar barStyle='light-content' backgroundColor={C.dark} /><ActivityIndicator color={C.bright} size='large' /><Text style={styles.loadingText}>Preparando tu experiencia...</Text></SafeAreaView>;
  }

  if (!authenticated) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.dark} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
            <View style={styles.brandPanel}>
              <View style={styles.logoMark}><Text style={styles.logoGlyph}>19</Text></View>
              <Text style={styles.brandTitle}>Sind.19-Mar</Text>
              <Text style={styles.brandSubtitle}>Tu viaje, más cerca.</Text>
              <View style={styles.brandLine} />
              <Text style={styles.brandSmall}>TRANSPORTE SEGURO Y CONFIABLE</Text>
            </View>
            <View style={styles.authCard}>
              <Text style={styles.heading}>{mode === 'login' ? 'Bienvenido' : 'Crear cuenta'}</Text>
              <Text style={styles.subheading}>{mode === 'login' ? 'Ingresa para solicitar tu viaje.' : 'Regístrate como pasajero en unos pasos.'}</Text>
              {mode === 'register' && (
                <Field label="Nombre completo" value={name} onChangeText={setName} placeholder="Tu nombre" />
              )}
              <Field label="Número de teléfono" value={phone} onChangeText={setPhone} placeholder="Ej. 70000000" keyboardType="phone-pad" />
              <Field label="Contraseña" value={password} onChangeText={setPassword} placeholder="Mínimo 10 caracteres" secureTextEntry />
              <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]} onPress={submitAuth} disabled={busy}>
                {busy ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryButtonText}>{mode === 'login' ? 'Iniciar sesión' : 'Crear mi cuenta'}</Text>}
              </Pressable>
              <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={styles.switchButton}>
                <Text style={styles.switchText}>{mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}<Text style={styles.switchStrong}>{mode === 'login' ? 'Regístrate' : 'Inicia sesión'}</Text></Text>
              </Pressable>
              <Text style={styles.legal}>Al continuar, aceptas las condiciones del servicio y el tratamiento de datos necesario para gestionar tus viajes.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const activeRide = rides.find(ride => ['ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS'].includes(ride.status));
  const sharedDriverLocation = activeRide?.driver?.location;
  const driverLocationIsFresh = !!sharedDriverLocation && Date.now() - new Date(sharedDriverLocation.recordedAt).getTime() < 90000;

  return (
    <SafeAreaView style={styles.safeHome}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />
      <View style={styles.homeHeader}>
        <View>
          <Text style={styles.headerEyebrow}>SIND.19-MAR</Text>
          <Text style={styles.headerTitle}>¿A dónde vamos?</Text>
        </View>
        <Pressable onPress={signOut} style={styles.avatar}><Text style={styles.avatarText}>↪</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.homeContent} keyboardShouldPersistTaps="handled">
        <View style={styles.mapCard}>
          <MapView
            style={StyleSheet.absoluteFill}
            key={originCoordinates ? 'pickup-map' : (mapConfig ? 'configured-map' : 'default-map')}
            initialRegion={{
              latitude: originCoordinates?.latitude ?? mapConfig?.center.latitude ?? -16.5,
              longitude: originCoordinates?.longitude ?? mapConfig?.center.longitude ?? -68.15,
              latitudeDelta: 0.045,
              longitudeDelta: 0.045,
            }}
            mapType={Platform.OS === 'android' ? 'none' : 'standard'}
            onPress={event => {
              const point = event.nativeEvent.coordinate;
              setDestinationCoordinates(point); setRouteQuote(null);
              void Location.reverseGeocodeAsync(point).then(places => {
                const place = places[0];
                const address = place ? [place.name, place.street, place.district, place.city].filter(Boolean).join(', ') : '';
                setDestination(address || point.latitude.toFixed(6) + ', ' + point.longitude.toFixed(6));
              }).catch(() => setDestination(point.latitude.toFixed(6) + ', ' + point.longitude.toFixed(6)));
            }}
          >
            <UrlTile urlTemplate={mapConfig?.tileUrlTemplate ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} maximumZ={19} shouldReplaceMapContent={Platform.OS === 'ios'} />
            {originCoordinates && <Marker coordinate={originCoordinates} title="Punto de recogida" pinColor="#16A34A" />}
            {destinationCoordinates && <Marker coordinate={destinationCoordinates} title="Destino" pinColor="#073B2B" />}
            {routeQuote?.geometry?.coordinates?.length ? <Polyline coordinates={routeQuote.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }))} strokeColor={C.green} strokeWidth={4} /> : null}
            {driverLocationIsFresh && sharedDriverLocation && <Marker coordinate={{ latitude: Number(sharedDriverLocation.latitude), longitude: Number(sharedDriverLocation.longitude) }} title="Tu conductor" pinColor="#F59E0B" />}
          </MapView>
          <View style={styles.mapCaption}>
            <Text style={styles.mapCaptionTitle}>{mapConfig ? `${mapConfig.city}, ${mapConfig.country}` : 'Zona de servicio'}</Text>
            <Text style={styles.mapCaptionText}>{driverLocationIsFresh ? 'Tu conductor aparece en el mapa' : 'Toca el mapa para elegir el destino'}</Text>
          </View>
          <Text style={styles.mapAttribution}>© OpenStreetMap contributors</Text>
        </View>
        <View style={styles.tripCard}>
          <Text style={styles.tripTitle}>Solicita tu viaje</Text>
          <Text style={styles.tripHint}>Indica dónde te recogemos y tu destino.</Text>
          <Field label="Punto de partida" value={origin} onChangeText={value => { setOrigin(value); setOriginCoordinates(null); setRouteQuote(null); }} placeholder="¿Dónde te recogemos?" />
          <Pressable style={styles.locationButton} onPress={useCurrentLocation} disabled={locationBusy}><Text style={styles.locationButtonText}>{locationBusy ? "Obteniendo ubicación…" : "◎ Usar mi ubicación actual"}</Text></Pressable>
          <Field label="Destino" value={destination} onChangeText={value => { setDestination(value); setDestinationCoordinates(null); setRouteQuote(null); }} placeholder="¿A dónde quieres ir?" />
          <View style={styles.paymentRow}>
            <View style={styles.cashIcon}><Text style={styles.cashGlyph}>Bs</Text></View>
            <View style={styles.paymentText}><Text style={styles.paymentTitle}>Pago en efectivo en bolivianos (Bs)</Text><Text style={styles.paymentHint}>La moneda de operación es el boliviano (BOB)</Text></View>
            <View style={styles.selectedDot}><Text style={styles.check}>✓</Text></View>
          </View>
          <Pressable style={[styles.primaryButton, (rideActionBusy || !originCoordinates || !destination.trim()) && styles.disabled]} disabled={rideActionBusy || !originCoordinates || !destination.trim()} onPress={submitRide}>{rideActionBusy ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryButtonText} >Cotizar y solicitar viaje</Text>}</Pressable>
          <Text style={styles.notice}>La ruta y la tarifa se calculan en el servidor. La solicitud sólo se envía si existe una tarifa oficial configurada y confirmas el precio.</Text>
        </View>
        <View style={styles.historyCard}>
          <View style={styles.historyHeader}><Text style={styles.historyTitle}>Mis viajes</Text><Pressable onPress={refreshRides} disabled={loadingRides || rideActionBusy}><Text style={styles.refreshText}>{loadingRides ? 'Cargando…' : 'Actualizar'}</Text></Pressable></View>
          {rides.length === 0 ? <Text style={styles.historyEmpty}>Todavía no tienes viajes registrados.</Text> : rides.map(ride => <View key={ride.id} style={styles.rideItem}>
            <View style={styles.rideTop}><Text style={styles.rideStatus}>{passengerRideStatus(ride.status)}</Text>{ride.estimatedFare !== null && <Text style={styles.rideFare}>Bs {Number(ride.estimatedFare).toFixed(2).replace('.', ',')}</Text>}</View>
            <Text style={styles.rideLabel}>ORIGEN</Text><Text style={styles.rideAddress}>{ride.originAddress}</Text>
            <Text style={styles.rideLabel}>DESTINO</Text><Text style={styles.rideAddress}>{ride.destinationAddress}</Text>
            <Text style={styles.rideMeta}>Pago: {ride.paymentMethod === 'CASH' ? 'Efectivo' : 'Digital'} · {new Date(ride.requestedAt).toLocaleString('es-BO')}</Text>
            {ride.status === 'REQUESTED' && <Pressable style={[styles.cancelButton, rideActionBusy && styles.disabled]} disabled={rideActionBusy} onPress={() => handleCancelRide(ride.id)}><Text style={styles.cancelText}>Cancelar solicitud</Text></Pressable>}
          </View>)}
        </View>
        <Text style={styles.footer}>Sind.19-Mar · La Paz</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function passengerRideStatus(status: PassengerRide['status']) { return ({ REQUESTED: 'Buscando conductor', ACCEPTED: 'Conductor asignado', DRIVER_ARRIVING: 'Conductor en camino', IN_PROGRESS: 'Viaje en curso', COMPLETED: 'Viaje completado', CANCELLED: 'Viaje cancelado' })[status]; }

type FieldProps = {
  label: string; value: string; onChangeText: (value: string) => void;
  placeholder: string; secureTextEntry?: boolean; keyboardType?: 'default' | 'phone-pad';
};

function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType = 'default' }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA79F"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: C.white, marginTop: 14, fontSize: 13 },
  safe: { flex: 1, backgroundColor: C.dark },
  safeHome: { flex: 1, backgroundColor: C.bg },
  authContent: { flexGrow: 1, backgroundColor: C.bg, paddingBottom: 28 },
  brandPanel: { backgroundColor: C.dark, paddingTop: 42, paddingBottom: 54, paddingHorizontal: 28, alignItems: 'center', borderBottomLeftRadius: 34, borderBottomRightRadius: 34 },
  logoMark: { width: 68, height: 68, borderRadius: 22, backgroundColor: C.bright, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#8DE5B0' },
  logoGlyph: { color: C.dark, fontSize: 25, fontWeight: '900', letterSpacing: -1 },
  brandTitle: { color: C.white, fontSize: 28, fontWeight: '800', marginTop: 14, letterSpacing: 0.2 },
  brandSubtitle: { color: '#CBE8D6', fontSize: 15, marginTop: 5 },
  brandLine: { height: 3, width: 42, borderRadius: 3, backgroundColor: C.bright, marginTop: 23, marginBottom: 12 },
  brandSmall: { color: '#A7D9BA', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  authCard: { backgroundColor: C.white, marginHorizontal: 18, marginTop: -25, borderRadius: 22, padding: 22, shadowColor: '#0B3D2C', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  heading: { color: C.ink, fontSize: 24, fontWeight: '800' },
  subheading: { color: C.muted, fontSize: 13, marginTop: 6, marginBottom: 18 },
  fieldWrap: { marginBottom: 15 },
  fieldLabel: { color: C.ink, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: '#FBFDFC', paddingHorizontal: 14, color: C.ink, fontSize: 14 },
  primaryButton: { height: 52, borderRadius: 13, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  primaryButtonText: { color: C.white, fontSize: 15, fontWeight: '800' },
  locationButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 11, borderRadius: 9, backgroundColor: C.pale, marginTop: -6, marginBottom: 12 },
  locationButtonText: { color: C.dark, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.48 },
  switchButton: { alignItems: 'center', paddingVertical: 17 },
  switchText: { color: C.muted, fontSize: 13 },
  switchStrong: { color: C.green, fontWeight: '800' },
  legal: { color: '#9AA79F', fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 1 },
  homeHeader: { backgroundColor: C.dark, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 25, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerEyebrow: { color: '#9EDDB8', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headerTitle: { color: C.white, fontSize: 24, fontWeight: '800', marginTop: 5 },
  avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#195C43', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.white, fontSize: 22, fontWeight: '700' },
  homeContent: { padding: 18, paddingBottom: 28 },
  mapCard: { height: 184, borderRadius: 19, overflow: 'hidden', backgroundColor: '#DCEBDD', marginBottom: 17, borderWidth: 1, borderColor: '#CDE1D1' },
  mapGrid: { flex: 1, overflow: 'hidden', backgroundColor: '#E7F0E5' },
  road: { position: 'absolute', left: -25, right: -25, height: 11, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D1DED1' },
  roadVertical: { position: 'absolute', top: -25, bottom: -25, width: 9, backgroundColor: '#FFFFFF', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#D1DED1' },
  mapPin: { position: 'absolute', left: '48%', top: '38%', width: 34, height: 34, borderRadius: 17, backgroundColor: C.green, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  mapPinText: { color: C.white, fontSize: 10 },
  mapCaption: { position: 'absolute', bottom: 10, left: 12, backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  mapCaptionTitle: { color: C.dark, fontSize: 11, fontWeight: '800' },
  mapCaptionText: { color: C.muted, fontSize: 9, marginTop: 2 },
  mapAttribution: { position: 'absolute', right: 7, bottom: 5, color: '#26352C', backgroundColor: 'rgba(255,255,255,0.85)', fontSize: 8, paddingHorizontal: 4, paddingVertical: 2 },
  tripCard: { backgroundColor: C.white, borderRadius: 19, padding: 18, borderWidth: 1, borderColor: '#E7EEE9' },
  tripTitle: { color: C.ink, fontSize: 19, fontWeight: '800' },
  tripHint: { color: C.muted, fontSize: 12, marginTop: 4, marginBottom: 17 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.pale, borderRadius: 12, padding: 11, marginBottom: 13 },
  cashIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#CFF0DB', alignItems: 'center', justifyContent: 'center' },
  cashGlyph: { color: C.dark, fontSize: 13, fontWeight: '900' },
  paymentText: { flex: 1, marginLeft: 10 },
  paymentTitle: { color: C.dark, fontSize: 12, fontWeight: '800' },
  paymentHint: { color: C.muted, fontSize: 9, marginTop: 3 },
  selectedDot: { width: 21, height: 21, borderRadius: 11, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  check: { color: C.white, fontSize: 12, fontWeight: '900' },
  notice: { color: C.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 10 },
  historyCard: { backgroundColor: C.white, borderRadius: 17, padding: 17, marginTop: 14, borderWidth: 1, borderColor: '#E7EEE9' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyTitle: { color: C.ink, fontSize: 17, fontWeight: '800' },
  refreshText: { color: C.green, fontSize: 12, fontWeight: '800' },
  historyEmpty: { color: C.muted, fontSize: 12, marginTop: 13 },
  rideItem: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 13, paddingTop: 13 },
  rideTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rideStatus: { color: C.dark, fontSize: 12, fontWeight: '900' },
  rideFare: { color: C.green, fontSize: 14, fontWeight: '900' },
  rideLabel: { color: C.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 10 },
  rideAddress: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 3 },
  rideMeta: { color: C.muted, fontSize: 10, marginTop: 9 },
  cancelButton: { borderWidth: 1, borderColor: C.red, borderRadius: 10, padding: 11, alignItems: 'center', marginTop: 11 },
  cancelText: { color: C.red, fontSize: 12, fontWeight: '800' },
  historyIcon: { color: C.green, fontSize: 21, marginRight: 12 },
  historyText: { flex: 1, color: C.ink, fontSize: 13, fontWeight: '700' },
  chevron: { color: C.muted, fontSize: 23 },
  footer: { color: '#9AA79F', fontSize: 10, textAlign: 'center', marginTop: 20 },
});
