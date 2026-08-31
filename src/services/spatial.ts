import { LatLng } from '../types/navigation';
import { Camera } from '../types/camera';

const EARTH_RADIUS_METERS = 6371008.8;

/**
 * Computes great-circle distance between two geographic coordinates using Haversine formula
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export function haversineDistanceLatLng(p1: LatLng, p2: LatLng): number {
  return haversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
}

/**
 * Converts degrees to radians
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees
 */
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Computes initial compass bearing from point 1 to point 2 (0-360 degrees)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

export function calculateBearingLatLng(p1: LatLng, p2: LatLng): number {
  return calculateBearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
}

/**
 * Computes the minimum distance in meters from a point P to a line segment AB.
 */
export function pointToSegmentDistance(
  p: LatLng,
  a: LatLng,
  b: LatLng
): number {
  const l2 =
    Math.pow(b.latitude - a.latitude, 2) +
    Math.pow(b.longitude - a.longitude, 2);

  if (l2 === 0) {
    return haversineDistanceLatLng(p, a);
  }

  // Consider the line extending the segment, parameterized as a + t (b - a).
  // We find projection of point p onto the line.
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.latitude - a.latitude) * (b.latitude - a.latitude) +
        (p.longitude - a.longitude) * (b.longitude - a.longitude)) /
        l2
    )
  );

  const projection: LatLng = {
    latitude: a.latitude + t * (b.latitude - a.latitude),
    longitude: a.longitude + t * (b.longitude - a.longitude),
  };

  return haversineDistanceLatLng(p, projection);
}

/**
 * Checks if a given camera's facing orientation is pointing towards an approaching user
 */
export function isCameraFacingApproachingUser(
  camera: Camera,
  userLocation: LatLng,
_userHeading?: number | null
): boolean {
  // Bearing from camera to user
  const bearingFromCameraToUser = calculateBearing(
    camera.latitude,
    camera.longitude,
    userLocation.latitude,
    userLocation.longitude
  );

  // Angular difference between camera lens facing angle and user direction
  const diffFacing = Math.abs((camera.facing_degrees - bearingFromCameraToUser + 540) % 360 - 180);

  // If user is within +- 60 degrees of camera lens cone
  return diffFacing <= 60;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatSpeed(mps: number | null): string {
  if (mps === null || isNaN(mps)) return '0 mph';
  const mph = mps * 2.23694;
  return `${Math.round(mph)} mph`;
}

export function formatBearing(degrees: number | null): string {
  if (degrees === null || isNaN(degrees)) return 'N';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degrees %= 360) < 0 ? degrees + 360 : degrees) / 45) % 8;
  return `${Math.round(degrees)}° ${directions[index]}`;
}
