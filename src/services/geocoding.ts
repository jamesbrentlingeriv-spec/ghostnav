import { PRESET_DESTINATIONS } from '../data/roadNetwork';

export interface GeocodingResult {
  id: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  category?: string;
}

class GeocodingService {
  private cache: Map<string, GeocodingResult[]> = new Map();

  public async searchPlaces(
    query: string,
    nearLat: number = 38.0406,
    nearLon: number = -84.5037
  ): Promise<GeocodingResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) return [];

    const cacheKey = cleanQuery.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const results: GeocodingResult[] = [];
    const seenIds = new Set<string>();

    // 1. Check preset locations
    for (const preset of PRESET_DESTINATIONS) {
      if (preset.name.toLowerCase().includes(cleanQuery.toLowerCase())) {
        const id = 'preset-' + preset.name;
        seenIds.add(id);
        results.push({
          id,
          name: preset.name,
          formattedAddress: preset.name + ', Lexington, KY',
          latitude: preset.coords.latitude,
          longitude: preset.coords.longitude,
          category: 'Landmark',
        });
      }
    }

    // 2. Try Photon geocoding
    try {
      const photonUrl = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(cleanQuery) + '&limit=6&lat=' + nearLat + '&lon=' + nearLon;
      const response = await fetch(photonUrl);
      if (response.ok) {
        const data = await response.json();
        for (const feature of data.features || []) {
          const props = feature.properties || {};
          const coords = feature.geometry ? feature.geometry.coordinates : null;
          if (!coords || coords.length < 2) continue;

          const lon = coords[0];
          const lat = coords[1];
          const name = props.name || props.street || cleanQuery;
          const street = props.street ? ((props.housenumber ? props.housenumber + ' ' : '') + props.street) : '';
          const city = props.city || props.town || props.village || 'Lexington';
          const state = props.state || 'KY';
          const addressParts = [street, city, state].filter(Boolean);
          const formattedAddress = addressParts.length > 0 ? (name + ', ' + addressParts.join(', ')) : name;

          const id = 'photon-' + lat.toFixed(5) + '-' + lon.toFixed(5);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            results.push({
              id,
              name,
              formattedAddress,
              latitude: lat,
              longitude: lon,
              category: props.osm_value || props.type || 'Place',
            });
          }
        }
      }
    } catch (err) {
      console.warn('Photon geocoding error:', err);
    }

    // 3. Fallback to Nominatim for exact street addresses
    if (results.length < 3) {
      try {
        const searchTerms = (cleanQuery.includes('KY') || cleanQuery.includes('Lexington')) ? cleanQuery : (cleanQuery + ', Lexington, KY');
        const nominatimUrl = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(searchTerms) + '&limit=5&countrycodes=us';
        const response = await fetch(nominatimUrl, {
          headers: { 'User-Agent': 'GhostNav-App/1.0' },
        });
        if (response.ok) {
          const data = await response.json();
          for (const item of data) {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            const id = 'nom-' + (item.place_id || (lat.toFixed(5) + '-' + lon.toFixed(5)));
            if (!seenIds.has(id)) {
              seenIds.add(id);
              const displayName = item.display_name || '';
              const shortName = displayName.split(',')[0];
              results.push({
                id,
                name: shortName,
                formattedAddress: displayName,
                latitude: lat,
                longitude: lon,
                category: item.type || 'Address',
              });
            }
          }
        }
      } catch (err) {
        console.warn('Nominatim geocoding error:', err);
      }
    }

    this.cache.set(cacheKey, results);
    return results;
  }

  /**
   * Resolves any user query (search text, address, or raw lat,lon) directly to coordinates
   */
  public async resolveQueryToCoords(
    query: string,
    nearLat: number = 38.0406,
    nearLon: number = -84.5037
  ): Promise<{ name: string; formattedAddress: string; coords: { latitude: number; longitude: number } } | null> {
    const clean = query.trim();
    if (!clean) return null;

    // Check if raw coordinates: "38.045, -84.502"
    const coordMatch = clean.match(/^([-+]?\d+(\.\d+)?)[,\s]+([-+]?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[3]);
      if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return {
          name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          formattedAddress: `Coordinates: ${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          coords: { latitude: lat, longitude: lon },
        };
      }
    }

    const results = await this.searchPlaces(clean, nearLat, nearLon);
    if (results.length > 0) {
      const first = results[0];
      return {
        name: first.name,
        formattedAddress: first.formattedAddress,
        coords: { latitude: first.latitude, longitude: first.longitude },
      };
    }

    return null;
  }

  /**
   * Reverse geocode a latitude & longitude to a human-readable street name
   */
  public async reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'GhostNav-App/1.0' } });
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          const parts = data.display_name.split(',');
          return parts.slice(0, 3).join(',').trim();
        }
      }
    } catch (e) {
      // ignore
    }
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}

export const geocodingService = new GeocodingService();
