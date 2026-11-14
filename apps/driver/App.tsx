import React, { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { acceptRide, addVehicle, advanceRide, cancelRide, DriverProfile, DriverRide, getMapConfig, MapConfig, getProfile, getRides, login, logout, register, restoreSession, setAvailability } from './src/api';

const C = { dark: '#073B2B', green: '#16A34A', bright: '#28C76F', pale: '#EAF7EF', white: '#FFFFFF', ink: '#14231B', muted: '#718078', line: '#DCE8E0', bg: '#F5F8F6', amber: '#9A6700' };
type Mode = 'login' | 'register';

export default function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [rides, setRides] = useState<DriverRide[]>([]);
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  const [driverCoordinates, setDriverCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [loadingRides, setLoadingRides] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [license, setLicense] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));

  async function refresh() { setProfile(await getProfile()); }
  async function refreshRides() { setLoadingRides(true); try { setRides(await getRides()); } catch (e) { Alert.alert('No se pudieron cargar los viajes', e instanceof Error ? e.message : 'Inténtalo nuevamente.'); } finally { setLoadingRides(false); } }
  async function handleRideAction(action: () => Promise<unknown>) { setBusy(true); try { await action(); await Promise.all([refresh(), refreshRides()]); } catch (e) { Alert.alert('No se pudo actualizar el viaje', e instanceof Error ? e.message : 'Inténtalo nuevamente.'); } finally { setBusy(false); } }
  useEffect(() => { getMapConfig().then(setMapConfig).catch(() => setMapConfig(null)); restoreSession().then(async ok => { if (ok) { setSignedIn(true); try { await Promise.all([refresh(), refreshRides()]); } catch { setSignedIn(false); } } }).finally(() => setChecking(false)); }, []);

  // Consulta periódicamente el perfil y los viajes para reflejar asignaciones y cambios de estado.
  useEffect(() => {
    if (!signedIn) return;
    const interval = setInterval(() => {
      void Promise.all([getProfile(), getRides()])
        .then(([nextProfile, nextRides]) => { setProfile(nextProfile); setRides(nextRides); })
        .catch(() => {
          // Los fallos transitorios de red no generan alertas repetidas.
        });
    }, 15000);
    return () => clearInterval(interval);
  }, [signedIn]);

  async function refreshDriverLocation() {
    setLocationBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Activa el permiso de ubicación para mostrar tu posición en el mapa.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setDriverCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (error) {
      Alert.alert('No pudimos obtener tu ubicación', error instanceof Error ? error.message : 'Comprueba que el GPS esté activado.');
    } finally { setLocationBusy(false); }
  }

  async function submitAuth() {
    if (!phone.trim() || !password) return Alert.alert('Faltan datos', 'Ingresa tu teléfono y contraseña.');
    if (mode === 'register' && (fullName.trim().length < 3 || license.trim().length < 4)) return Alert.alert('Datos incompletos', 'Ingresa tu nombre completo y número de licencia.');
    setBusy(true);
    try {
      if (mode === 'login') await login(phone.trim(), password);
      else await register(fullName.trim(), phone.trim(), password, license.trim());
      setSignedIn(true); await Promise.all([refresh(), refreshRides()]);
    } catch (e) { Alert.alert('No pudimos continuar', e instanceof Error ? e.message : 'Inténtalo nuevamente.'); }
    finally { setBusy(false); }
  }

  async function changeAvailability() {
    if (!profile || profile.availability === 'ON_TRIP') return;
    setBusy(true);
    try { await setAvailability(profile.availability === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE'); await refresh(); }
    catch (e) { Alert.alert('No se pudo cambiar', e instanceof Error ? e.message : 'Verifica tu aprobación y vehículo.'); }
    finally { setBusy(false); }
  }

  async function saveVehicle() {
    const parsedYear = Number(year);
    if (!make.trim() || !model.trim() || !color.trim() || !plate.trim() || !Number.isInteger(parsedYear)) return Alert.alert('Datos incompletos', 'Completa todos los campos del vehículo.');
    setBusy(true);
    try { await addVehicle({ make: make.trim(), model: model.trim(), color: color.trim(), plateNumber: plate.trim(), year: parsedYear }); await refresh(); setMake(''); setModel(''); setColor(''); setPlate(''); Alert.alert('Vehículo enviado', 'Quedó registrado y pendiente de aprobación administrativa.'); }
    catch (e) { Alert.alert('No se pudo registrar', e instanceof Error ? e.message : 'Inténtalo nuevamente.'); }
    finally { setBusy(false); }
  }

  function confirmCancelRide(rideId: string) {
    Alert.alert('Cancelar viaje', '¿Confirmas que deseas cancelar este viaje? Tu disponibilidad volverá a estar activa.', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: () => { void handleRideAction(() => cancelRide(rideId)); } },
    ]);
  }

  async function signOut() { await logout(); setProfile(null); setSignedIn(false); setPassword(''); }

  if (checking) return <SafeAreaView style={[s.safe, s.center]}><StatusBar barStyle="light-content" backgroundColor={C.dark}/><ActivityIndicator color={C.bright}/><Text style={s.loading}>Preparando la aplicación...</Text></SafeAreaView>;

  if (!signedIn) return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.dark}/><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.authContent} keyboardShouldPersistTaps="handled"><View style={s.brand}><View style={s.logo}><Text style={s.logoText}>19</Text></View><Text style={s.brandTitle}>Sind.19-Mar</Text><Text style={s.brandSub}>Conductor</Text><Text style={s.brandTag}>CONECTAMOS CAMINOS</Text></View><View style={s.card}><Text style={s.title}>{mode === 'login' ? 'Bienvenido, conductor' : 'Registro de conductor'}</Text><Text style={s.muted}>{mode === 'login' ? 'Ingresa para gestionar tu disponibilidad.' : 'Tu cuenta y vehículo serán revisados antes de operar.'}</Text>{mode === 'register' && <Field label="Nombre completo" value={fullName} onChangeText={setFullName} placeholder="Tu nombre"/>}<Field label="Teléfono" value={phone} onChangeText={setPhone} placeholder="Ej. 70000000"/><Field label="Contraseña" value={password} onChangeText={setPassword} placeholder="Mínimo 10 caracteres" secureTextEntry/>{mode === 'register' && <Field label="Número de licencia" value={license} onChangeText={setLicense} placeholder="Número de licencia"/>}<Pressable style={[s.primary, busy && s.disabled]} onPress={submitAuth} disabled={busy}>{busy ? <ActivityIndicator color={C.white}/> : <Text style={s.primaryText}>{mode === 'login' ? 'Iniciar sesión' : 'Enviar registro'}</Text>}</Pressable><Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={s.switch}><Text style={s.switchText}>{mode === 'login' ? '¿Nuevo conductor? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}</Text></Pressable></View></ScrollView></KeyboardAvoidingView></SafeAreaView>;

  const available = profile?.availability === 'AVAILABLE';
  const approved = !!profile?.verifiedAt;
  return <SafeAreaView style={s.safeHome}><StatusBar barStyle="light-content" backgroundColor={C.dark}/><View style={s.header}><View><Text style={s.eyebrow}>SIND.19-MAR · CONDUCTOR</Text><Text style={s.headerTitle}>Hola, {profile?.user.fullName?.split(' ')[0] || 'conductor'}</Text><Text style={s.muted}>{mapConfig ? `${mapConfig.city}, ${mapConfig.country} · cobertura ${mapConfig.coverageRadiusKm} km` : 'Cargando zona de servicio…'}</Text></View><Pressable onPress={signOut} style={s.exit}><Text style={s.exitText}>↪</Text></Pressable></View><ScrollView contentContainerStyle={s.content}><View style={s.mapCard}>
  <View style={s.mapHeader}><Text style={s.sectionTitle}>Mapa de operación</Text><Pressable onPress={refreshDriverLocation} disabled={locationBusy}><Text style={s.refreshText}>{locationBusy ? 'Localizando…' : 'Mi ubicación'}</Text></Pressable></View>
  <View style={s.mapFrame}>
    <MapView style={StyleSheet.absoluteFill} key={driverCoordinates ? 'driver-location' : (mapConfig ? 'configured-map' : 'default-map')} initialRegion={{ latitude: driverCoordinates?.latitude ?? mapConfig?.center.latitude ?? -16.5, longitude: driverCoordinates?.longitude ?? mapConfig?.center.longitude ?? -68.15, latitudeDelta: 0.045, longitudeDelta: 0.045 }} mapType={Platform.OS === 'android' ? 'none' : 'standard'}>
      <UrlTile urlTemplate={mapConfig?.tileUrlTemplate ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} maximumZ={19} shouldReplaceMapContent={Platform.OS === 'ios'}/>
      {driverCoordinates && <Marker coordinate={driverCoordinates} title="Tu ubicación" pinColor="#16A34A"/>}
    </MapView>
    <Text style={s.mapAttribution}>© OpenStreetMap contributors</Text>
  </View>
  <Text style={s.muted}>Tu posición se muestra únicamente en este dispositivo; el envío de ubicación en tiempo real al servidor aún no está habilitado.</Text>
</View><View style={s.statusCard}><Text style={s.sectionTitle}>Tu estado</Text><View style={s.statusLine}><View style={[s.statusDot, { backgroundColor: available ? C.bright : C.muted }]}/><Text style={s.statusText}>{profile?.availability === 'ON_TRIP' ? 'En un viaje' : available ? 'Disponible para viajes' : 'Desconectado'}</Text></View><Text style={s.muted}>{approved ? 'Cuenta verificada' : 'Cuenta pendiente de aprobación'}</Text><Pressable style={[s.primary, (!approved || profile?.availability === 'ON_TRIP' || busy) && s.disabled]} onPress={changeAvailability} disabled={!approved || profile?.availability === 'ON_TRIP' || busy}><Text style={s.primaryText}>{available ? 'Desconectarme' : 'Conectarme'}</Text></Pressable>{!approved && <Text style={s.notice}>La administración debe verificar tu cuenta y aprobar al menos un vehículo para habilitarte.</Text>}</View><View style={s.card}><Text style={s.sectionTitle}>Mis vehículos</Text>{profile?.vehicles.length ? profile.vehicles.map(v => <View key={v.id} style={s.vehicle}><Text style={s.vehicleName}>{v.make} {v.model} · {v.year}</Text><Text style={s.muted}>{v.color} · {v.plateNumber}</Text><Text style={s.vehicleState}>{v.isActive ? 'Aprobado' : 'Pendiente de aprobación'}</Text></View>) : <Text style={s.muted}>Todavía no registraste un vehículo.</Text>}<Text style={s.formTitle}>Registrar vehículo</Text><Field label="Marca" value={make} onChangeText={setMake} placeholder="Toyota"/><Field label="Modelo" value={model} onChangeText={setModel} placeholder="Corolla"/><Field label="Color" value={color} onChangeText={setColor} placeholder="Blanco"/><Field label="Placa" value={plate} onChangeText={setPlate} placeholder="ABC123"/><Field label="Año" value={year} onChangeText={setYear} placeholder="2022"/><Pressable style={[s.secondary, busy && s.disabled]} onPress={saveVehicle} disabled={busy}><Text style={s.secondaryText}>Enviar vehículo para revisión</Text></Pressable></View><View style={s.card}><View style={s.ridesHeader}><Text style={s.sectionTitle}>Viajes</Text><Pressable onPress={refreshRides} disabled={loadingRides || busy}><Text style={s.refreshText}>{loadingRides ? 'Actualizando…' : 'Actualizar'}</Text></Pressable></View><Text style={s.muted}>Las solicitudes nuevas aparecerán aquí cuando estés conectado. Actualiza para consultar las solicitudes disponibles.</Text>{rides.length === 0 ? <Text style={s.emptyRides}>No tienes viajes asignados ni solicitudes visibles.</Text> : rides.map(ride => { const active = ['ACCEPTED','DRIVER_ARRIVING','IN_PROGRESS'].includes(ride.status); const next = ride.status === 'ACCEPTED' ? 'DRIVER_ARRIVING' : ride.status === 'DRIVER_ARRIVING' ? 'IN_PROGRESS' : ride.status === 'IN_PROGRESS' ? 'COMPLETED' : null; const nextLabel = ride.status === 'ACCEPTED' ? 'Confirmar llegada al origen' : ride.status === 'DRIVER_ARRIVING' ? 'Iniciar viaje' : 'Finalizar viaje'; return <View key={ride.id} style={s.ride}><View style={s.rideTop}><Text style={s.rideStatus}>{rideStatusLabel(ride.status)}</Text>{ride.estimatedFare !== null && <Text style={s.rideFare}>Bs {Number(ride.estimatedFare).toFixed(2).replace('.', ',')}</Text>}</View><Text style={s.rideLabel}>ORIGEN</Text><Text style={s.rideAddress}>{ride.originAddress}</Text><Text style={s.rideLabel}>DESTINO</Text><Text style={s.rideAddress}>{ride.destinationAddress}</Text><Text style={s.muted}>Pago: {ride.paymentMethod === 'CASH' ? 'Efectivo' : 'Digital'}</Text>{ride.status === 'REQUESTED' && profile?.availability === 'AVAILABLE' && <Pressable style={[s.primary, busy && s.disabled]} disabled={busy} onPress={() => handleRideAction(() => acceptRide(ride.id))}><Text style={s.primaryText}>Aceptar viaje</Text></Pressable>}{active && next && <Pressable style={[s.primary, busy && s.disabled]} disabled={busy} onPress={() => handleRideAction(() => advanceRide(ride.id, next))}><Text style={s.primaryText}>{nextLabel}</Text></Pressable>}{['ACCEPTED','DRIVER_ARRIVING'].includes(ride.status) && <Pressable style={[s.secondary, busy && s.disabled]} disabled={busy} onPress={() => confirmCancelRide(ride.id)}><Text style={s.secondaryText}>Cancelar viaje</Text></Pressable>}</View>; })}</View><View style={s.info}><Text style={s.infoTitle}>Operación segura</Text><Text style={s.muted}>Solo podrás conectarte cuando tu cuenta y un vehículo estén aprobados. Actualiza la sección Viajes para consultar solicitudes y gestionar tus servicios.</Text></View><Text style={s.footer}>Sind.19-Mar · La Paz, Bolivia</Text></ScrollView></SafeAreaView>;
}

