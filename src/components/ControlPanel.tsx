import React, { useState, useEffect } from 'react';
import { CameraKind } from '../types/camera';
import { GPSState, LatLng, RouteResult } from '../types/navigation';
import { formatDistance } from '../services/spatial';
import { geocodingService, GeocodingResult } from '../services/geocoding';
import { voiceNav, VoiceOption, ElevenLabsVoice, CURATED_ELEVEN_VOICES } from '../services/voiceNavigation';
import { PRESET_DESTINATIONS } from '../data/roadNetwork';
import {
  Shield,
  ShieldAlert,
  Navigation,
  MapPin,
  Sliders,
  Play,
  Square,
  Sparkles,
  Layers,
  Info,
  ArrowDownUp,
  Route,
  Search,
  Loader2,
  X,
  Volume2,
  Mic,
  Globe,
  Download,
  ExternalLink,
} from 'lucide-react';

interface ControlPanelProps {
  gpsState: GPSState | null;
  destination?: LatLng | null;
  avoidCameras: boolean;
  onToggleAvoidCameras: (avoid: boolean) => void;
  avoidanceDistance: number;
  onChangeAvoidanceDistance: (dist: number) => void;
  selectedKinds: CameraKind[];
  onToggleKind: (kind: CameraKind) => void;
  onSelectDestination: (dest: LatLng, name?: string) => void;
  onPlanRouteFromTo?: (origin: LatLng | null, destination: LatLng) => void;
  onClearRoute: () => void;
  activeRoute: RouteResult | null;
  standardRoute: RouteResult | null;
  cameraStats: Record<CameraKind, number>;
  onStartSimulation: () => void;
  onStopSimulation: () => void;
  isSimulating: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onScanNearbyCameras?: () => void;
  isScanning?: boolean;
  onJumpToDemoArea?: () => void;
}

const KIND_CONFIG: { kind: CameraKind; label: string; color: string; desc: string }[] = [
  { kind: 'flock', label: 'Flock Safety ALPR', color: 'bg-rose-500', desc: 'Automatic License Plate Readers' },
  { kind: 'speed', label: 'Speed Radar', color: 'bg-amber-500', desc: 'Fixed speed enforcement cameras' },
  { kind: 'red_light', label: 'Red-Light Cameras', color: 'bg-red-500', desc: 'Intersection red light monitors' },
  { kind: 'anpr', label: 'Fixed ANPR / Tolls', color: 'bg-purple-500', desc: 'Broadband plate capture nodes' },
];

