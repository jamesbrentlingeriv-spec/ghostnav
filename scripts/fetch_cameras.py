import urllib.request
import urllib.parse
import json
import re
import os
import sys
import time

OVERPASS_SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
]

DIRECTION_MAP = {
    'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
    'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
    'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
    'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
}

def parse_direction(val):
    if not val:
        return 0
    val_str = str(val).strip().upper()
    if val_str in DIRECTION_MAP:
        return int(DIRECTION_MAP[val_str])
    
    match = re.search(r'(\d+)', val_str)
    if match:
        return int(match.group(1)) % 360
    return 0

def classify_camera(tags):
    operator = tags.get('operator', '').lower()
    surv_type = tags.get('surveillance:type', '').lower()
    cam_type = tags.get('camera:type', '').lower()
    highway = tags.get('highway', '').lower()
    enforcement = tags.get('enforcement', '').lower()
    name = tags.get('name', '').lower()

    if 'flock' in operator or 'flock' in name or surv_type == 'alpr' or cam_type == 'alpr':
        return 'flock'
    if enforcement == 'speed' or highway == 'speed_camera' or 'speed' in name or 'radar' in name:
        return 'speed'
    if enforcement in ['traffic_signals', 'red_light'] or 'red_light' in surv_type or 'red light' in name:
        return 'red_light'
    if 'anpr' in surv_type or 'anpr' in operator or 'toll' in operator:
        return 'anpr'

    return 'flock'

def query_overpass(query):
    for server in OVERPASS_SERVERS:
        try:
            print(f"Querying {server}...")
            data_bytes = query.encode('utf-8')
            req = urllib.request.Request(
                server,
                data=data_bytes,
                headers={'User-Agent': 'DeFlock-GhostNav-Ingest/1.0'}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                print(f"Success from {server}!")
                return result
        except Exception as e:
            print(f"Server {server} warning: {e}. Trying fallback...")
            time.sleep(1)
    raise RuntimeError("All Overpass API servers timed out or failed.")

def fetch_and_save_cameras(bbox="37.95,-84.62,38.12,-84.38"):
    query = f"""
    [out:json][timeout:30];
    (
      node["man_made"="surveillance"]({bbox});
      node["surveillance:type"="ALPR"]({bbox});
      node["highway"="speed_camera"]({bbox});
      node["enforcement"]({bbox});
    );
    out body;
    """
    data = query_overpass(query)
    cameras = []
    seen_ids = set()

    for element in data.get('elements', []):
        osm_id = element.get('id')
        lat = element.get('lat')
        lon = element.get('lon')
        tags = element.get('tags', {})

        if not lat or not lon or osm_id in seen_ids:
            continue

        seen_ids.add(osm_id)

        direction_raw = (
            tags.get('camera:direction') or
            tags.get('direction') or
            tags.get('camera:heading') or
            tags.get('facing')
        )
        facing_degrees = parse_direction(direction_raw)
        kind = classify_camera(tags)

        # Strictly adheres to fixed schema: id, latitude, longitude, facing_degrees, kind
        cameras.append({
            "id": f"OSM-{osm_id}",
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "facing_degrees": facing_degrees,
            "kind": kind
        })

    output_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'cameras.json')
    with open(output_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(cameras, f, indent=2)

    print(f"[OK] Successfully ingested {len(cameras)} real-world cameras into {output_path}!")
    return cameras

if __name__ == '__main__':
    bbox = sys.argv[1] if len(sys.argv) > 1 else "37.95,-84.62,38.12,-84.38"
    fetch_and_save_cameras(bbox)
