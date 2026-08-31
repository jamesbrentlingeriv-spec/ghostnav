export type CameraKind = 'flock' | 'speed' | 'red_light' | 'anpr';

export interface Camera {
  id: string;
  latitude: number;
  longitude: number;
  facing_degrees: number;
  kind: CameraKind;
}
