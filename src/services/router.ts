import { ROAD_NODES, ROAD_EDGES, RoadNode } from '../data/roadNetwork';
import { LatLng, RouteResult, RouteStep, CameraEncounter } from '../types/navigation';
import { Camera } from '../types/camera';
import { cameraDb } from './cameraDatabase';
import {
  haversineDistance,
  haversineDistanceLatLng,
  pointToSegmentDistance,
  calculateBearing,
  calculateBearingLatLng,
} from './spatial';

interface GraphEdge {
  targetNodeId: string;
  distanceMeters: number;
  streetName: string;
  speedLimitMph: number;
  camerasNearby: { camera: Camera; minDistance: number }[];
}

export class OfflineRouter {
  private nodeMap: Map<string, RoadNode> = new Map();
  private adjacencyList: Map<string, GraphEdge[]> = new Map();
  private routeCache: Map<string, RouteResult> = new Map();

  constructor() {
    this.buildGraph();
  }

  private buildGraph() {
    ROAD_NODES.forEach((node) => {
      this.nodeMap.set(node.id, node);
      this.adjacencyList.set(node.id, []);
    });

    const cameras = cameraDb.getAll();

    ROAD_EDGES.forEach((edge) => {
      const u = this.nodeMap.get(edge.from);
      const v = this.nodeMap.get(edge.to);
      if (!u || !v) return;

      const dist = haversineDistance(u.latitude, u.longitude, v.latitude, v.longitude);

      // Find all cameras within 500m of this road segment
      const uLatLng: LatLng = { latitude: u.latitude, longitude: u.longitude };
      const vLatLng: LatLng = { latitude: v.latitude, longitude: v.longitude };

      const camerasNearSegment: { camera: Camera; minDistance: number }[] = [];
      cameras.forEach((cam) => {
        const camLatLng: LatLng = { latitude: cam.latitude, longitude: cam.longitude };
        const d = pointToSegmentDistance(camLatLng, uLatLng, vLatLng);
        if (d <= 500) {
          camerasNearSegment.push({ camera: cam, minDistance: d });
        }
      });

      // Bidirectional roads
      this.adjacencyList.get(edge.from)!.push({
        targetNodeId: edge.to,
        distanceMeters: dist,
        streetName: edge.streetName,
        speedLimitMph: edge.speedLimitMph,
        camerasNearby: camerasNearSegment,
      });

      this.adjacencyList.get(edge.to)!.push({
        targetNodeId: edge.from,
        distanceMeters: dist,
        streetName: edge.streetName,
        speedLimitMph: edge.speedLimitMph,
        camerasNearby: camerasNearSegment,
      });
    });
  }

  /**
   * Finds nearest road node to a coordinate
   */
  public findNearestNode(coords: LatLng): RoadNode {
    let nearestNode = ROAD_NODES[0];
    let minDistance = Infinity;

    for (const node of ROAD_NODES) {
      const dist = haversineDistance(
        coords.latitude,
        coords.longitude,
        node.latitude,
        node.longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestNode = node;
      }
    }
    return nearestNode;
  }

