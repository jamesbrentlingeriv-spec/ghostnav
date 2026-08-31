import { GPSState, LatLng } from '../types/navigation';
import { calculateBearing, haversineDistance } from './spatial';

export type GPSCallback = (state: GPSState) => void;

class GeolocationService {
  private watchId: number | null = null;
  private listeners: Set<GPSCallback> = new Set();
  private lastState: GPSState | null = null;
  private isSimulating: boolean = false;
  private simInterval: number | null = null;

  constructor() {
    this.lastState = {
      latitude: 38.0406,
      longitude: -84.5037,
      heading: 0,
      speed: 0,
      accuracy: 5,
      timestamp: Date.now(),
    };
  }

  public subscribe(cb: GPSCallback): () => void {
    this.listeners.add(cb);
    if (this.lastState) {
      cb(this.lastState);
    }
    return () => this.listeners.delete(cb);
  }

  private notify(state: GPSState) {
    this.lastState = state;
    this.listeners.forEach((cb) => cb(state));
  }

  public startTracking() {
    if (this.isSimulating) {
      this.stopSimulation();
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.warn('Geolocation is not supported in this environment.');
      return;
    }

    // Fast initial location query
    this.requestRealDevicePosition();

    if (this.watchId !== null) return;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.processPosition(position);
      },
      (error) => {
        console.warn('GPS continuous stream error:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 500,
      }
    );
  }

  public requestRealDevicePosition(): Promise<GPSState | null> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.processPosition(position);
          resolve(this.lastState);
        },
        (err) => {
          console.warn('Manual GPS fix error:', err.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }

  private processPosition(position: GeolocationPosition) {
    const { latitude, longitude, heading, speed, accuracy } = position.coords;
    let calculatedHeading = heading;
    let calculatedSpeed = speed;

    if (this.lastState) {
      const dist = haversineDistance(
        this.lastState.latitude,
        this.lastState.longitude,
        latitude,
        longitude
      );
      const timeDiffSec = (position.timestamp - this.lastState.timestamp) / 1000;

      if (calculatedHeading === null && dist > 2) {
        calculatedHeading = calculateBearing(
          this.lastState.latitude,
          this.lastState.longitude,
          latitude,
          longitude
        );
      } else if (calculatedHeading === null) {
        calculatedHeading = this.lastState.heading;
      }

      if (calculatedSpeed === null && timeDiffSec > 0) {
        calculatedSpeed = dist / timeDiffSec;
      }
    }

    const newState: GPSState = {
      latitude,
      longitude,
      heading: calculatedHeading,
      speed: calculatedSpeed,
      accuracy: accuracy || 5,
      timestamp: position.timestamp,
    };

    this.notify(newState);
  }

  public stopTracking() {
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  public startRouteSimulation(routePath: LatLng[], speedMph: number = 25) {
    this.stopTracking();
    this.stopSimulation();

    if (routePath.length < 2) return;

    this.isSimulating = true;
    let currentIdx = 0;
    let progress = 0;

    const speedMps = speedMph * 0.44704;
    const intervalMs = 150;

    this.simInterval = window.setInterval(() => {
      if (currentIdx >= routePath.length - 1) {
        this.stopSimulation();
        return;
      }

      const p1 = routePath[currentIdx];
      const p2 = routePath[currentIdx + 1];
      const segmentDist = haversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);

      const stepDist = speedMps * (intervalMs / 1000);
      const stepFraction = segmentDist > 0 ? stepDist / segmentDist : 1;

      progress += stepFraction;

      if (progress >= 1) {
        currentIdx++;
        progress = 0;
        if (currentIdx >= routePath.length - 1) {
          const finalPoint = routePath[routePath.length - 1];
          this.notify({
            latitude: finalPoint.latitude,
            longitude: finalPoint.longitude,
            heading: this.lastState?.heading ?? 0,
            speed: 0,
            accuracy: 3,
            timestamp: Date.now(),
          });
          this.stopSimulation();
          return;
        }
      }

      const curP1 = routePath[currentIdx];
      const curP2 = routePath[currentIdx + 1];
      const curLat = curP1.latitude + (curP2.latitude - curP1.latitude) * progress;
      const curLng = curP1.longitude + (curP2.longitude - curP1.longitude) * progress;
      const heading = calculateBearing(curP1.latitude, curP1.longitude, curP2.latitude, curP2.longitude);

      this.notify({
        latitude: curLat,
        longitude: curLng,
        heading,
        speed: speedMps,
        accuracy: 3,
        timestamp: Date.now(),
      });
    }, intervalMs);
  }

  public stopSimulation() {
    if (this.simInterval !== null) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
    this.isSimulating = false;
  }

  public getCurrentState(): GPSState | null {
    return this.lastState;
  }
}

export const gpsService = new GeolocationService();
