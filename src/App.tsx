import React, { useEffect, useState, useMemo } from 'react';
import { Camera, CameraKind } from './types/camera';
import { GPSState, LatLng, RouteResult, CameraAlert } from './types/navigation';
import { cameraDb } from './services/cameraDatabase';
import { offlineRouter } from './services/router';
import { audioAlert } from './services/audioAlert';
import { voiceNav } from './services/voiceNavigation';
import { gpsService } from './services/geolocation';
import { haversineDistance, isCameraFacingApproachingUser } from './services/spatial';
import { MapComponent } from './components/MapComponent';
import { NavigationHUD } from './components/NavigationHUD';
import { ControlPanel } from './components/ControlPanel';
import { CameraDetailsModal } from './components/CameraDetailsModal';

export const App: React.FC = () => {
  // GPS State
  const [gpsState, setGpsState] = useState<GPSState | null>(null);
  const [followUser, setFollowUser] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [camerasVersion, setCamerasVersion] = useState<number>(0);

  // Settings & Toggles
  const [avoidCameras, setAvoidCameras] = useState<boolean>(true);
  const [avoidanceDistance, setAvoidanceDistance] = useState<number>(250);
  const [selectedKinds, setSelectedKinds] = useState<CameraKind[]>([
    'flock',
    'speed',
    'red_light',
    'anpr',
  ]);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Camera & Alert State
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [activeAlert, setActiveAlert] = useState<CameraAlert | null>(null);

  // Navigation & Route State
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [standardRoute, setStandardRoute] = useState<RouteResult | null>(null);
  const [avoidanceRoute, setAvoidanceRoute] = useState<RouteResult | null>(null);

  // Start Live GPS on Mount & Auto-fetch nearby cameras
  useEffect(() => {
    gpsService.startTracking();
    const unsubscribe = gpsService.subscribe((state) => {
      setGpsState(state);
    });

    return () => {
      unsubscribe();
      gpsService.stopTracking();
    };
  }, []);

  // Filtered cameras based on user's active kind filters
  const filteredCameras = useMemo(() => {
    return cameraDb.getByKinds(selectedKinds);
  }, [selectedKinds, camerasVersion]);

  const cameraStats = useMemo(() => {
    return cameraDb.getStats();
  }, [camerasVersion]);

  // Real-time Proximity & Alert Engine using Haversine Formula
  useEffect(() => {
    if (!gpsState) return;

    const userLatLng: LatLng = {
      latitude: gpsState.latitude,
      longitude: gpsState.longitude,
    };

    // Find nearest camera within avoidance distance
    let nearestCam: Camera | null = null;
    let minDistance = Infinity;

    for (const camera of filteredCameras) {
      const dist = haversineDistance(
        userLatLng.latitude,
        userLatLng.longitude,
        camera.latitude,
        camera.longitude
      );

      if (dist <= avoidanceDistance && dist < minDistance) {
        minDistance = dist;
        nearestCam = camera;
      }
    }

    if (nearestCam) {
      const isFacing = isCameraFacingApproachingUser(
        nearestCam,
        userLatLng,
        gpsState.heading
      );

      const alert: CameraAlert = {
        camera: nearestCam,
        distanceMeters: Math.round(minDistance),
        bearingDegrees: nearestCam.facing_degrees,
        isFacingTowardsUser: isFacing,
        timeDetected: Date.now(),
      };

      setActiveAlert(alert);
      audioAlert.triggerCameraAlert(nearestCam.kind, minDistance);
    } else {
      setActiveAlert(null);
    }
  }, [gpsState, filteredCameras, avoidanceDistance]);

  const [customOrigin, setCustomOrigin] = useState<LatLng | null>(null);

  // Recalculate Routes when Origin, Destination, or Avoidance changes
  useEffect(() => {
    let isCancelled = false;

    if (!destination) {
      setStandardRoute(null);
      setAvoidanceRoute(null);
      return;
    }

    const origin: LatLng = customOrigin || (gpsState ? {
      latitude: gpsState.latitude,
      longitude: gpsState.longitude,
    } : {
      latitude: 38.0450,
      longitude: -84.4975,
    });

    const calculateRealRoadRoutes = async () => {
      // 1. Instant fallback route
      const fastStd = offlineRouter.planRoute(origin, destination, false, avoidanceDistance);
      const fastAvoid = offlineRouter.planRoute(origin, destination, true, avoidanceDistance);
      if (!isCancelled) {
        setStandardRoute(fastStd);
        setAvoidanceRoute(fastAvoid);
      }

      // 2. Exact physical road network geometry following every street curvature & turn
      try {
        const [roadStd, roadAvoid] = await Promise.all([
          offlineRouter.planRouteAsync(origin, destination, false, avoidanceDistance),
          offlineRouter.planRouteAsync(origin, destination, true, avoidanceDistance),
        ]);

        if (!isCancelled && roadStd && roadAvoid) {
          setStandardRoute(roadStd);
          setAvoidanceRoute(roadAvoid);
        }
      } catch (err) {
        console.warn('Real-road OSRM routing fallback:', err);
      }
    };

    calculateRealRoadRoutes();

    return () => {
      isCancelled = true;
    };
  }, [destination, customOrigin, avoidanceDistance]);

  // Selected Active Route based on Avoid Cameras toggle
  const activeRoute = avoidCameras ? avoidanceRoute : standardRoute;
  const alternativeRoute = avoidCameras ? standardRoute : avoidanceRoute;

  // Spoken Turn-by-Turn Guidance on Active Route
  useEffect(() => {
    if (!activeRoute || activeRoute.steps.length === 0) return;
    const firstStep = activeRoute.steps[0];
    if (firstStep && firstStep.instruction) {
      voiceNav.speakTurn(firstStep.instruction, firstStep.distanceMeters);
    }
  }, [activeRoute?.steps[0]?.instruction]);

  // When a destination is routed, automatically start the driving navigation simulation
  useEffect(() => {
    if (activeRoute && activeRoute.path.length > 2 && destination) {
      setIsSimulating(true);
      setFollowUser(true);
      gpsService.startRouteSimulation(activeRoute.path, 35);
    }
  }, [destination, customOrigin]);

  // Handlers
  const handleSelectDestination = (dest: LatLng) => {
    setCustomOrigin(null);
    setDestination(dest);
    setIsMenuOpen(false); // Switch to full Google Maps navigation view
    setFollowUser(true);
  };

  const handlePlanRouteFromTo = (origin: LatLng | null, dest: LatLng) => {
    setCustomOrigin(origin);
    setDestination(dest);
    setIsMenuOpen(false); // Switch to full Google Maps navigation view
    setFollowUser(true);
  };

  const handleClearRoute = () => {
    setCustomOrigin(null);
    setDestination(null);
    setStandardRoute(null);
    setAvoidanceRoute(null);
    gpsService.stopSimulation();
    setIsSimulating(false);
    setFollowUser(true);
  };

  const handleToggleKind = (kind: CameraKind) => {
    if (selectedKinds.includes(kind)) {
      if (selectedKinds.length > 1) {
        setSelectedKinds(selectedKinds.filter((k) => k !== kind));
      }
    } else {
      setSelectedKinds([...selectedKinds, kind]);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioAlert.setMuted(nextMuted);
  };

  const handleStartSimulation = () => {
    if (!activeRoute || activeRoute.path.length < 2) return;
    setIsSimulating(true);
    setFollowUser(true);
    gpsService.startRouteSimulation(activeRoute.path, 30);
  };

  const handleStopSimulation = () => {
    gpsService.stopSimulation();
    setIsSimulating(false);
    gpsService.startTracking();
  };

  const handleScanNearbyCameras = async () => {
    if (!gpsState || isScanning) return;
    setIsScanning(true);
    try {
      const newCams = await cameraDb.fetchNearbyOverpassCameras(
        gpsState.latitude,
        gpsState.longitude,
        10
      );
      setCamerasVersion((v) => v + 1);
      if (newCams.length === 0) {
        alert('No Overpass/DeFlock cameras found in 10km radius. Showing Lexington, KY grid.');
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleLocateMe = async () => {
    setFollowUser(true);
    const realState = await gpsService.requestRealDevicePosition();
    if (realState) {
      setGpsState(realState);
    }
  };

  const handleJumpToDemoArea = () => {
    const lexingtonCenter: GPSState = {
      latitude: 38.0450,
      longitude: -84.4975,
      heading: 0,
      speed: 0,
      accuracy: 5,
      timestamp: Date.now(),
    };
    setGpsState(lexingtonCenter);
    setFollowUser(true);
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-slate-950">
      {/* Left Navigation Sidebar / Menu (Always visible & docked) */}
      <ControlPanel
        gpsState={gpsState}
        destination={destination}
        avoidCameras={avoidCameras}
        onToggleAvoidCameras={setAvoidCameras}
        avoidanceDistance={avoidanceDistance}
        onChangeAvoidanceDistance={setAvoidanceDistance}
        selectedKinds={selectedKinds}
        onToggleKind={handleToggleKind}
        onSelectDestination={handleSelectDestination}
        onPlanRouteFromTo={handlePlanRouteFromTo}
        onClearRoute={handleClearRoute}
        activeRoute={activeRoute}
        standardRoute={standardRoute}
        cameraStats={cameraStats}
        onStartSimulation={handleStartSimulation}
        onStopSimulation={handleStopSimulation}
        isSimulating={isSimulating}
        isOpen={isMenuOpen}
        onToggleOpen={() => setIsMenuOpen(!isMenuOpen)}
        onScanNearbyCameras={handleScanNearbyCameras}
        isScanning={isScanning}
        onJumpToDemoArea={handleJumpToDemoArea}
      />

      {/* Main Map & Navigation Viewport */}
      <main className="relative flex-1 h-full overflow-hidden bg-slate-950">
        {/* Map Layer */}
        <MapComponent
          gpsState={gpsState}
          cameras={filteredCameras}
          selectedCamera={selectedCamera}
          onSelectCamera={setSelectedCamera}
          activeRoute={activeRoute}
          alternativeRoute={alternativeRoute}
          onMapClick={(coords) => handleSelectDestination(coords)}
          followUser={followUser}
        />

        {/* Top Turn-by-Turn & Alert HUD */}
        <NavigationHUD
          gpsState={gpsState}
          activeRoute={activeRoute}
          activeAlert={activeAlert}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          followUser={followUser}
          onToggleFollow={() => setFollowUser(!followUser)}
          isMenuOpen={isMenuOpen}
          onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
          onLocateMe={handleLocateMe}
          onClearRoute={handleClearRoute}
          onSelectDestination={handleSelectDestination}
        />

        {/* Camera Inspector Modal */}
        <CameraDetailsModal
          camera={selectedCamera}
          gpsState={gpsState}
          onClose={() => setSelectedCamera(null)}
        />
      </main>
    </div>
  );
};