  /**
   * Plans a route from origin to destination using A* search.
   * When avoidCameras is true, penalizes edges within avoidanceDistanceMeters of any camera.
   */
  public planRoute(
    origin: LatLng,
    destination: LatLng,
    avoidCameras: boolean = false,
    avoidanceDistanceMeters: number = 250
  ): RouteResult {
    const startNode = this.findNearestNode(origin);
    const endNode = this.findNearestNode(destination);

    if (startNode.id === endNode.id) {
      return {
        path: [origin, destination],
        distanceMeters: haversineDistanceLatLng(origin, destination),
        estimatedDurationSeconds: 30,
        steps: [
          {
            instruction: 'You have reached your destination area.',
            distanceMeters: haversineDistanceLatLng(origin, destination),
            maneuver: 'arrive',
            from: origin,
            to: destination,
          },
        ],
        camerasEncountered: [],
        isAvoidanceRoute: avoidCameras,
      };
    }

    // A* Algorithm
    const openSet: Set<string> = new Set([startNode.id]);
    const cameFrom: Map<string, { prevNodeId: string; edge: GraphEdge }> = new Map();

    const gScore: Map<string, number> = new Map();
    const fScore: Map<string, number> = new Map();

    ROAD_NODES.forEach((n) => {
      gScore.set(n.id, Infinity);
      fScore.set(n.id, Infinity);
    });

    gScore.set(startNode.id, 0);
    fScore.set(
      startNode.id,
      haversineDistance(startNode.latitude, startNode.longitude, endNode.latitude, endNode.longitude)
    );

    while (openSet.size > 0) {
      // Find node in openSet with lowest fScore
      let currentId = '';
      let lowestF = Infinity;
      for (const id of openSet) {
        const score = fScore.get(id) ?? Infinity;
        if (score < lowestF) {
          lowestF = score;
          currentId = id;
        }
      }

      if (currentId === endNode.id) {
        return this.reconstructRoute(
          origin,
          destination,
          startNode,
          endNode,
          cameFrom,
          avoidCameras,
          avoidanceDistanceMeters
        );
      }

      openSet.delete(currentId);
      const neighbors = this.adjacencyList.get(currentId) || [];

      for (const edge of neighbors) {
        const neighborId = edge.targetNodeId;
        const neighborNode = this.nodeMap.get(neighborId)!;

        // Calculate traversal cost with camera penalty
        let edgeCost = edge.distanceMeters;

        if (avoidCameras) {
          // Check if any camera is within avoidance radius on this edge
          const breachedCameras = edge.camerasNearby.filter(
            (c) => c.minDistance < avoidanceDistanceMeters
          );

          if (breachedCameras.length > 0) {
            // Apply exponential proximity penalty
            let maxPenalty = 0;
            for (const b of breachedCameras) {
              const severity = (avoidanceDistanceMeters - b.minDistance) / avoidanceDistanceMeters;
              maxPenalty += 50000 + severity * 200000;
            }
            edgeCost += maxPenalty;
          }
        }

        const tentativeG = (gScore.get(currentId) ?? Infinity) + edgeCost;

        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, { prevNodeId: currentId, edge });
          gScore.set(neighborId, tentativeG);

          const h = haversineDistance(
            neighborNode.latitude,
            neighborNode.longitude,
            endNode.latitude,
            endNode.longitude
          );
          fScore.set(neighborId, tentativeG + h);
          openSet.add(neighborId);
        }
      }
    }

    // Fallback if strict graph fails: connect directly
    return {
      path: [origin, destination],
      distanceMeters: haversineDistanceLatLng(origin, destination),
      estimatedDurationSeconds: 120,
      steps: [
        {
          instruction: 'Proceed to destination.',
          distanceMeters: haversineDistanceLatLng(origin, destination),
          maneuver: 'straight',
          from: origin,
          to: destination,
        },
      ],
      camerasEncountered: [],
      isAvoidanceRoute: avoidCameras,
    };
  }

  private reconstructRoute(
    origin: LatLng,
    destination: LatLng,
    startNode: RoadNode,
    endNode: RoadNode,
    cameFrom: Map<string, { prevNodeId: string; edge: GraphEdge }>,
    isAvoidanceRoute: boolean,
    avoidanceDistanceMeters: number
  ): RouteResult {
    const nodePath: RoadNode[] = [];
    const edgePath: GraphEdge[] = [];

    let currId = endNode.id;
    nodePath.unshift(this.nodeMap.get(currId)!);

    while (cameFrom.has(currId)) {
      const { prevNodeId, edge } = cameFrom.get(currId)!;
      edgePath.unshift(edge);
      currId = prevNodeId;
      nodePath.unshift(this.nodeMap.get(currId)!);
    }

    // Build coordinate path
    const path: LatLng[] = [origin];
    if (haversineDistanceLatLng(origin, { latitude: startNode.latitude, longitude: startNode.longitude }) > 20) {
      path.push({ latitude: startNode.latitude, longitude: startNode.longitude });
    }

    for (let i = 1; i < nodePath.length; i++) {
      path.push({ latitude: nodePath[i].latitude, longitude: nodePath[i].longitude });
    }

    if (haversineDistanceLatLng({ latitude: endNode.latitude, longitude: endNode.longitude }, destination) > 20) {
      path.push(destination);
    }

    // Calculate total real road distance and travel time
    let totalDistanceMeters = 0;
    for (let i = 0; i < path.length - 1; i++) {
      totalDistanceMeters += haversineDistanceLatLng(path[i], path[i + 1]);
    }

    const estimatedDurationSeconds = Math.round((totalDistanceMeters / 13.4) * 1.2); // ~30mph average + intersections

    // Generate turn-by-turn steps
    const steps: RouteStep[] = [];
    if (path.length >= 2) {
      steps.push({
        instruction: `Depart towards ${edgePath[0]?.streetName || 'first corridor'}`,
        distanceMeters: Math.round(haversineDistanceLatLng(path[0], path[1])),
        streetName: edgePath[0]?.streetName,
        maneuver: 'depart',
        from: path[0],
        to: path[1],
      });

      for (let i = 1; i < path.length - 1; i++) {
        const pPrev = path[i - 1];
        const pCurr = path[i];
        const pNext = path[i + 1];

        const bearingIn = calculateBearing(pPrev.latitude, pPrev.longitude, pCurr.latitude, pCurr.longitude);
        const bearingOut = calculateBearing(pCurr.latitude, pCurr.longitude, pNext.latitude, pNext.longitude);

        let turnAngle = (bearingOut - bearingIn + 540) % 360 - 180;
        let maneuver: RouteStep['maneuver'] = 'straight';
        let turnWord = 'Continue straight on';

        if (turnAngle < -45) {
          maneuver = 'turn-left';
          turnWord = 'Turn left onto';
        } else if (turnAngle > 45) {
          maneuver = 'turn-right';
          turnWord = 'Turn right onto';
        } else if (turnAngle < -15) {
          maneuver = 'slight-left';
          turnWord = 'Bear slightly left onto';
        } else if (turnAngle > 15) {
          maneuver = 'slight-right';
          turnWord = 'Bear slightly right onto';
        }

        const street = edgePath[i]?.streetName || 'next street';
        const dist = Math.round(haversineDistanceLatLng(pCurr, pNext));

        steps.push({
          instruction: `${turnWord} ${street}`,
          distanceMeters: dist,
          streetName: street,
          maneuver,
          from: pCurr,
          to: pNext,
        });
      }

      steps.push({
        instruction: 'Arrive at your destination',
        distanceMeters: 0,
        maneuver: 'arrive',
        from: path[path.length - 1],
        to: path[path.length - 1],
      });
    }

    // Determine all cameras encountered along this path
    const allCameras = cameraDb.getAll();
    const camerasEncounteredMap = new Map<string, CameraEncounter>();

    for (let i = 0; i < path.length - 1; i++) {
      const segA = path[i];
      const segB = path[i + 1];

      for (const cam of allCameras) {
        const camPoint: LatLng = { latitude: cam.latitude, longitude: cam.longitude };
        const d = pointToSegmentDistance(camPoint, segA, segB);
        if (d <= avoidanceDistanceMeters) {
          const existing = camerasEncounteredMap.get(cam.id);
          if (!existing || d < existing.distanceMeters) {
            camerasEncounteredMap.set(cam.id, { camera: cam, distanceMeters: Math.round(d) });
          }
        }
      }
    }

    const camerasEncountered = Array.from(camerasEncounteredMap.values()).sort(
      (a, b) => a.distanceMeters - b.distanceMeters
    );

    return {
      path,
      distanceMeters: Math.round(totalDistanceMeters),
      estimatedDurationSeconds,
      steps,
      camerasEncountered,
      isAvoidanceRoute,
    };
  }

  /**
   * Plans a route following real road geometry using OpenStreetMap / OSRM.
   * Traces exact street curvatures, lanes, turns, and real speed limits.
   */
  public async planRouteAsync(
    origin: LatLng,
    destination: LatLng,
    avoidCameras: boolean = false,
    avoidanceDistanceMeters: number = 250
  ): Promise<RouteResult> {
    const cacheKey = `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}-${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}-${avoidCameras}-${avoidanceDistanceMeters}`;
    if (this.routeCache.has(cacheKey)) {
      return this.routeCache.get(cacheKey)!;
    }

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=true&alternatives=true`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`OSRM HTTP error: ${response.status}`);
      }
      const data = await response.json();
      if (!data.routes || data.routes.length === 0) {
        throw new Error('No OSRM routes found');
      }

      const allCameras = cameraDb.getAll();

      // Parse and evaluate each real-road candidate route
      const candidates: RouteResult[] = data.routes.map((r: any) => {
        const rawCoords: [number, number][] = r.geometry.coordinates;
        const path: LatLng[] = rawCoords.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        }));

        const camerasEncountered = this.findCamerasOnPath(path, allCameras, avoidanceDistanceMeters);

        // Convert OSRM steps
        const steps: RouteStep[] = [];
        if (r.legs && r.legs[0] && r.legs[0].steps) {
          r.legs[0].steps.forEach((s: any) => {
            const maneuverType = this.mapOsrmManeuver(s.maneuver);
            const streetName = s.name || (s.ref ? s.ref : 'road');
            let instruction = '';

            if (s.maneuver.type === 'depart') {
              instruction = `Head ${s.maneuver.modifier || 'forward'} on ${streetName}`;
            } else if (s.maneuver.type === 'arrive') {
              instruction = `Arrive at destination on ${streetName}`;
            } else if (s.maneuver.modifier) {
              const action = s.maneuver.modifier.includes('left')
                ? 'Turn left'
                : s.maneuver.modifier.includes('right')
                ? 'Turn right'
                : 'Continue';
              instruction = `${action} onto ${streetName}`;
            } else {
              instruction = `Follow ${streetName}`;
            }

            const stepLoc = s.maneuver.location;
            const fromCoord: LatLng = stepLoc
              ? { latitude: stepLoc[1], longitude: stepLoc[0] }
              : path[0];

            steps.push({
              instruction,
              distanceMeters: Math.round(s.distance),
              streetName: s.name || '',
              maneuver: maneuverType,
              from: fromCoord,
              to: fromCoord,
            });
          });
        }

        return {
          path,
          distanceMeters: Math.round(r.distance),
          estimatedDurationSeconds: Math.round(r.duration),
          steps: steps.length > 0 ? steps : this.generateStepsFromPath(path),
          camerasEncountered,
          isAvoidanceRoute: avoidCameras,
        };
      });

      let chosenRoute = candidates[0];

      if (avoidCameras) {
        // Find route with fewest cameras encountered
        candidates.sort((a, b) => {
          if (a.camerasEncountered.length !== b.camerasEncountered.length) {
            return a.camerasEncountered.length - b.camerasEncountered.length;
          }
          return a.distanceMeters - b.distanceMeters;
        });
        chosenRoute = candidates[0];

        // If direct routes still have cameras, try searching a detour waypoint
        if (chosenRoute.camerasEncountered.length > 0 && chosenRoute.path.length > 10) {
          const firstCam = chosenRoute.camerasEncountered[0].camera;
          const detourWaypoint: LatLng = {
            latitude: firstCam.latitude + (firstCam.facing_degrees < 180 ? -0.008 : 0.008),
            longitude: firstCam.longitude + (firstCam.facing_degrees < 90 || firstCam.facing_degrees > 270 ? 0.008 : -0.008),
          };
          try {
            const detourUrl = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${detourWaypoint.longitude},${detourWaypoint.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=true`;
            const detourResp = await fetch(detourUrl);
            if (detourResp.ok) {
              const detourData = await detourResp.json();
              if (detourData.routes && detourData.routes[0]) {
                const detourPath: LatLng[] = detourData.routes[0].geometry.coordinates.map(([lon, lat]: [number, number]) => ({
                  latitude: lat,
                  longitude: lon,
                }));
                const detourCameras = this.findCamerasOnPath(detourPath, allCameras, avoidanceDistanceMeters);
                if (detourCameras.length < chosenRoute.camerasEncountered.length) {
                  chosenRoute = {
                    path: detourPath,
                    distanceMeters: Math.round(detourData.routes[0].distance),
                    estimatedDurationSeconds: Math.round(detourData.routes[0].duration),
                    steps: this.generateStepsFromPath(detourPath),
                    camerasEncountered: detourCameras,
                    isAvoidanceRoute: true,
                  };
                }
              }
            }
          } catch (e) {
            // Ignore detour errors
          }
        }
      }

      this.routeCache.set(cacheKey, chosenRoute);
      return chosenRoute;
    } catch (err) {
      console.warn('Real-road routing fallback to internal graph:', err);
      return this.planRoute(origin, destination, avoidCameras, avoidanceDistanceMeters);
    }
  }

  private mapOsrmManeuver(m: any): RouteStep['maneuver'] {
    if (!m) return 'straight';
    const type = m.type || '';
    const mod = m.modifier || '';
    if (type === 'depart') return 'depart';
    if (type === 'arrive') return 'arrive';
    if (mod.includes('left')) {
      return mod.includes('slight') ? 'slight-left' : 'turn-left';
    }
    if (mod.includes('right')) {
      return mod.includes('slight') ? 'slight-right' : 'turn-right';
    }
    return 'straight';
  }

  private findCamerasOnPath(path: LatLng[], allCameras: Camera[], avoidanceDist: number): CameraEncounter[] {
    const map = new Map<string, CameraEncounter>();
    for (let i = 0; i < path.length - 1; i++) {
      const segA = path[i];
      const segB = path[i + 1];
      for (const cam of allCameras) {
        const camPoint: LatLng = { latitude: cam.latitude, longitude: cam.longitude };
        const d = pointToSegmentDistance(camPoint, segA, segB);
        if (d <= avoidanceDist) {
          const existing = map.get(cam.id);
          if (!existing || d < existing.distanceMeters) {
            map.set(cam.id, { camera: cam, distanceMeters: Math.round(d) });
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  private generateStepsFromPath(path: LatLng[]): RouteStep[] {
    const steps: RouteStep[] = [];
    if (path.length <= 1) return steps;

    steps.push({
      instruction: 'Proceed on road toward destination',
      distanceMeters: Math.round(haversineDistanceLatLng(path[0], path[path.length - 1])),
      maneuver: 'depart',
      from: path[0],
      to: path[1] || path[0],
    });

    for (let i = 1; i < path.length - 1; i += Math.max(1, Math.floor(path.length / 8))) {
      const pPrev = path[i - 1];
      const pCurr = path[i];
      const pNext = path[i + 1];

      const b1 = calculateBearingLatLng(pPrev, pCurr);
      const b2 = calculateBearingLatLng(pCurr, pNext);
      let turnAngle = b2 - b1;
      while (turnAngle > 180) turnAngle -= 360;
      while (turnAngle < -180) turnAngle += 360;

      let maneuver: RouteStep['maneuver'] = 'straight';
      let turnWord = 'Continue on road';

      if (turnAngle < -40) {
        maneuver = 'turn-left';
        turnWord = 'Turn left';
      } else if (turnAngle > 40) {
        maneuver = 'turn-right';
        turnWord = 'Turn right';
      } else if (turnAngle < -15) {
        maneuver = 'slight-left';
        turnWord = 'Bear slightly left';
      } else if (turnAngle > 15) {
        maneuver = 'slight-right';
        turnWord = 'Bear slightly right';
      }

      steps.push({
        instruction: turnWord,
        distanceMeters: Math.round(haversineDistanceLatLng(pCurr, pNext)),
        maneuver,
        from: pCurr,
        to: pNext,
      });
    }

    steps.push({
      instruction: 'Arrive at your destination',
      distanceMeters: 0,
      maneuver: 'arrive',
      from: path[path.length - 1],
      to: path[path.length - 1],
    });

    return steps;
  }
}

export const offlineRouter = new OfflineRouter();
