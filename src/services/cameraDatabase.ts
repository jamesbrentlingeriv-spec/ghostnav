import rawCameras from '../data/cameras.json';
import { Camera, CameraKind } from '../types/camera';
import { LatLng } from '../types/navigation';
import { haversineDistance } from './spatial';

class CameraDatabase {
  private cameras: Camera[] = [];

  constructor() {
    this.cameras = rawCameras as Camera[];
  }

  /**
   * Returns all cameras stored in the offline dataset
   */
  public getAll(): Camera[] {
    return [...this.cameras];
  }

  /**
   * Finds a camera by its unique identifier
   */
  public getById(id: string): Camera | undefined {
    return this.cameras.find((c) => c.id === id);
  }

  /**
   * Returns all cameras filtered by specific kinds
   */
  public getByKinds(kinds: CameraKind[]): Camera[] {
    const kindSet = new Set(kinds);
    return this.cameras.filter((c) => kindSet.has(c.kind));
  }

  /**
   * Finds all cameras within a given radial distance (in meters) of a point
   */
  public findWithinRadius(
    point: LatLng,
    radiusMeters: number,
    filterKinds?: CameraKind[]
  ): { camera: Camera; distanceMeters: number }[] {
    const results: { camera: Camera; distanceMeters: number }[] = [];
    const kindSet = filterKinds ? new Set(filterKinds) : null;

    for (const camera of this.cameras) {
      if (kindSet && !kindSet.has(camera.kind)) {
        continue;
      }
      const distance = haversineDistance(
        point.latitude,
        point.longitude,
        camera.latitude,
        camera.longitude
      );

      if (distance <= radiusMeters) {
        results.push({ camera, distanceMeters: distance });
      }
    }

    return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  /**
   * Appends newly discovered cameras to database
   */
  public appendCameras(newCameras: Camera[]) {
    const existingIds = new Set(this.cameras.map((c) => c.id));
    for (const cam of newCameras) {
      if (!existingIds.has(cam.id)) {
        this.cameras.push(cam);
        existingIds.add(cam.id);
      }
    }
  }

  /**
   * Fetches real cameras from Overpass API around given coordinates
   */
  public async fetchNearbyOverpassCameras(
    lat: number,
    lon: number,
    radiusKm: number = 8
  ): Promise<Camera[]> {
    const degOffset = radiusKm / 111;
    const minLat = (lat - degOffset).toFixed(4);
    const minLon = (lon - degOffset).toFixed(4);
    const maxLat = (lat + degOffset).toFixed(4);
    const maxLon = (lon + degOffset).toFixed(4);
    const bbox = `${minLat},${minLon},${maxLat},${maxLon}`;

    const query = `
      [out:json][timeout:25];
      (
        node["man_made"="surveillance"](${bbox});
        node["surveillance:type"="ALPR"](${bbox});
        node["highway"="speed_camera"](${bbox});
        node["enforcement"](${bbox});
      );
      out body;
    `;

    const servers = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];

    for (const server of servers) {
      try {
        const resp = await fetch(server, {
          method: 'POST',
          body: query,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        if (!resp.ok) continue;

        const data = await resp.json();
        const parsedCameras: Camera[] = [];

        for (const elem of data.elements || []) {
          const tags = elem.tags || {};
          let kind: CameraKind = 'flock';
          const operator = (tags.operator || '').toLowerCase();
          const survType = (tags['surveillance:type'] || '').toLowerCase();
          const highway = (tags.highway || '').toLowerCase();
          const enforcement = (tags.enforcement || '').toLowerCase();

          if (operator.includes('flock') || survType === 'alpr') {
            kind = 'flock';
          } else if (enforcement === 'speed' || highway === 'speed_camera') {
            kind = 'speed';
          } else if (enforcement.includes('traffic') || survType.includes('red_light')) {
            kind = 'red_light';
          } else if (survType.includes('anpr') || operator.includes('toll')) {
            kind = 'anpr';
          }

          let facing = 0;
          const dirRaw = tags['camera:direction'] || tags.direction || tags['camera:heading'];
          if (dirRaw) {
            const num = parseInt(dirRaw, 10);
            if (!isNaN(num)) facing = num % 360;
          }

          parsedCameras.push({
            id: `OSM-${elem.id}`,
            latitude: elem.lat,
            longitude: elem.lon,
            facing_degrees: facing,
            kind,
          });
        }

        if (parsedCameras.length > 0) {
          this.appendCameras(parsedCameras);
        }
        return parsedCameras;
      } catch (e) {
        console.warn(`Overpass server ${server} failed:`, e);
      }
    }
    return [];
  }

  /**
   * Returns camera counts grouped by kind
   */
  public getStats(): Record<CameraKind, number> {
    const stats: Record<CameraKind, number> = {
      flock: 0,
      speed: 0,
      red_light: 0,
      anpr: 0,
    };
    for (const camera of this.cameras) {
      if (stats[camera.kind] !== undefined) {
        stats[camera.kind]++;
      }
    }
    return stats;
  }
}

export const cameraDb = new CameraDatabase();
