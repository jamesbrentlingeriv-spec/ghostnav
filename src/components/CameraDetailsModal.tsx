import React from 'react';
import { Camera, CameraKind } from '../types/camera';
import { GPSState } from '../types/navigation';
import { haversineDistance, formatDistance, isCameraFacingApproachingUser } from '../services/spatial';
import { X, Camera as CameraIcon, Compass, Navigation, Eye } from 'lucide-react';

interface CameraDetailsModalProps {
  camera: Camera | null;
  gpsState: GPSState | null;
  onClose: () => void;
}

const KIND_METADATA: Record<CameraKind, { name: string; badgeColor: string; description: string }> = {
  flock: {
    name: 'Flock Safety ALPR',
    badgeColor: 'bg-rose-500 text-white',
    description: 'Automated License Plate Reader recording vehicle characteristics, plates, and timestamps.',
  },
  speed: {
    name: 'Speed Enforcement Camera',
    badgeColor: 'bg-amber-500 text-slate-950 font-bold',
    description: 'Fixed Doppler radar / laser speed enforcement installation.',
  },
  red_light: {
    name: 'Red-Light Intersection Camera',
    badgeColor: 'bg-red-500 text-white',
    description: 'Intersection stop-line monitoring system detecting signal breaches.',
  },
  anpr: {
    name: 'Fixed ANPR Toll / Security',
    badgeColor: 'bg-purple-500 text-white',
    description: 'Highway and arterial fixed optical plate recognition checkpoint.',
  },
};

export const CameraDetailsModal: React.FC<CameraDetailsModalProps> = ({
  camera,
  gpsState,
  onClose,
}) => {
  if (!camera) return null;

  const meta = KIND_METADATA[camera.kind];

  const distanceMeters = gpsState
    ? haversineDistance(
        gpsState.latitude,
        gpsState.longitude,
        camera.latitude,
        camera.longitude
      )
    : null;

  const isFacing = gpsState
    ? isCameraFacingApproachingUser(
        camera,
        { latitude: gpsState.latitude, longitude: gpsState.longitude },
        gpsState.heading
      )
    : false;

  return (
    <div className="fixed inset-x-4 top-20 sm:top-24 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-5 shadow-2xl text-slate-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <CameraIcon className="w-5 h-5" />
            </div>
            <div>
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-extrabold ${meta.badgeColor}`}>
                {meta.name}
              </span>
              <h3 className="text-base font-bold text-white mt-1">ID: {camera.id}</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-3 leading-relaxed">
          {meta.description}
        </p>

        {/* Fixed Camera Schema Inspection */}
        <div className="mt-4 p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Database Record (Fixed Schema)
          </div>

          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">id:</span>
            <span className="font-mono text-white font-semibold">{camera.id}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">latitude:</span>
            <span className="font-mono text-sky-400">{camera.latitude.toFixed(6)}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">longitude:</span>
            <span className="font-mono text-sky-400">{camera.longitude.toFixed(6)}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">facing_degrees:</span>
            <span className="font-mono text-amber-400 font-bold flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 inline" />
              {camera.facing_degrees}°
            </span>
          </div>

          <div className="flex justify-between py-1">
            <span className="text-slate-400">kind:</span>
            <span className="font-mono text-emerald-400 font-semibold">{camera.kind}</span>
          </div>
        </div>

        {/* Real-time Proximity Telemetry */}
        <div className="mt-4 flex items-center justify-between p-3 rounded-2xl bg-sky-950/40 border border-sky-800/50">
          <div className="flex items-center gap-2 text-xs">
            <Navigation className="w-4 h-4 text-sky-400" />
            <span className="text-slate-300">Distance from GPS:</span>
          </div>
          <span className="font-bold text-sm text-sky-300">
            {distanceMeters !== null ? formatDistance(distanceMeters) : 'Unknown'}
          </span>
        </div>

        {/* Facing Status */}
        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5 px-1">
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Lens cone:{' '}
            <strong className={isFacing ? 'text-rose-400' : 'text-slate-300'}>
              {isFacing ? '⚠️ Directly facing your direction' : 'Pointing away / across'}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
