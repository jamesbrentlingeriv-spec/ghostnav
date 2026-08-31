import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Camera, CameraKind } from '../types/camera';
import { GPSState, LatLng, RouteResult } from '../types/navigation';
import { haversineDistance, formatDistance, formatBearing } from '../services/spatial';

interface MapComponentProps {
  gpsState: GPSState | null;
  cameras: Camera[];
  selectedCamera: Camera | null;
  onSelectCamera: (camera: Camera | null) => void;
  activeRoute: RouteResult | null;
  alternativeRoute?: RouteResult | null;
  onMapClick?: (coords: LatLng) => void;
  followUser: boolean;
}

const KIND_COLORS: Record<CameraKind, string> = {
  flock: '#f43f5e',
  speed: '#f59e0b',
  red_light: '#ef4444',
  anpr: '#8b5cf6',
};

const KIND_DETAILS: Record<CameraKind, { name: string; type: string; mount: string; desc: string }> = {
  flock: {
    name: 'Flock Safety ALPR',
    type: 'Static Optical ALPR Sensor',
    mount: 'Fixed Pole / Solar Station',
    desc: 'Automated License Plate Reader recording plate, vehicle make, model, color, and timestamp in 30-day cloud search network.',
  },
  speed: {
    name: 'Speed Enforcement Radar',
    type: 'Static Speed Camera',
    mount: 'Fixed Roadside Mast',
    desc: 'Automated Doppler speed radar & LiDAR detecting vehicle velocity infractions.',
  },
  red_light: {
    name: 'Red-Light Camera',
    type: 'Static Intersection Camera',
    mount: 'Signal Mast Arm / Stop-Bar Pole',
    desc: 'Monitors intersection stop-line detection loops for red phase breaches.',
  },
  anpr: {
    name: 'Fixed ANPR / Toll Scanner',
    type: 'Static Highway ANPR',
    mount: 'Overhead Gantry / Bridge Mount',
    desc: 'High-speed broadband multi-lane optical plate recognition and commercial tracking station.',
  },
};