export const ControlPanel: React.FC<ControlPanelProps> = ({
  gpsState,
  destination,
  avoidCameras,
  onToggleAvoidCameras,
  avoidanceDistance,
  onChangeAvoidanceDistance,
  selectedKinds,
  onToggleKind,
  onSelectDestination,
  onPlanRouteFromTo,
  onClearRoute,
  activeRoute,
  standardRoute,
  cameraStats,
  onStartSimulation,
  onStopSimulation,
  isSimulating,
  isOpen,
  onToggleOpen,
  onScanNearbyCameras,
  isScanning = false,
  onJumpToDemoArea,
}) => {
  const [activeTab, setActiveTab] = useState<'routing' | 'cameras' | 'settings'>('routing');

  // Search & Origin/Destination State
  const [startQuery, setStartQuery] = useState<string>('📍 Where You Are (Current Location)');
  const [startCoords, setStartCoords] = useState<LatLng | null>(null);
  const [startResults, setStartResults] = useState<GeocodingResult[]>([]);
  const [isSearchingStart, setIsSearchingStart] = useState<boolean>(false);
  const [showStartDropdown, setShowStartDropdown] = useState<boolean>(false);

  const [destQuery, setDestQuery] = useState<string>('');
  const [destCoords, setDestCoords] = useState<LatLng | null>(null);
  const [destResults, setDestResults] = useState<GeocodingResult[]>([]);
  const [isSearchingDest, setIsSearchingDest] = useState<boolean>(false);
  const [showDestDropdown, setShowDestDropdown] = useState<boolean>(false);

  // Sync external destination changes (e.g. from map click)
  useEffect(() => {
    if (destination) {
      setDestCoords(destination);
      geocodingService.reverseGeocode(destination.latitude, destination.longitude).then((name) => {
        setDestQuery(name);
      });
    }
  }, [destination?.latitude, destination?.longitude]);

  // Voice Guidance Settings State
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(voiceNav.getIsEnabled());
  const [voiceEngine, setVoiceEngine] = useState<'elevenlabs' | 'browser'>(voiceNav.getVoiceEngine() as 'elevenlabs' | 'browser');
  const [elevenVoices, setElevenVoices] = useState<ElevenLabsVoice[]>(CURATED_ELEVEN_VOICES);
  const [selectedElevenVoiceId, setSelectedElevenVoiceId] = useState<string>(voiceNav.getElevenLabsVoiceId());
  const [isTestingElevenVoice, setIsTestingElevenVoice] = useState<boolean>(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>(voiceNav.getSelectedVoiceId());

  useEffect(() => {
    const loadVoices = () => {
      const v = voiceNav.getVoices();
      setVoices(v);
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    voiceNav.fetchElevenLabsVoices().then((res) => {
      if (res && res.length > 0) setElevenVoices(res);
    });
  }, []);

  // Debounced Start Location Search
  useEffect(() => {
    if (!startQuery || startQuery === '📍 My Live GPS Location' || startQuery.length < 2) {
      setStartResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingStart(true);
      try {
        const res = await geocodingService.searchPlaces(
          startQuery,
          gpsState?.latitude || 38.0406,
          gpsState?.longitude || -84.5037
        );
        setStartResults(res);
      } finally {
        setIsSearchingStart(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [startQuery, gpsState]);

  // Debounced Destination Search
  useEffect(() => {
    if (!destQuery || destQuery.length < 2) {
      setDestResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingDest(true);
      try {
        const res = await geocodingService.searchPlaces(
          destQuery,
          gpsState?.latitude || 38.0406,
          gpsState?.longitude || -84.5037
        );
        setDestResults(res);
      } finally {
        setIsSearchingDest(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [destQuery, gpsState]);

  const handleSelectStartResult = (item: GeocodingResult) => {
    const coords: LatLng = { latitude: item.latitude, longitude: item.longitude };
    setStartQuery(item.name);
    setStartCoords(coords);
    setShowStartDropdown(false);
  };

  const handleSelectDestResult = (item: GeocodingResult) => {
    const coords: LatLng = { latitude: item.latitude, longitude: item.longitude };
    setDestQuery(item.name);
    setDestCoords(coords);
    setShowDestDropdown(false);
    onSelectDestination(coords, item.name);
  };

  const [isResolvingRoute, setIsResolvingRoute] = useState<boolean>(false);

  const handleUseLiveGpsForStart = () => {
    setStartQuery('📍 Where You Are (Current Location)');
    setStartCoords(null);
    setShowStartDropdown(false);
  };

  const handleRouteClick = async () => {
    if (!destQuery.trim() && !destCoords) {
      return;
    }

    setIsResolvingRoute(true);
    try {
      let finalStart = startCoords;
      if (!finalStart && startQuery && !startQuery.includes('Current Location')) {
        const resolvedStart = await geocodingService.resolveQueryToCoords(
          startQuery,
          gpsState?.latitude,
          gpsState?.longitude
        );
        if (resolvedStart) {
          finalStart = resolvedStart.coords;
          setStartCoords(resolvedStart.coords);
          setStartQuery(resolvedStart.name);
        }
      }

      let finalDest = destCoords;
      if (!finalDest && destQuery && destQuery.trim()) {
        const resolvedDest = await geocodingService.resolveQueryToCoords(
          destQuery,
          gpsState?.latitude,
          gpsState?.longitude
        );
        if (resolvedDest) {
          finalDest = resolvedDest.coords;
          setDestCoords(resolvedDest.coords);
          setDestQuery(resolvedDest.name);
        }
      }

      if (!finalDest) {
        return;
      }

      const effectiveStart = finalStart || (gpsState ? { latitude: gpsState.latitude, longitude: gpsState.longitude } : { latitude: 38.0406, longitude: -84.5037 });

      setShowStartDropdown(false);
      setShowDestDropdown(false);

      if (onPlanRouteFromTo) {
        onPlanRouteFromTo(finalStart ? effectiveStart : null, finalDest);
      } else {
        onSelectDestination(finalDest, destQuery);
      }
    } finally {
      setIsResolvingRoute(false);
    }
  };

  const handleSwapPoints = () => {
    const oldQuery = startQuery;
    const oldCoords = startCoords;
    setStartQuery(destQuery || '📍 Where You Are (Current Location)');
    setStartCoords(destCoords);
    setDestQuery(oldQuery.includes('Current Location') ? '' : oldQuery);
    setDestCoords(oldCoords);
  };

  if (!isOpen) return null;

  return (
    <aside
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{ zIndex: 9999 }}
      className="w-full sm:w-[420px] md:w-[440px] shrink-0 h-full bg-slate-900 border-r border-slate-700/80 z-[9999] shadow-2xl flex flex-col relative select-none"
    >
      {/* Header Bar */}
      <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-md">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
              GhostNav
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                LEXINGTON, KY
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Offline Camera-Aware GPS Navigation</p>
          </div>
        </div>

        {/* Toggle / Collapse Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleOpen();
          }}
          className="p-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition flex items-center gap-1 font-bold text-xs shadow cursor-pointer"
          title="Collapse Sidebar (Full Map View)"
        >
          <span>✕ Hide</span>
        </button>
      </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 px-4 pt-2.5 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('routing')}
            className={`pb-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'routing'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Navigation className="w-4 h-4" />
            Routes
          </button>
          <button
            onClick={() => setActiveTab('cameras')}
            className={`pb-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'cameras'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Flock Cameras ({Object.values(cameraStats).reduce((a, b) => a + b, 0)})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto space-y-4 text-sm text-slate-200 flex-1">
          {activeTab === 'routing' && (
            <>
              {/* PRIMARY REQUIREMENT: Avoid Cameras Toggle */}
              <div
                onClick={() => onToggleAvoidCameras(!avoidCameras)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  avoidCameras
                    ? 'bg-emerald-950/70 border-emerald-500 shadow-lg shadow-emerald-950/50'
                    : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      avoidCameras
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      Avoid Cameras
                      {avoidCameras && (
                        <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                          ON
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300">
                      Enforce {avoidanceDistance}m camera buffer
                    </div>
                  </div>
                </div>

                {/* Custom Toggle Switch */}
                <div
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                    avoidCameras ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                      avoidCameras ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Route Planner Box: Current Location + Destination + Route Button */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3.5 shadow-xl relative">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sky-400">
                    <Route className="w-4 h-4" />
                    Plan Camera-Safe Route
                  </span>
                  <button
                    onClick={handleSwapPoints}
                    title="Swap Start & Destination"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <ArrowDownUp className="w-3.5 h-3.5" />
                    Swap
                  </button>
                </div>

                {/* Search & Location Input Fields */}
                <div className="space-y-3">
                  {/* Start / Origin Address Input */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-950"></span>
                        Start Location / Address
                      </label>
                      {startQuery !== '📍 My Live GPS Location' && (
                        <button
                          onClick={handleUseLiveGpsForStart}
                          className="text-[10px] text-sky-400 hover:underline font-semibold"
                        >
                          Use My GPS
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={startQuery}
                        onChange={(e) => {
                          setStartQuery(e.target.value);
                          setStartCoords(null);
                          setShowStartDropdown(true);
                        }}
                        onFocus={() => setShowStartDropdown(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleRouteClick();
                          }
                        }}
                        placeholder="Search start address or landmark..."
                        className="w-full py-2.5 pl-9 pr-8 rounded-xl bg-slate-950 border border-slate-700 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
                      />
                      {isSearchingStart ? (
                        <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin absolute right-3" />
                      ) : startQuery ? (
                        <button
                          type="button"
                          onClick={() => {
                            setStartQuery('');
                            setStartCoords(null);
                            setStartResults([]);
                          }}
                          className="absolute right-2.5 p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>

                    {/* Start Search Autocomplete Dropdown */}
                    {showStartDropdown && (startResults.length > 0 || startQuery.length > 1) && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-800">
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleUseLiveGpsForStart();
                          }}
                          className="w-full p-2.5 text-left text-xs hover:bg-slate-800/80 transition flex items-center gap-2 text-sky-300 font-semibold cursor-pointer"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          📍 My Live GPS Location (Real-time tracking)
                        </button>
                        {startResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectStartResult(item);
                            }}
                            className="w-full p-2.5 text-left text-xs hover:bg-slate-800/80 transition flex flex-col gap-0.5 cursor-pointer"
                          >
                            <div className="font-bold text-white flex items-center justify-between">
                              <span className="truncate">{item.name}</span>
                              {item.category && (
                                <span className="text-[9px] uppercase px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                                  {item.category}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {item.formattedAddress}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Destination Address / Place Input */}
                  <div className="relative">
                    <label className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-950"></span>
                      Destination Address or Place
                    </label>
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={destQuery}
                        onChange={(e) => {
                          setDestQuery(e.target.value);
                          setDestCoords(null);
                          setShowDestDropdown(true);
                        }}
                        onFocus={() => setShowDestDropdown(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleRouteClick();
                          }
                        }}
                        placeholder="Type address, place, store, or landmark..."
                        className="w-full py-2.5 pl-9 pr-8 rounded-xl bg-slate-950 border border-slate-700 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                      />
                      {isSearchingDest ? (
                        <Loader2 className="w-3.5 h-3.5 text-rose-400 animate-spin absolute right-3" />
                      ) : destQuery ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDestQuery('');
                            setDestCoords(null);
                            setDestResults([]);
                          }}
                          className="absolute right-2.5 p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>

                    {/* Destination Search Autocomplete Dropdown */}
                    {showDestDropdown && destResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-800">
                        {destResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectDestResult(item);
                            }}
                            className="w-full p-2.5 text-left text-xs hover:bg-slate-800/80 transition flex flex-col gap-0.5 cursor-pointer"
                          >
                            <div className="font-bold text-white flex items-center justify-between">
                              <span className="truncate text-slate-100">{item.name}</span>
                              {item.category && (
                                <span className="text-[9px] uppercase px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                                  {item.category}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {item.formattedAddress}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Destinations (1-Tap Select) */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-sky-400" />
                        Quick Destinations (1-Tap Select)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">or type above</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {PRESET_DESTINATIONS.map((dest) => (
                        <button
                          key={dest.name}
                          type="button"
                          onClick={() => {
                            setDestQuery(dest.name);
                            setDestCoords(dest.coords);
                            onSelectDestination(dest.coords, dest.name);
                            if (onPlanRouteFromTo) {
                              const effectiveStart = startCoords || (gpsState ? { latitude: gpsState.latitude, longitude: gpsState.longitude } : null);
                              onPlanRouteFromTo(startCoords ? effectiveStart : null, dest.coords);
                            }
                          }}
                          className={`text-left p-2 rounded-xl border text-[11px] font-medium transition flex flex-col justify-between cursor-pointer ${
                            destQuery === dest.name
                              ? 'bg-sky-950/70 border-sky-500 text-sky-200 shadow-sm'
                              : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:text-white'
                          }`}
                        >
                          <span className="truncate font-semibold">{dest.name}</span>
                          <span className="text-[9px] text-sky-400/90 font-mono mt-0.5">1-Tap Route →</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Big Action ROUTE Button */}
                <button
                  type="button"
                  onClick={handleRouteClick}
                  disabled={isResolvingRoute}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-[0.99] text-white font-black text-sm tracking-wide transition shadow-lg shadow-sky-950/60 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isResolvingRoute ? (
                    <>
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                      Finding Best Road Path...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4 fill-white" />
                      Route
                    </>
                  )}
                </button>
              </div>

              {/* Active Route Comparison Stats */}
              {activeRoute && (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                      Route Analysis
                    </span>
                    <button
                      onClick={onClearRoute}
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Distance</div>
                      <div className="text-sm font-bold text-white">
                        {formatDistance(activeRoute.distanceMeters)}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Est. Time</div>
                      <div className="text-sm font-bold text-white">
                        ~{Math.ceil(activeRoute.estimatedDurationSeconds / 60)} min
                      </div>
                    </div>
                  </div>

                  {/* Camera Exposure Counter */}
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      activeRoute.camerasEncountered.length === 0
                        ? 'bg-emerald-950/50 border-emerald-600/50 text-emerald-300'
                        : 'bg-rose-950/50 border-rose-600/50 text-rose-300'
                    }`}
                  >
                    <span className="font-semibold flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      Cameras within {avoidanceDistance}m:
                    </span>
                    <span className="font-black text-sm">
                      {activeRoute.camerasEncountered.length}
                    </span>
                  </div>

                  {/* Comparison with standard route if avoiding */}
                  {avoidCameras && standardRoute && standardRoute.camerasEncountered.length > 0 && (
                    <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      ✨ Successfully avoided{' '}
                      <strong className="text-emerald-400">
                        {standardRoute.camerasEncountered.length - activeRoute.camerasEncountered.length}
                      </strong>{' '}
                      traffic camera(s) compared to standard route!
                    </div>
                  )}

                  {/* Desktop Test Drive Simulator */}
                  <div className="pt-1">
                    {!isSimulating ? (
                      <button
                        onClick={onStartSimulation}
                        className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Test Drive This Route (Desktop Demo)
                      </button>
                    ) : (
                      <button
                        onClick={onStopSimulation}
                        className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow"
                      >
                        <Square className="w-3.5 h-3.5" />
                        Stop Test Drive (Return to Live GPS)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'cameras' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-rose-400" />
                Filter Active Camera Database
              </div>

              <div className="space-y-2">
                {KIND_CONFIG.map(({ kind, label, color, desc }) => {
                  const isChecked = selectedKinds.includes(kind);
                  const count = cameraStats[kind] || 0;

                  return (
                    <div
                      key={kind}
                      onClick={() => onToggleKind(kind)}
                      className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                        isChecked
                          ? 'bg-slate-800/80 border-slate-700'
                          : 'bg-slate-950/40 border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3.5 h-3.5 rounded-full ${color}`}></div>
                        <div>
                          <div className="font-semibold text-white text-xs">{label}</div>
                          <div className="text-[11px] text-slate-400">{desc}</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-300 px-2 py-0.5 bg-slate-900 rounded-lg border border-slate-800">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Live Location Overpass / DeFlock Sync Button */}
              {onScanNearbyCameras && (
                <button
                  onClick={onScanNearbyCameras}
                  disabled={isScanning}
                  className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-rose-200" />
                  {isScanning ? 'Scanning Overpass for Nearby Cameras...' : '🔍 Scan Cameras Around My Live Location'}
                </button>
              )}

              {/* Jump to Lexington Grid Button */}
              {onJumpToDemoArea && (
                <button
                  onClick={onJumpToDemoArea}
                  className="w-full py-2 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  📍 Recenter on Lexington, KY Grid
                </button>
              )}

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>
                  Cameras feature directional vision cones and live avoidance routing without leaking your driving route.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Camera Avoidance Distance
                  </label>
                  <span className="text-xs font-bold text-sky-400 px-2 py-0.5 bg-slate-800 rounded">
                    {avoidanceDistance} meters
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="600"
                  step="50"
                  value={avoidanceDistance}
                  onChange={(e) => onChangeAvoidanceDistance(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>100m (Tight)</span>
                  <span>250m (Default)</span>
                  <span>600m (Wide buffer)</span>
                </div>
              </div>

              {/* AI Voice Guidance Studio Card */}
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-950/80 text-purple-400 border border-purple-800 flex items-center justify-center">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        AI Voice Navigation
                        <span className="text-[9px] uppercase px-1.5 py-0.2 bg-purple-900/80 text-purple-200 border border-purple-700/50 rounded font-black">
                          ElevenLabs HD
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">Spoken turns & camera alerts</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !voiceEnabled;
                      setVoiceEnabled(next);
                      voiceNav.setEnabled(next);
                    }}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                      voiceEnabled ? 'bg-purple-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                        voiceEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {voiceEnabled && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    {/* Voice Engine Toggle */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        Speech Engine:
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setVoiceEngine('elevenlabs');
                            voiceNav.setVoiceEngine('elevenlabs');
                          }}
                          className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            voiceEngine === 'elevenlabs'
                              ? 'bg-purple-950 border-purple-500 text-purple-200 shadow'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          ElevenLabs Studio
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVoiceEngine('browser');
                            voiceNav.setVoiceEngine('browser');
                          }}
                          className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            voiceEngine === 'browser'
                              ? 'bg-sky-950 border-sky-500 text-sky-200 shadow'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Navigation className="w-3 h-3 text-sky-400" />
                          Offline Web Voice
                        </button>
                      </div>
                    </div>

                    {/* ElevenLabs Voice Selection */}
                    {voiceEngine === 'elevenlabs' ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 mb-1 block flex items-center justify-between">
                            <span>Choose ElevenLabs Voice:</span>
                            <span className="text-[10px] text-purple-400 font-bold">
                              {elevenVoices.length} Available
                            </span>
                          </label>
                          <select
                            value={selectedElevenVoiceId}
                            onChange={(e) => {
                              setSelectedElevenVoiceId(e.target.value);
                              voiceNav.setElevenLabsVoiceId(e.target.value);
                            }}
                            className="w-full py-2 px-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer truncate"
                          >
                            <optgroup label="🌟 Recommended Driving Copilots">
                              <option value="EXAVITQu4vr4xnSDxMaL">Sarah (🌟 Best Copilot - Confident & Clear Female)</option>
                              <option value="nPczCjzI2devNBz1zQrb">Brian (🎙️ Deep, Resonant & Comforting Male)</option>
                              <option value="cjVigY5qzO86Huf0OWal">Eric (🚗 Smooth, Trustworthy Male Copilot)</option>
                              <option value="XrExE9yKIg1WjnnlVkGX">Matilda (✨ Upbeat, Professional Female)</option>
                              <option value="onwK4e9ZLuTAKqWW03F9">Daniel (📻 Steady British Broadcaster)</option>
                              <option value="Xb7hH8MSUJpSbSDYk0k2">Alice (🎓 Clear British Female Educator)</option>
                            </optgroup>
                            <optgroup label="🤠 Celebrity & Character Voices">
                              <option value="pwaf5Qmnzg3zNJ6ijCvi">John Wayne (🤠 American Cowboy)</option>
                              <option value="LjNqOSdRGIUUmAcEINh7">Sir Michael Caine (🎬 British Icon)</option>
                              <option value="iWP0zWXsAkUmG0R4IMeO">Burt Reynolds (🏎️ Bandit / Storyteller)</option>
                              <option value="EnjFGpDDWiIZ8zyMUJkx">Official Emergency Broadcaster (🚨 Radar Alerts)</option>
                            </optgroup>
                            <optgroup label="All Account Voices">
                              {elevenVoices.map((v) => (
                                <option key={v.voice_id} value={v.voice_id}>
                                  {v.name}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>

                        <button
                          type="button"
                          disabled={isTestingElevenVoice}
                          onClick={async () => {
                            setIsTestingElevenVoice(true);
                            try {
                              await voiceNav.speakElevenLabs(
                                'In 500 feet, turn left onto South Mill Street. Camera-free route confirmed.',
                                selectedElevenVoiceId
                              );
                            } finally {
                              setIsTestingElevenVoice(false);
                            }
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 active:scale-[0.99] text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                        >
                          {isTestingElevenVoice ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                              Generating ElevenLabs HD Speech...
                            </>
                          ) : (
                            <>
                              <Mic className="w-3.5 h-3.5 text-purple-200" />
                              🔊 Test Selected Voice Sample
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      /* Browser Neural Voice Selection */
                      <div className="space-y-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
                            Installed Device Neural Voice:
                          </label>
                          <select
                            value={selectedVoice}
                            onChange={(e) => {
                              setSelectedVoice(e.target.value);
                              voiceNav.setSelectedVoiceId(e.target.value);
                            }}
                            className="w-full py-2 px-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer truncate"
                          >
                            <option value="default">Auto-Select Best HD Neural Voice</option>
                            {voices.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            voiceNav.speak(
                              'GhostNav voice navigation active. In 500 feet, turn left onto West Main Street.',
                              true
                            )
                          }
                          className="w-full py-2 px-3 rounded-xl bg-sky-950 hover:bg-sky-900 text-sky-200 font-semibold text-xs border border-sky-800/80 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <Mic className="w-3.5 h-3.5 text-sky-400" />
                          🔊 Test Local Web Voice
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 text-xs text-slate-300">
                <div className="font-bold text-white">Navigation Architecture</div>
                <p className="text-[11px] text-slate-400">
                  • <strong>Haversine Formula</strong> computes accurate great-circle proximity in meters.
                </p>
                <p className="text-[11px] text-slate-400">
                  • <strong>A* Pathfinding & OSRM</strong> dynamically avoids camera exclusion zones.
                </p>
                <p className="text-[11px] text-slate-400">
                  • <strong>Neural Speech Synthesizer</strong> provides zero-latency voice directions.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Quick Links (Intel Website + APK Download) */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
          <a
            href="/dossier.html"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-cyan-400 hover:text-white transition flex items-center justify-center gap-1.5 font-bold cursor-pointer shadow"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Intel Dossier</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>
          <a
            href="/GhostNav.apk"
            download="GhostNav.apk"
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white transition flex items-center justify-center gap-1.5 font-bold cursor-pointer shadow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Get APK</span>
          </a>
        </div>
      </aside>
  );
};
