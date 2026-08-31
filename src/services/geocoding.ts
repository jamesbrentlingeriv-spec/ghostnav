import { PRESET_DESTINATIONS } from '../data/roadNetwork';

export interface GeocodingResult {
  id: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  category?: string;
}

export const LOCAL_BUSINESS_REGISTRY: {
  name: string;
  aliases: string[];
  address: string;
  lat: number;
  lon: number;
  category: string;
}[] = [
  {
    name: "Pal Optical & Eye Care",
    aliases: ["pal optical", "pal", "pal eye", "pal optician", "1555 east new circle", "1555 e new circle", "pal optical lexington"],
    address: "1555 E New Circle Rd #146, Lexington, KY 40509",
    lat: 38.0185,
    lon: -84.4544,
    category: "Optician & Eye Care"
  },
  {
    name: "Trader Joe's",
    aliases: ["trader joes", "trader joe", "trader"],
    address: "2326 Nicholasville Rd, Lexington, KY 40503",
    lat: 38.0068,
    lon: -84.5242,
    category: "Grocery"
  },
  {
    name: "Costco Wholesale",
    aliases: ["costco", "costco wholesale"],
    address: "540 E New Circle Rd, Lexington, KY 40505",
    lat: 38.0620,
    lon: -84.4680,
    category: "Wholesale & Department Store"
  },
  {
    name: "Fayette Mall",
    aliases: ["fayette mall", "fayette", "mall"],
    address: "3401 Nicholasville Rd, Lexington, KY 40503",
    lat: 37.9920,
    lon: -84.5290,
    category: "Shopping Mall"
  },
  {
    name: "The Summit at Fritz Farm",
    aliases: ["the summit", "fritz farm", "summit"],
    address: "120 Summit At Fritz Farm, Lexington, KY 40517",
    lat: 37.9820,
    lon: -84.5260,
    category: "Shopping Center"
  },
  {
    name: "Hamburg Pavilion Shopping Hub",
    aliases: ["hamburg", "hamburg pavilion", "hamburg place"],
    address: "Sir Barton Way, Lexington, KY 40509",
    lat: 38.0315,
    lon: -84.4230,
    category: "Shopping Hub"
  },
  {
    name: "UK Chandler Hospital",
    aliases: ["uk hospital", "chandler hospital", "uk medical", "chandler"],
    address: "1000 S Limestone, Lexington, KY 40536",
    lat: 38.0305,
    lon: -84.5100,
    category: "Medical Center"
  },
  {
    name: "Baptist Health Lexington",
    aliases: ["baptist health", "baptist hospital", "baptist"],
    address: "1740 Nicholasville Rd, Lexington, KY 40503",
    lat: 38.0165,
    lon: -84.5185,
    category: "Hospital"
  },
  {
    name: "Saint Joseph Hospital",
    aliases: ["st joseph", "saint joseph", "st joe"],
    address: "1 St Joseph Dr, Lexington, KY 40504",
    lat: 38.0280,
    lon: -84.5320,
    category: "Hospital"
  },
  {
    name: "Kroger (Euclid Ave / Chevy Chase)",
    aliases: ["kroger euclid", "chevy chase kroger", "kroger"],
    address: "704 Euclid Ave, Lexington, KY 40502",
    lat: 38.0325,
    lon: -84.4930,
    category: "Supermarket"
  },
  {
    name: "Target (Reynolds Rd)",
    aliases: ["target reynolds", "fayette target", "target"],
    address: "131 W Reynolds Rd, Lexington, KY 40503",
    lat: 37.9880,
    lon: -84.5340,
    category: "Department Store"
  },
  {
    name: "Target (Hamburg)",
    aliases: ["target hamburg", "hamburg target"],
    address: "1940 Pavillion Way, Lexington, KY 40509",
    lat: 38.0295,
    lon: -84.4260,
    category: "Department Store"
  }
];

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
    const lowerQ = cleanQuery.toLowerCase();

    // 1. Check curated Local Business & POI Registry
    for (const biz of LOCAL_BUSINESS_REGISTRY) {
      const matchName = biz.name.toLowerCase().includes(lowerQ);
      const matchAlias = biz.aliases.some((alias) => lowerQ.includes(alias) || alias.includes(lowerQ));
      const matchAddr = biz.address.toLowerCase().includes(lowerQ);

      if (matchName || matchAlias || matchAddr) {
        const id = 'biz-' + biz.name;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          results.push({
            id,
            name: biz.name,
            formattedAddress: biz.address,
            latitude: biz.lat,
            longitude: biz.lon,
            category: biz.category,
          });
        }
      }
    }

    // 2. Check preset locations
    for (const preset of PRESET_DESTINATIONS) {
      if (preset.name.toLowerCase().includes(lowerQ)) {
        const id = 'preset-' + preset.name;
        if (!seenIds.has(id)) {
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