export const MapComponent: React.FC<MapComponentProps> = ({
  gpsState,
  cameras,
  selectedCamera,
  onSelectCamera,
  activeRoute,
  alternativeRoute,
  onMapClick,
  followUser,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const cameraLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hasInitiallyCenteredRef = useRef<boolean>(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = gpsState ? gpsState.latitude : 38.0406;
    const initialLng = gpsState ? gpsState.longitude : -84.5037;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: true,
    });

    cameraLayerGroupRef.current = L.layerGroup().addTo(map);
    routeLayerGroupRef.current = L.layerGroup().addTo(map);

    // 100% Free OpenStreetMap basemap - zero API key required
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c']
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
      }
    });

    mapInstanceRef.current = map;

    // Resize observer to ensure tiles re-render perfectly when sidebar toggles
    let resizeObserver: ResizeObserver | null = null;
    if (mapContainerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update User GPS Marker & Follow Camera
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !gpsState) return;

    const userLatLng = L.latLng(gpsState.latitude, gpsState.longitude);

    // Automatically center and zoom to user's real location on first GPS acquisition
    if (!hasInitiallyCenteredRef.current) {
      map.setView(userLatLng, 16, { animate: true });
      hasInitiallyCenteredRef.current = true;
    }

    // User marker icon with directional heading rotation
    const heading = gpsState.heading ?? 0;
    const userIconHtml = `
      <div class="relative flex items-center justify-center" style="width: 44px; height: 44px;">
        <div class="absolute inset-0 bg-blue-500/20 rounded-full gps-pulse"></div>
        <div class="relative w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white"
             style="transform: rotate(${heading}deg); transition: transform 0.3s ease-out;">
          <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
          </svg>
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: userIconHtml,
      className: 'custom-user-puck',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(userLatLng);
      userMarkerRef.current.setIcon(userIcon);
    }

    // Accuracy Circle
    if (!userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current = L.circle(userLatLng, {
        radius: Math.max(gpsState.accuracy, 10),
        color: '#3b82f6',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
      }).addTo(map);
    } else {
      userAccuracyCircleRef.current.setLatLng(userLatLng);
      userAccuracyCircleRef.current.setRadius(Math.max(gpsState.accuracy, 10));
    }

    if (followUser) {
      const targetZoom = activeRoute ? 18 : 17.5;
      const currentZoom = map.getZoom();
      
      if (currentZoom < targetZoom) {
        map.setZoom(targetZoom, { animate: false });
      }

      // Offset user location towards the lower center of the screen
      // so the top navigation banner doesn't cover the road ahead
      const zoomForProject = Math.max(map.getZoom(), targetZoom);
      const point = map.project(userLatLng, zoomForProject);
      // Shift viewpoint 160px north (up) so the car sits in the bottom half of the screen
      const offsetPoint = point.subtract([0, 140]);
      const targetCenter = map.unproject(offsetPoint, zoomForProject);

      map.panTo(targetCenter, { animate: true, duration: 0.6 });
    }
  }, [gpsState, followUser, activeRoute]);

  // Render Camera Markers with Directional Vision Cones
  useEffect(() => {
    const layer = cameraLayerGroupRef.current;
    if (!layer) return;

    layer.clearLayers();

    cameras.forEach((camera) => {
      const color = KIND_COLORS[camera.kind];
      const isSelected = selectedCamera?.id === camera.id;
      const isFlock = camera.kind === 'flock';

      // Clean, rotated directional lens cone and custom logo badge
      const iconHtml = `
        <div class="group relative flex items-center justify-center cursor-pointer" style="width: 70px; height: 70px;">
          <!-- Field of View Directional Vision Cone -->
          <div class="absolute pointer-events-none" style="top: 35px; left: 35px; transform: rotate(${camera.facing_degrees}deg); transform-origin: 0 0;">
            <div style="
              width: 0;
              height: 0;
              border-left: 24px solid transparent;
              border-right: 24px solid transparent;
              border-top: 60px solid ${color}66;
              transform: translate(-50%, -60px);
              filter: drop-shadow(0 0 6px ${color});
            "></div>
          </div>

          <!-- Camera Badge Node with Kind-Specific Logos -->
          <div class="relative w-9 h-9 rounded-2xl flex items-center justify-center shadow-2xl border-2 border-white/90 transition-transform duration-200 group-hover:scale-125 ${
            isSelected ? 'ring-4 ring-white scale-125' : isFlock ? 'ring-2 ring-rose-400' : ''
          }" style="background-color: ${color};">
            ${
              isFlock
                ? `<!-- Flock Logo Icon -->
                   <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                     <path d="M2 12h20M7 7l5-5 5 5M7 17l5 5 5-5"/>
                     <circle cx="12" cy="12" r="3" fill="currentColor"/>
                   </svg>`
                : camera.kind === 'speed'
                ? `<!-- Speed Radar Icon -->
                   <svg class="w-5 h-5 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                     <path d="M12 14v-4M3.34 19a10 10 0 1 1 17.32 0"/>
                   </svg>`
                : camera.kind === 'red_light'
                ? `<!-- Red Light Icon -->
                   <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                     <circle cx="12" cy="12" r="5"/>
                     <circle cx="12" cy="12" r="9" stroke="white" stroke-width="2" fill="none"/>
                   </svg>`
                : `<!-- ANPR Scanner Icon -->
                   <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                     <rect x="2" y="5" width="20" height="14" rx="2"/>
                     <path d="M6 12h12M10 9l2 3-2 3"/>
                   </svg>`
            }

            <!-- Pointer Arrow showing facing direction -->
            <div class="absolute -top-1.5 w-3 h-3 bg-white rotate-45 rounded-xs shadow-md"
                 style="transform: rotate(${camera.facing_degrees}deg) translateY(-16px);"></div>
          </div>

          <!-- High-Contrast Kind Badge -->
          <div class="absolute -bottom-3.5 px-2 py-0.5 ${
            isFlock ? 'bg-rose-950 text-rose-200 border-rose-500' : 'bg-slate-950 text-white border-slate-700'
          } text-[9px] font-black rounded-md border tracking-wider shadow-lg whitespace-nowrap flex items-center gap-1">
            ${isFlock ? '🛰️ FLOCK' : camera.kind.toUpperCase()} ${camera.facing_degrees}°
          </div>
        </div>
      `;

      const markerIcon = L.divIcon({
        html: iconHtml,
        className: 'camera-directional-marker',
        iconSize: [70, 70],
        iconAnchor: [35, 35],
      });

      const marker = L.marker([camera.latitude, camera.longitude], {
        icon: markerIcon,
        zIndexOffset: isFlock ? 500 : 200,
      });

      // Calculate distance if GPS is available
      const distMeters = gpsState
        ? haversineDistance(gpsState.latitude, gpsState.longitude, camera.latitude, camera.longitude)
        : null;
      const distStr = distMeters !== null ? formatDistance(distMeters) : null;
      const details = KIND_DETAILS[camera.kind];

      // Rich Pop-up Overlay HTML
      const popupHtml = `
        <div class="p-4 bg-slate-900 text-slate-100 rounded-2xl min-w-[260px] max-w-[310px] border border-slate-700 shadow-2xl font-sans">
          <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
            <span class="text-[11px] font-black uppercase px-2.5 py-1 rounded-lg text-white tracking-wider shadow-sm" style="background-color: ${color};">
              ${details.name}
            </span>
            <span class="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              STATIC
            </span>
          </div>

          <div class="mt-3 space-y-1.5 text-xs">
            <div class="flex items-center justify-between py-0.5">
              <span class="text-slate-400 font-medium">Installation:</span>
              <span class="text-white font-bold text-right">${details.type}</span>
            </div>
            <div class="flex items-center justify-between py-0.5">
              <span class="text-slate-400 font-medium">Mount Type:</span>
              <span class="text-slate-200 font-semibold text-right">${details.mount}</span>
            </div>
            <div class="flex items-center justify-between py-0.5">
              <span class="text-slate-400 font-medium">Facing Azimuth:</span>
              <span class="text-amber-400 font-black flex items-center gap-1">
                ${camera.facing_degrees}° (${formatBearing(camera.facing_degrees)})
              </span>
            </div>
            ${
              distStr
                ? `
              <div class="flex items-center justify-between py-0.5">
                <span class="text-slate-400 font-medium">Distance from You:</span>
                <span class="text-sky-400 font-black">${distStr}</span>
              </div>
            `
                : ''
            }
            <div class="flex items-center justify-between py-0.5 text-[10px]">
              <span class="text-slate-500">Camera Ref:</span>
              <span class="text-slate-400 font-mono font-semibold">${camera.id}</span>
            </div>
          </div>

          <div class="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-300 leading-relaxed bg-slate-950/60 p-2 rounded-xl border border-slate-800">
            ${details.desc}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        maxWidth: 320,
        className: 'custom-camera-popup',
        offset: [0, -20],
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectCamera(camera);
      });

      layer.addLayer(marker);
    });
  }, [cameras, selectedCamera, gpsState]);

  const lastFittedRouteKeyRef = useRef<string>('');

  // Render Routes (Active Route + Alternative Route)
  useEffect(() => {
    const layer = routeLayerGroupRef.current;
    const map = mapInstanceRef.current;
    if (!layer || !map) return;

    layer.clearLayers();

    if (alternativeRoute && alternativeRoute.path.length > 0) {
      const altLatLngs = alternativeRoute.path.map((p) => [p.latitude, p.longitude] as [number, number]);
      const altLine = L.polyline(altLatLngs, {
        color: '#64748b',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.7,
      });
      layer.addLayer(altLine);
    }

    if (activeRoute && activeRoute.path.length > 0) {
      const routeLatLngs = activeRoute.path.map((p) => [p.latitude, p.longitude] as [number, number]);

      // Route casing for high contrast
      const routeCasing = L.polyline(routeLatLngs, {
        color: '#020617',
        weight: 8,
        opacity: 0.9,
      });
      layer.addLayer(routeCasing);

      // Main route polyline
      const routeColor = activeRoute.isAvoidanceRoute ? '#10b981' : '#0284c7';
      const routeLine = L.polyline(routeLatLngs, {
        color: routeColor,
        weight: 5,
        opacity: 1.0,
      });
      layer.addLayer(routeLine);

      // Destination Pin
      const dest = activeRoute.path[activeRoute.path.length - 1];
      const destIconHtml = `
        <div class="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white font-bold border-2 border-white shadow-xl">
          🏁
        </div>
      `;
      const destMarker = L.marker([dest.latitude, dest.longitude], {
        icon: L.divIcon({ html: destIconHtml, className: 'dest-pin', iconSize: [32, 32], iconAnchor: [16, 16] }),
      });
      layer.addLayer(destMarker);

      // Only fit bounds ONCE per newly selected route (prevents continuous zoom out loop)
      const currentRouteKey = `${dest.latitude.toFixed(4)},${dest.longitude.toFixed(4)}-${activeRoute.isAvoidanceRoute}`;
      if (lastFittedRouteKeyRef.current !== currentRouteKey && activeRoute.path.length > 1) {
        lastFittedRouteKeyRef.current = currentRouteKey;
        const bounds = L.latLngBounds(routeLatLngs);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      }
    } else {
      lastFittedRouteKeyRef.current = '';
    }
  }, [activeRoute, alternativeRoute]);

  return <div ref={mapContainerRef} className="w-full h-full relative" />;
};
