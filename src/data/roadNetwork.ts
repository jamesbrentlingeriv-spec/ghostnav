export interface RoadNode {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface RoadEdge {
  from: string;
  to: string;
  streetName: string;
  speedLimitMph: number;
}

// Lexington, Kentucky Arterial Grid & Intersections
export const ROAD_NODES: RoadNode[] = [
  // Downtown Core (Main, Vine, Broadway, Limestone, Martin Luther King)
  { id: "LEX_MAIN_BWAY", name: "Main St & S Broadway", latitude: 38.0470, longitude: -84.5015 },
  { id: "LEX_MAIN_LIME", name: "Main St & S Limestone (Downtown)", latitude: 38.0450, longitude: -84.4975 },
  { id: "LEX_MAIN_ROSE", name: "Main St & Rose St", latitude: 38.0425, longitude: -84.4925 },
  { id: "LEX_MAIN_MIDLAND", name: "Main St & Midland Ave", latitude: 38.0395, longitude: -84.4865 },

  { id: "LEX_VINE_BWAY", name: "Vine St & S Broadway", latitude: 38.0460, longitude: -84.5025 },
  { id: "LEX_VINE_LIME", name: "Vine St & S Limestone", latitude: 38.0440, longitude: -84.4985 },
  { id: "LEX_VINE_ROSE", name: "Vine St & Rose St", latitude: 38.0415, longitude: -84.4935 },

  // Rupp Arena & High St
  { id: "LEX_RUPP_HIGH", name: "Rupp Arena / W High St & Broadway", latitude: 38.0445, longitude: -84.5045 },
  { id: "LEX_HIGH_LIME", name: "E High St & S Limestone", latitude: 38.0425, longitude: -84.5005 },
  { id: "LEX_HIGH_ROSE", name: "E High St & Rose St", latitude: 38.0400, longitude: -84.4955 },

  // University of Kentucky Campus
  { id: "LEX_UK_AVE_CHAMP", name: "Avenue of Champions & S Limestone (UK)", latitude: 38.0375, longitude: -84.5030 },
  { id: "LEX_UK_ROSE_EUCLID", name: "Rose St & Euclid Ave (UK Campus)", latitude: 38.0360, longitude: -84.4980 },
  { id: "LEX_UK_WOODLAND", name: "Euclid Ave & Woodland Ave", latitude: 38.0345, longitude: -84.4920 },
  { id: "LEX_UK_VIRGINIA", name: "S Limestone & Virginia Ave (UK Med)", latitude: 38.0305, longitude: -84.5100 },

  // South Arterial (Nicholasville Rd & Harrodsburg Rd)
  { id: "LEX_NICH_ALUMNI", name: "Nicholasville Rd & Alumni Dr", latitude: 38.0195, longitude: -84.5165 },
  { id: "LEX_NICH_NEWCIRCLE", name: "Nicholasville Rd & New Circle Rd", latitude: 38.0015, longitude: -84.5245 },
  { id: "LEX_HARRODS_NEWCIRCLE", name: "Harrodsburg Rd & New Circle Rd", latitude: 38.0095, longitude: -84.5420 },

  // East Arterial (Richmond Rd & New Circle)
  { id: "LEX_RICH_NEWCIRCLE", name: "Richmond Rd & New Circle Rd", latitude: 38.0165, longitude: -84.4625 },
  { id: "LEX_RICH_MANOWAR", name: "Richmond Rd & Man o' War Blvd", latitude: 37.9940, longitude: -84.4390 },

  // North Arterial (Broadway & Newtown Pike)
  { id: "LEX_NEWTOWN_NEWCIRCLE", name: "Newtown Pike & New Circle Rd", latitude: 38.0725, longitude: -84.5010 },
  { id: "LEX_BWAY_NEWCIRCLE", name: "North Broadway & New Circle Rd", latitude: 38.0695, longitude: -84.4840 },

  // Hamburg Pavilion / East Outer Hub
  { id: "LEX_HAMBURG_MANOWAR", name: "Hamburg Pavilion / Man o' War & I-75", latitude: 38.0315, longitude: -84.4230 },
  { id: "LEX_WINCHESTER_NEWCIRCLE", name: "Winchester Rd & New Circle Rd", latitude: 38.0435, longitude: -84.4530 }
];

export const ROAD_EDGES: RoadEdge[] = [
  // Main Street Corridor
  { from: "LEX_MAIN_BWAY", to: "LEX_MAIN_LIME", streetName: "W Main St", speedLimitMph: 25 },
  { from: "LEX_MAIN_LIME", to: "LEX_MAIN_ROSE", streetName: "E Main St", speedLimitMph: 25 },
  { from: "LEX_MAIN_ROSE", to: "LEX_MAIN_MIDLAND", streetName: "E Main St", speedLimitMph: 30 },

  // Vine Street Corridor
  { from: "LEX_VINE_BWAY", to: "LEX_VINE_LIME", streetName: "W Vine St", speedLimitMph: 25 },
  { from: "LEX_VINE_LIME", to: "LEX_VINE_ROSE", streetName: "E Vine St", speedLimitMph: 25 },

  // High Street Corridor
  { from: "LEX_RUPP_HIGH", to: "LEX_HIGH_LIME", streetName: "W High St", speedLimitMph: 25 },
  { from: "LEX_HIGH_LIME", to: "LEX_HIGH_ROSE", streetName: "E High St", speedLimitMph: 25 },

  // North-South Connectors in Downtown
  { from: "LEX_MAIN_BWAY", to: "LEX_VINE_BWAY", streetName: "S Broadway", speedLimitMph: 25 },
  { from: "LEX_VINE_BWAY", to: "LEX_RUPP_HIGH", streetName: "S Broadway", speedLimitMph: 25 },

  { from: "LEX_MAIN_LIME", to: "LEX_VINE_LIME", streetName: "S Limestone", speedLimitMph: 25 },
  { from: "LEX_VINE_LIME", to: "LEX_HIGH_LIME", streetName: "S Limestone", speedLimitMph: 25 },
  { from: "LEX_HIGH_LIME", to: "LEX_UK_AVE_CHAMP", streetName: "S Limestone", speedLimitMph: 25 },
  { from: "LEX_UK_AVE_CHAMP", to: "LEX_UK_VIRGINIA", streetName: "S Limestone", speedLimitMph: 30 },

  { from: "LEX_MAIN_ROSE", to: "LEX_VINE_ROSE", streetName: "Rose St", speedLimitMph: 25 },
  { from: "LEX_VINE_ROSE", to: "LEX_HIGH_ROSE", streetName: "Rose St", speedLimitMph: 25 },
  { from: "LEX_HIGH_ROSE", to: "LEX_UK_ROSE_EUCLID", streetName: "Rose St", speedLimitMph: 25 },

  // UK Campus Connectors
  { from: "LEX_UK_AVE_CHAMP", to: "LEX_UK_ROSE_EUCLID", streetName: "Avenue of Champions / Euclid Ave", speedLimitMph: 25 },
  { from: "LEX_UK_ROSE_EUCLID", to: "LEX_UK_WOODLAND", streetName: "Euclid Ave", speedLimitMph: 25 },

  // Nicholasville Rd Corridor (South)
  { from: "LEX_UK_VIRGINIA", to: "LEX_NICH_ALUMNI", streetName: "Nicholasville Rd", speedLimitMph: 35 },
  { from: "LEX_NICH_ALUMNI", to: "LEX_NICH_NEWCIRCLE", streetName: "Nicholasville Rd", speedLimitMph: 40 },

  // Richmond Road Corridor (East)
  { from: "LEX_MAIN_MIDLAND", to: "LEX_RICH_NEWCIRCLE", streetName: "Richmond Rd", speedLimitMph: 35 },
  { from: "LEX_RICH_NEWCIRCLE", to: "LEX_RICH_MANOWAR", streetName: "Richmond Rd", speedLimitMph: 45 },

  // Winchester & Hamburg Corridor
  { from: "LEX_MAIN_MIDLAND", to: "LEX_WINCHESTER_NEWCIRCLE", streetName: "Winchester Rd", speedLimitMph: 35 },
  { from: "LEX_WINCHESTER_NEWCIRCLE", to: "LEX_HAMBURG_MANOWAR", streetName: "Sir Barton Way / Hamburg", speedLimitMph: 40 },

  // North Broadway & Newtown Pike Corridors
  { from: "LEX_MAIN_BWAY", to: "LEX_BWAY_NEWCIRCLE", streetName: "North Broadway", speedLimitMph: 35 },
  { from: "LEX_RUPP_HIGH", to: "LEX_NEWTOWN_NEWCIRCLE", streetName: "Oliver Lewis Way / Newtown Pike", speedLimitMph: 35 },

  // New Circle Road Outer Ring Connectors
  { from: "LEX_HARRODS_NEWCIRCLE", to: "LEX_NICH_NEWCIRCLE", streetName: "New Circle Rd (KY-4)", speedLimitMph: 55 },
  { from: "LEX_NICH_NEWCIRCLE", to: "LEX_RICH_NEWCIRCLE", streetName: "New Circle Rd (KY-4)", speedLimitMph: 55 },
  { from: "LEX_RICH_NEWCIRCLE", to: "LEX_WINCHESTER_NEWCIRCLE", streetName: "New Circle Rd (KY-4)", speedLimitMph: 55 },
  { from: "LEX_WINCHESTER_NEWCIRCLE", to: "LEX_BWAY_NEWCIRCLE", streetName: "New Circle Rd (KY-4)", speedLimitMph: 55 },
  { from: "LEX_BWAY_NEWCIRCLE", to: "LEX_NEWTOWN_NEWCIRCLE", streetName: "New Circle Rd (KY-4)", speedLimitMph: 55 },

  // Harrodsburg Road to Downtown Connection
  { from: "LEX_HARRODS_NEWCIRCLE", to: "LEX_RUPP_HIGH", streetName: "Harrodsburg Rd / S Broadway", speedLimitMph: 40 }
];

export const PRESET_DESTINATIONS = [
  { name: "Pal Optical & Eye Care (1555 E New Circle Rd)", coords: { latitude: 38.0185, longitude: -84.4544 } },
  { name: "Rupp Arena & Central Bank Center", coords: { latitude: 38.0445, longitude: -84.5045 } },
  { name: "University of Kentucky (Main Campus)", coords: { latitude: 38.0375, longitude: -84.5030 } },
  { name: "UK Chandler Medical Center", coords: { latitude: 38.0305, longitude: -84.5100 } },
  { name: "Downtown Lexington (Main & Lime)", coords: { latitude: 38.0450, longitude: -84.4975 } },
  { name: "The Summit at Fritz Farm / Nicholasville", coords: { latitude: 38.0015, longitude: -84.5245 } },
  { name: "Hamburg Pavilion / I-75 Hub", coords: { latitude: 38.0315, longitude: -84.4230 } },
  { name: "Fayette Mall & Nicholasville Rd", coords: { latitude: 37.9920, longitude: -84.5290 } },
  { name: "Richmond Road Commercial Corridor", coords: { latitude: 38.0165, longitude: -84.4625 } },
  { name: "North Broadway / New Circle District", coords: { latitude: 38.0695, longitude: -84.4840 } }
];
