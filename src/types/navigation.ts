import { Camera } from './camera';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface GPSState {
  latitude: number;
  longitude: number;
  heading: number | null; // degrees from North (0-360)
  speed: number | null;   // meters per second
  accuracy: number;       // meters
  timestamp: number;
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  streetName?: string;
  maneuver?: 'depart' | 'straight' | 'turn-left' | 'turn-right' | 'slight-left' | 'slight-right' | 'arrive';
  from: LatLng;
  to: LatLng;
}

export interface CameraEncounter {
  camera: Camera;
  distanceMeters: number;
}

export interface RouteResult {
  path: LatLng[];
  distanceMeters: number;
  estimatedDurationSeconds: number;
  steps: RouteStep[];
  camerasEncountered: CameraEncounter[];
  isAvoidanceRoute: boolean;
}

export interface CameraAlert {
  camera: Camera;
  distanceMeters: number;
  bearingDegrees: number;
  isFacingTowardsUser: boolean;
  timeDetected: number;
}
