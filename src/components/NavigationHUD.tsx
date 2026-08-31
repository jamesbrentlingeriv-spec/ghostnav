import React, { useState, useEffect } from 'react';
import { GPSState, LatLng, RouteResult, CameraAlert } from '../types/navigation';
import { formatDistance, formatSpeed, formatBearing } from '../services/spatial';
import { geocodingService, GeocodingResult } from '../services/geocoding';
import {
  Compass,
  Navigation,
  Volume2,
  VolumeX,
  Crosshair,
  ShieldAlert,
  ShieldCheck,
  ArrowUpRight,
  ArrowUpLeft,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Radio,
  Menu,
  X,
  StopCircle,
  Search,
  Loader2,
  MapPin,
} from 'lucide-react';

interface NavigationHUDProps {
  gpsState: GPSState | null;
  activeRoute: RouteResult | null;
  activeAlert: CameraAlert | null;
  isMuted: boolean;
  onToggleMute: () => void;
  followUser: boolean;
  onToggleFollow: () => void;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onLocateMe?: () => void;
  onClearRoute?: () => void;
  onSelectDestination?: (dest: LatLng, name?: string) => void;
}

export const NavigationHUD: React.FC<NavigationHUDProps> = ({
  gpsState,
  activeRoute,
  activeAlert,
  isMuted,
  onToggleMute,
  followUser,
  onToggleFollow,
  isMenuOpen,
  onToggleMenu,
  onLocateMe,
  onClearRoute,
  onSelectDestination,
}) => {
  const currentStep = activeRoute?.steps[0];
  const nextStep = activeRoute?.steps[1];

  // Quick Destination Search Bar State
  const [hudSearchQuery, setHudSearchQuery] = useState<string>('');
  const [hudSearchResults, setHudSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearchingHud, setIsSearchingHud] = useState<boolean>(false);
  const [showHudDropdown, setShowHudDropdown] = useState<boolean>(false);

  useEffect(() => {
    if (!hudSearchQuery || hudSearchQuery.trim().length < 2) {
      setHudSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingHud(true);
      try {
        const res = await geocodingService.searchPlaces(
          hudSearchQuery,
          gpsState?.latitude || 38.0406,
          gpsState?.longitude || -84.5037
        );
        setHudSearchResults(res);
      } finally {
        setIsSearchingHud(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [hudSearchQuery, gpsState]);

  const handlePickHudResult = (item: GeocodingResult) => {
    setHudSearchQuery(item.name);
    setShowHudDropdown(false);
    if (onSelectDestination) {
      onSelectDestination({ latitude: item.latitude, longitude: item.longitude }, item.name);
    }
  };

  const handleHudSubmit = async () => {
    if (!hudSearchQuery.trim()) return;
    setIsSearchingHud(true);
    try {
      const resolved = await geocodingService.resolveQueryToCoords(
        hudSearchQuery,
        gpsState?.latitude,
        gpsState?.longitude
      );
      if (resolved && onSelectDestination) {
        setHudSearchQuery(resolved.name);
        setShowHudDropdown(false);
        onSelectDestination(resolved.coords, resolved.name);
      }
    } finally {
      setIsSearchingHud(false);
    }
  };

  const getManeuverIcon = (maneuver?: string) => {
    switch (maneuver) {
      case 'turn-left':
        return <CornerUpLeft className="w-10 h-10 text-white" strokeWidth={2.5} />;
      case 'slight-left':
        return <ArrowUpLeft className="w-10 h-10 text-white" strokeWidth={2.5} />;
      case 'turn-right':
        return <CornerUpRight className="w-10 h-10 text-white" strokeWidth={2.5} />;
      case 'slight-right':
        return <ArrowUpRight className="w-10 h-10 text-white" strokeWidth={2.5} />;
      case 'arrive':
        return <Flag className="w-10 h-10 text-emerald-300 fill-emerald-300" />;
      case 'straight':
      case 'depart':
      default:
        return <ArrowUp className="w-10 h-10 text-white" strokeWidth={2.5} />;
    }
  };

  // Compute Estimated Time of Arrival (e.g. 8:15 PM)
  const getEtaTimeString = (durationSeconds: number) => {
    const arrivalDate = new Date(Date.now() + durationSeconds * 1000);
    return arrivalDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <>
      {/* Top Floating Controls and Navigation Header */}
      <div
        style={{ zIndex: 9990 }}
        className="absolute inset-x-0 top-0 pointer-events-none z-[9990] p-2.5 sm:p-4 flex flex-col gap-2.5"
      >
        {/* Top Header: Hamburger Button + Google Maps Style Guidance Header + Right Controls */}
        <div className="flex items-start justify-between gap-2.5">
          {/* Hamburger Menu Toggle Button */}
          <div className="pointer-events-auto flex items-center gap-2">
            {!isMenuOpen ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu();
                }}
                style={{ zIndex: 10000 }}
                className="p-3 sm:px-4 sm:py-3 rounded-2xl bg-slate-900/95 border-2 border-sky-400 text-white hover:bg-slate-800 transition-all duration-200 shadow-2xl flex items-center gap-2 font-black text-xs ring-4 ring-sky-500/30 cursor-pointer backdrop-blur-md"
                title="Open Menu"
              >
                <Menu className="w-5 h-5 text-sky-400 animate-pulse" />
                <span className="font-extrabold text-xs tracking-wider">MENU</span>
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu();
                }}
                style={{ zIndex: 10000 }}
                className="p-3 sm:px-4 sm:py-3 rounded-2xl bg-slate-900/95 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-all duration-200 shadow-xl flex items-center gap-2 font-bold text-xs cursor-pointer backdrop-blur-md"
                title="Hide Menu (Full Map View)"
              >
                <X className="w-5 h-5 text-rose-400" />
                <span className="hidden sm:inline">FULL MAP</span>
              </button>
            )}
          </div>

          {/* Google Maps Style Navigation Header Banner (Top Center when Navigating) */}
          {activeRoute ? (
            <div className="pointer-events-auto flex-1 max-w-2xl shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4">
              {/* Primary Green Navigation Maneuver Box */}
              <div className="bg-emerald-700/98 border-2 border-emerald-400 text-white rounded-2xl p-3.5 sm:p-4 backdrop-blur-md shadow-2xl flex items-center gap-3.5">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-900/90 border-2 border-emerald-400/50 flex items-center justify-center shrink-0 shadow-inner">
                  {getManeuverIcon(currentStep?.maneuver)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-none">
                      {currentStep ? formatDistance(currentStep.distanceMeters) : '0 ft'}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-900/90 text-emerald-200 border border-emerald-500/40 rounded-lg flex items-center gap-1">
                      <Compass className="w-3 h-3 text-emerald-300" />
                      Head {formatBearing(gpsState?.heading ?? 0)}
                    </span>
                  </div>
                  <div className="text-sm sm:text-base font-bold text-emerald-100 truncate">
                    {currentStep?.instruction || 'Continue on route'}
                  </div>
                </div>
              </div>

              {/* Secondary 'Then' Step Preview Banner */}
              {nextStep && (
                <div className="mx-3 px-3.5 py-1.5 bg-emerald-950/95 border-x-2 border-b-2 border-emerald-500/70 rounded-b-xl text-[11px] font-semibold text-emerald-300 flex items-center gap-2 shadow-lg">
                  <span className="uppercase text-[9px] font-black px-1.5 py-0.2 bg-emerald-800 text-emerald-100 rounded">
                    Then
                  </span>
                  <span className="truncate">{nextStep.instruction}</span>
                </div>
              )}
            </div>
          ) : (
            /* Floating Google Maps Destination Search Bar (When not navigating) */
            <div className="pointer-events-auto flex-1 max-w-xl relative">
              <div className="relative flex items-center shadow-2xl">
                <Search className="w-4 h-4 text-sky-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={hudSearchQuery}
                  onChange={(e) => {
                    setHudSearchQuery(e.target.value);
                    setShowHudDropdown(true);
                  }}
                  onFocus={() => setShowHudDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleHudSubmit();
                    }
                  }}
                  placeholder="Where to? Type address or destination..."
                  className="w-full py-3 pl-10 pr-24 rounded-2xl bg-slate-900/95 border-2 border-slate-700 text-white placeholder-slate-400 font-semibold text-xs sm:text-sm focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-500/20 backdrop-blur-md shadow-2xl transition"
                />
                {isSearchingHud ? (
                  <Loader2 className="w-4 h-4 text-sky-400 animate-spin absolute right-20" />
                ) : hudSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHudSearchQuery('');
                      setHudSearchResults([]);
                    }}
                    className="absolute right-20 p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleHudSubmit}
                  disabled={!hudSearchQuery.trim() || isSearchingHud}
                  className="absolute right-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center gap-1 active:scale-95"
                >
                  <Navigation className="w-3.5 h-3.5 fill-white" />
                  Route
                </button>
              </div>

              {/* Autocomplete Suggestions Dropdown */}
              {showHudDropdown && hudSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[10000] max-h-60 overflow-y-auto divide-y divide-slate-800 backdrop-blur-md">
                  {hudSearchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePickHudResult(item);
                      }}
                      className="w-full p-3 text-left hover:bg-slate-800/90 transition flex flex-col gap-0.5 cursor-pointer"
                    >
                      <div className="font-bold text-white text-xs flex items-center justify-between">
                        <span className="truncate flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          {item.name}
                        </span>
                        {item.category && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate pl-5">
                        {item.formattedAddress}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Floating Controls (Right) */}
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
            {onLocateMe && (
              <button
                onClick={onLocateMe}
                className="p-3 rounded-2xl bg-slate-900/90 border border-slate-700 text-sky-400 hover:bg-slate-800 transition shadow-lg flex items-center gap-1.5 font-bold text-xs backdrop-blur-md cursor-pointer"
                title="Recenter GPS Location"
              >
                <Crosshair className="w-5 h-5 text-sky-400" />
                <span className="hidden md:inline">MY GPS</span>
              </button>
            )}

            <button
              onClick={onToggleMute}
              className={`p-3 rounded-2xl border transition shadow-lg backdrop-blur-md cursor-pointer ${
                isMuted
                  ? 'bg-slate-900/90 border-slate-700 text-slate-400'
                  : 'bg-indigo-600 border-indigo-400 text-white'
              }`}
              title={isMuted ? 'Voice Muted (Click to Unmute)' : 'Voice Guidance Active'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              onClick={onToggleFollow}
              className={`p-3 rounded-2xl border transition shadow-lg backdrop-blur-md cursor-pointer ${
                followUser
                  ? 'bg-sky-600 border-sky-400 text-white ring-2 ring-sky-400/40'
                  : 'bg-slate-900/90 border-slate-700 text-slate-400'
              }`}
              title={followUser ? 'Map is locked to vehicle' : 'Free pan'}
            >
              <Navigation className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Near-Camera Critical Alert Banner */}
        {activeAlert && (
          <div className="pointer-events-auto self-center max-w-xl w-full bg-rose-950/95 border-2 border-rose-500 rounded-2xl p-3.5 sm:p-4 shadow-2xl backdrop-blur-md alert-active-flash transition-all animate-bounce">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <ShieldAlert className="w-7 h-7" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-black bg-rose-500 text-white uppercase tracking-wider">
                    {activeAlert.camera.kind.replace('_', ' ')} CAMERA
                  </span>
                  <span className="text-xs text-rose-300 font-semibold flex items-center gap-1">
                    <Radio className="w-3.5 h-3.5 animate-pulse text-rose-400" />
                    ID: {activeAlert.camera.id}
                  </span>
                </div>

                <div className="text-base sm:text-lg font-bold text-white mt-1">
                  Approaching Camera in {formatDistance(activeAlert.distanceMeters)}
                </div>

                <div className="text-xs text-rose-200/90 flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                  <span>Facing: <strong>{activeAlert.camera.facing_degrees}°</strong></span>
                  <span>
                    Orientation:{' '}
                    <strong>
                      {activeAlert.isFacingTowardsUser
                        ? '⚠️ Pointed at your vehicle'
                        : '🔄 Angled / Crosswise'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Telemetry Dashboard (Speed & Heading) */}
        {!activeRoute && (
          <div className="self-start pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl px-3.5 py-2 flex items-center gap-4 text-xs font-medium text-slate-300 shadow">
            <div className="flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-bold text-white text-sm">{formatSpeed(gpsState?.speed ?? 0)}</span>
            </div>
            <div className="w-px h-3.5 bg-slate-700"></div>
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>{formatBearing(gpsState?.heading ?? 0)}</span>
            </div>
            <div className="w-px h-3.5 bg-slate-700"></div>
            <div className="text-[11px] text-slate-400 hidden sm:block">
              {gpsState ? `${gpsState.latitude.toFixed(4)}°, ${gpsState.longitude.toFixed(4)}°` : 'Acquiring GPS...'}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Google Maps Trip Bar (ETA, Remaining Time, Distance, & Exit) */}
      {activeRoute && (
        <div
          style={{ zIndex: 9990 }}
          className="absolute inset-x-0 bottom-4 pointer-events-none z-[9990] flex justify-center px-4"
        >
          <div className="pointer-events-auto w-full max-w-xl bg-slate-900/95 border border-slate-700/80 rounded-3xl p-4 shadow-2xl backdrop-blur-md flex items-center justify-between gap-4">
            {/* Trip ETA & Duration Stats */}
            <div className="flex items-center gap-4 min-w-0">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 leading-none">
                  {Math.max(1, Math.ceil(activeRoute.estimatedDurationSeconds / 60))}
                  <span className="text-sm font-semibold ml-1 text-emerald-300">min</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-medium">
                  <span className="font-bold text-white">
                    {formatDistance(activeRoute.distanceMeters)}
                  </span>
                  <span>•</span>
                  <span>ETA {getEtaTimeString(activeRoute.estimatedDurationSeconds)}</span>
                </div>
              </div>

              {/* Safety Badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {activeRoute.camerasEncountered.length === 0
                    ? '0 Cameras (100% Safe)'
                    : `${activeRoute.camerasEncountered.length} Camera on Path`}
                </span>
              </div>
            </div>

            {/* Red Exit Navigation Button */}
            <div className="flex items-center gap-2 shrink-0">
              {onClearRoute && (
                <button
                  onClick={onClearRoute}
                  className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Exit Navigation"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Exit</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
