import React, { useState } from 'react';
import { geocodingService } from '../services/geocoding';
import {
  MapPin,
  Crosshair,
  Search,
  Loader2,
  ShieldAlert,
  X,
} from 'lucide-react';

interface InitialLocationModalProps {
  isOpen: boolean;
  onSelectZip: (zipData: {
    zip: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
    formatted: string;
  }) => void;
  onSelectCurrentLocation: () => void;
  onClose?: () => void;
  isLoading: boolean;
  statusMessage?: string | null;
  currentSectorName?: string | null;
}

const PRESET_ZIPS = [
  { zip: '40509', label: 'Lexington, KY (40509)' },
  { zip: '37201', label: 'Nashville, TN (37201)' },
  { zip: '90210', label: 'Beverly Hills, CA (90210)' },
  { zip: '60601', label: 'Chicago, IL (60601)' },
  { zip: '30303', label: 'Atlanta, GA (30303)' },
];

export const InitialLocationModal: React.FC<InitialLocationModalProps> = ({
  isOpen,
  onSelectZip,
  onSelectCurrentLocation,
  onClose,
  isLoading,
  statusMessage,
  currentSectorName,
}) => {
  const [zipInput, setZipInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLookingUpZip, setIsLookingUpZip] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleZipSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const clean = zipInput.trim().replace(/[^\d]/g, '');
    if (clean.length !== 5) {
      setErrorMessage('Please enter a valid 5-digit US ZIP code (e.g. 40509)');
      return;
    }

    setIsLookingUpZip(true);
    try {
      const data = await geocodingService.lookupZipCode(clean);
      if (!data) {
        setErrorMessage(`Could not resolve ZIP ${clean}. Please verify the 5-digit code.`);
        return;
      }
      onSelectZip(data);
    } catch (err) {
      setErrorMessage('Network error looking up ZIP code. Please try again.');
    } finally {
      setIsLookingUpZip(false);
    }
  };

  const handleQuickZipClick = (zip: string) => {
    setZipInput(zip);
    setErrorMessage(null);
    setIsLookingUpZip(true);
    geocodingService.lookupZipCode(zip).then((data) => {
      setIsLookingUpZip(false);
      if (data) {
        onSelectZip(data);
      } else {
        setErrorMessage(`Could not locate ZIP ${zip}`);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900/95 border-2 border-cyan-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-500/20 text-slate-100 cyber-panel">
        
        {/* Close Button (If already initialized) */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:border-cyan-400 transition cursor-pointer"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Top Radar Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-bold">
            SURVEILLANCE RADAR INITIALIZATION
          </span>
        </div>

        {/* Headline */}
        <h2 className="font-orbitron font-black text-xl sm:text-2xl text-white tracking-wide leading-tight mb-2">
          INITIALIZE YOUR SECTOR
        </h2>
        
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans mb-6">
          Enter your <span className="text-cyan-300 font-bold">5-digit ZIP code</span> or use{' '}
          <span className="text-emerald-300 font-bold">live device GPS</span> to instantly load and display all
          surveillance cameras, Flock ALPR dragnet nodes, and speed traps in your area.
        </p>

        {/* Status / Loading Banner */}
        {(isLoading || isLookingUpZip) && (
          <div className="mb-6 p-4 rounded-2xl bg-cyan-950/60 border border-cyan-500/50 flex items-center gap-3 animate-pulse">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
            <div className="text-xs font-mono text-cyan-300">
              {statusMessage || 'Initializing sector & querying surveillance grid...'}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/60 flex items-center gap-2 text-xs font-mono text-rose-300">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form: ZIP Code Input */}
        <form onSubmit={handleZipSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>Enter 5-Digit ZIP Code</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                pattern="[0-9]*"
                maxLength={5}
                value={zipInput}
                onChange={(e) => {
                  setZipInput(e.target.value);
                  setErrorMessage(null);
                }}
                disabled={isLoading || isLookingUpZip}
                placeholder="e.g. 40509"
                autoFocus
                className="w-full py-3.5 pl-4 pr-28 rounded-2xl bg-slate-950 border-2 border-slate-700 text-lg font-mono font-bold tracking-widest text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition"
              />
              <button
                type="submit"
                disabled={isLoading || isLookingUpZip || zipInput.trim().length === 0}
                className="absolute right-1.5 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-orbitron font-bold text-xs uppercase tracking-wider transition disabled:opacity-40 disabled:cursor-not-allowed shadow-cyan-glow flex items-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Scan Grid</span>
              </button>
            </div>
          </div>
        </form>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="border-t border-slate-800 w-full"></div>
          <span className="bg-slate-900 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-widest absolute">
            or quick scan
          </span>
        </div>

        {/* Option 2: Use Current Location Button */}
        <button
          type="button"
          onClick={onSelectCurrentLocation}
          disabled={isLoading || isLookingUpZip}
          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-950/60 border-2 border-emerald-500/60 hover:bg-emerald-900/60 hover:border-emerald-400 text-emerald-300 font-orbitron font-bold text-xs sm:text-sm uppercase tracking-wider transition-all shadow-emerald-glow flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-40"
        >
          <Crosshair className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>📍 Use My Current Location</span>
        </button>

        {/* Quick Sector Presets */}
        <div className="mt-6 pt-4 border-t border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Popular Sector Presets:</span>
            {currentSectorName && (
              <span className="text-cyan-400 font-bold truncate max-w-[200px]">
                Active: {currentSectorName}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_ZIPS.map((p) => (
              <button
                key={p.zip}
                type="button"
                onClick={() => handleQuickZipClick(p.zip)}
                disabled={isLoading || isLookingUpZip}
                className="px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-5 text-center text-[10px] font-mono text-slate-500">
          🔒 Offline Capable • DeFlock & OSM Overpass Surveillance Grid • Zero Tracking
        </div>
      </div>
    </div>
  );
};