function rideStatusLabel(status: DriverRide['status']) { return ({ REQUESTED: 'Solicitud disponible', ACCEPTED: 'Viaje aceptado', DRIVER_ARRIVING: 'En camino al origen', IN_PROGRESS: 'Viaje en curso', COMPLETED: 'Viaje completado', CANCELLED: 'Viaje cancelado' })[status]; }

function Field({ label, value, onChangeText, placeholder, secureTextEntry }: { label: string; value: string; onChangeText: (v: string) => void; placeholder: string; secureTextEntry?: boolean }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9AA79F" secureTextEntry={secureTextEntry} autoCapitalize="none" style={s.input}/></View>;
}

const s = StyleSheet.create({
  flex:{flex:1}, safe:{flex:1,backgroundColor:C.dark}, safeHome:{flex:1,backgroundColor:C.bg}, center:{alignItems:'center',justifyContent:'center'}, loading:{color:C.white,marginTop:12}, authContent:{flexGrow:1,backgroundColor:C.bg,paddingBottom:25}, brand:{alignItems:'center',backgroundColor:C.dark,paddingTop:40,paddingBottom:54,borderBottomLeftRadius:30,borderBottomRightRadius:30}, logo:{width:64,height:64,borderRadius:20,backgroundColor:C.bright,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'#8DE5B0'}, logoText:{fontSize:24,fontWeight:'900',color:C.dark}, brandTitle:{fontSize:27,fontWeight:'900',color:C.white,marginTop:13}, brandSub:{color:'#CBE8D6',marginTop:4}, brandTag:{color:'#A7D9BA',fontSize:9,fontWeight:'800',letterSpacing:2,marginTop:22}, card:{backgroundColor:C.white,marginHorizontal:17,marginTop:-24,padding:20,borderRadius:20,borderWidth:1,borderColor:'#E7EEE9'}, title:{fontSize:22,fontWeight:'900',color:C.ink}, muted:{fontSize:12,color:C.muted,marginTop:6,lineHeight:18}, field:{marginTop:15}, label:{fontSize:12,fontWeight:'700',color:C.ink,marginBottom:7}, input:{height:49,borderWidth:1,borderColor:C.line,borderRadius:11,paddingHorizontal:13,color:C.ink,backgroundColor:'#FBFDFC'}, primary:{height:50,backgroundColor:C.green,borderRadius:12,alignItems:'center',justifyContent:'center',marginTop:18}, primaryText:{color:C.white,fontSize:14,fontWeight:'800'}, disabled:{opacity:0.45}, switch:{alignItems:'center',padding:17}, switchText:{color:C.green,fontWeight:'700',fontSize:12}, header:{backgroundColor:C.dark,paddingHorizontal:21,paddingTop:21,paddingBottom:24,borderBottomLeftRadius:23,borderBottomRightRadius:23,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, eyebrow:{color:'#9EDDB8',fontSize:9,fontWeight:'800',letterSpacing:1.5}, headerTitle:{color:C.white,fontSize:23,fontWeight:'900',marginTop:6}, exit:{width:40,height:40,borderRadius:14,backgroundColor:'#195C43',alignItems:'center',justifyContent:'center'}, exitText:{color:C.white,fontSize:21}, content:{padding:17,paddingBottom:28}, mapCard:{backgroundColor:C.white,padding:15,borderRadius:18,borderWidth:1,borderColor:'#E7EEE9',marginTop:14}, mapHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10}, mapFrame:{height:190,borderRadius:13,overflow:'hidden',backgroundColor:'#EAF2EC'}, mapAttribution:{position:'absolute',right:6,bottom:5,color:'#26352C',backgroundColor:'rgba(255,255,255,0.85)',fontSize:8,paddingHorizontal:4,paddingVertical:2}, ridesHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, refreshText:{color:C.green,fontWeight:'800',fontSize:12}, emptyRides:{color:C.muted,fontSize:12,marginTop:15}, ride:{borderTopWidth:1,borderTopColor:C.line,marginTop:14,paddingTop:14}, rideTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, rideStatus:{fontSize:12,fontWeight:'900',color:C.dark}, rideFare:{fontSize:14,fontWeight:'900',color:C.green}, rideLabel:{fontSize:9,fontWeight:'900',letterSpacing:1,color:C.muted,marginTop:12}, rideAddress:{fontSize:13,fontWeight:'700',color:C.ink,marginTop:3}, statusCard:{backgroundColor:C.white,padding:18,borderRadius:18,borderWidth:1,borderColor:'#E7EEE9'}, sectionTitle:{color:C.ink,fontSize:18,fontWeight:'900'}, statusLine:{flexDirection:'row',alignItems:'center',marginTop:15}, statusDot:{width:10,height:10,borderRadius:5,marginRight:9}, statusText:{fontSize:15,fontWeight:'800',color:C.dark}, notice:{fontSize:10,color:C.amber,lineHeight:15,marginTop:10}, vehicle:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.line}, vehicleName:{fontSize:13,fontWeight:'800',color:C.ink}, vehicleState:{fontSize:10,color:C.amber,fontWeight:'700',marginTop:4}, formTitle:{fontSize:14,fontWeight:'800',color:C.dark,marginTop:20}, secondary:{height:48,borderRadius:11,borderWidth:1,borderColor:C.green,alignItems:'center',justifyContent:'center',marginTop:16}, secondaryText:{color:C.green,fontSize:12,fontWeight:'800'}, info:{backgroundColor:C.pale,padding:16,borderRadius:15,marginTop:14}, infoTitle:{color:C.dark,fontSize:13,fontWeight:'900'}, footer:{color:'#9AA79F',fontSize:10,textAlign:'center',marginTop:20}
});
