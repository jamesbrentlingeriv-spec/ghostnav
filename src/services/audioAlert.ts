import { CameraKind } from '../types/camera';

class AudioAlertService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private lastAlertTime: number = 0;
  private minIntervalMs: number = 6000;

  constructor() {}

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public triggerCameraAlert(kind: CameraKind, _distanceMeters?: number) {
    if (this.isMuted) return;

    const now = Date.now();
    if (now - this.lastAlertTime < this.minIntervalMs) {
      return;
    }
    this.lastAlertTime = now;

    try {
      this.initContext();
      if (!this.ctx) return;

      switch (kind) {
        case 'flock':
          this.playFlockChime();
          break;
        case 'speed':
          this.playSpeedChime();
          break;
        case 'red_light':
          this.playRedLightChime();
          break;
        case 'anpr':
        default:
          this.playGeneralChime();
          break;
      }
    } catch (e) {
      console.warn('Audio alert playback error:', e);
    }
  }

  private playFlockChime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Pleasant dual-tone chime ding
    this.playTone(1046.5, t, 0.08, 'sine');
    this.playTone(1318.5, t + 0.07, 0.14, 'sine');
  }

  private playSpeedChime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(880, t, 0.08, 'sine');
    this.playTone(1174.66, t + 0.08, 0.14, 'sine');
  }

  private playRedLightChime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(987.77, t, 0.06, 'sine');
    this.playTone(1318.51, t + 0.08, 0.12, 'sine');
  }

  private playGeneralChime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(1046.5, t, 0.12, 'sine');
  }

  private playTone(freq: number, startTime: number, duration: number, type: OscillatorType) {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

export const audioAlert = new AudioAlertService();
