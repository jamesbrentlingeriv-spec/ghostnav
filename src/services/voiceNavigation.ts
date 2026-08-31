import { CameraKind } from '../types/camera';

export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  isNeural: boolean;
  rawVoice?: SpeechSynthesisVoice;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
  recommendedRole?: string;
}

export const CURATED_ELEVEN_VOICES: ElevenLabsVoice[] = [
  {
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    recommendedRole: '🌟 Recommended Copilot (Mature, Confident, Reassuring American Female)',
  },
  {
    voice_id: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    recommendedRole: '🎙️ Deep, Resonant & Comforting (American Male)',
  },
  {
    voice_id: 'cjVigY5qzO86Huf0OWal',
    name: 'Eric',
    recommendedRole: '🚗 Smooth, Trustworthy Navigation Voice (American Male)',
  },
  {
    voice_id: 'XrExE9yKIg1WjnnlVkGX',
    name: 'Matilda',
    recommendedRole: '✨ Upbeat, Professional & Articulate (American Female)',
  },
  {
    voice_id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    recommendedRole: '📻 Steady Broadcaster (British Male)',
  },
  {
    voice_id: 'Xb7hH8MSUJpSbSDYk0k2',
    name: 'Alice',
    recommendedRole: '🎓 Clear, Engaging Educator (British Female)',
  },
  {
    voice_id: 'pwaf5Qmnzg3zNJ6ijCvi',
    name: 'John Wayne',
    recommendedRole: '🤠 American Cowboy ("Watch out for them speed traps, partner")',
  },
  {
    voice_id: 'LjNqOSdRGIUUmAcEINh7',
    name: 'Sir Michael Caine',
    recommendedRole: '🎬 British Cinematic Icon',
  },
  {
    voice_id: 'iWP0zWXsAkUmG0R4IMeO',
    name: 'Burt Reynolds',
    recommendedRole: '🏎️ Bandit / Masculine Storyteller',
  },
  {
    voice_id: 'EnjFGpDDWiIZ8zyMUJkx',
    name: 'Official Emergency Broadcaster',
    recommendedRole: '🚨 Urgent Critical Defense & Radar Warnings',
  },
];

const DEFAULT_ELEVEN_KEY = 'sk_06867e3efc86bb30b50bcb439d8715cc460aaba220fecd8f';

class VoiceNavigationService {
  private isEnabled: boolean = true;
  private isMuted: boolean = false;
  private voiceEngine: 'elevenlabs' | 'browser' | 'openai' = 'elevenlabs';
  private selectedVoiceId: string = 'default';
  private rate: number = 1.05;
  private pitch: number = 1.0;
  private volume: number = 1.0;
  private lastSpokenText: string = '';
  private lastSpokenTime: number = 0;
  private openAiApiKey: string = '';
  private elevenLabsApiKey: string = DEFAULT_ELEVEN_KEY;
  private elevenLabsVoiceId: string = 'EXAVITQu4vr4xnSDxMaL'; // Default: Sarah

  constructor() {
    if (typeof window !== 'undefined') {
      this.openAiApiKey = localStorage.getItem('ghostnav_openai_key') || '';
      const savedElevenKey = localStorage.getItem('ghostnav_eleven_key');
      this.elevenLabsApiKey = savedElevenKey !== null ? savedElevenKey : DEFAULT_ELEVEN_KEY;
      this.elevenLabsVoiceId = localStorage.getItem('ghostnav_eleven_voice_id') || 'EXAVITQu4vr4xnSDxMaL';
      this.voiceEngine = (localStorage.getItem('ghostnav_voice_engine') as 'elevenlabs' | 'browser' | 'openai') || 'elevenlabs';
      this.selectedVoiceId = localStorage.getItem('ghostnav_voice_id') || 'default';
      this.isEnabled = localStorage.getItem('ghostnav_voice_enabled') !== 'false';
    }
  }

  public getVoiceEngine(): 'elevenlabs' | 'browser' | 'openai' {
    return this.voiceEngine;
  }

  public setVoiceEngine(engine: 'elevenlabs' | 'browser' | 'openai') {
    this.voiceEngine = engine;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghostnav_voice_engine', engine);
    }
  }

  public getElevenLabsVoiceId(): string {
    return this.elevenLabsVoiceId;
  }

  public setElevenLabsVoiceId(voiceId: string) {
    this.elevenLabsVoiceId = voiceId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghostnav_eleven_voice_id', voiceId);
    }
  }

  public async fetchElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.elevenLabsApiKey) return CURATED_ELEVEN_VOICES;
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': this.elevenLabsApiKey },
      });
      if (res.ok) {
        const data = await res.json();
        return data.voices || CURATED_ELEVEN_VOICES;
      }
    } catch (e) {
      console.warn('Could not fetch ElevenLabs voices:', e);
    }
    return CURATED_ELEVEN_VOICES;
  }

  public getVoices(): VoiceOption[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return [];
    }

    const rawVoices = window.speechSynthesis.getVoices();
    const options: VoiceOption[] = [];

    // Filter to English voices & prioritize high quality natural/neural ones
    rawVoices.forEach((v) => {
      if (v.lang.startsWith('en')) {
        const isNeural =
          v.name.includes('Natural') ||
          v.name.includes('Online') ||
          v.name.includes('Neural') ||
          v.name.includes('Google') ||
          v.name.includes('Premium') ||
          v.name.includes('Enhanced') ||
          v.name.includes('Siri');

        options.push({
          id: v.name,
          name: v.name + (isNeural ? ' ✨ (HD Neural)' : ''),
          lang: v.lang,
          isNeural,
          rawVoice: v,
        });
      }
    });

    // Sort neural/natural voices to the top
    options.sort((a, b) => {
      if (a.isNeural && !b.isNeural) return -1;
      if (!a.isNeural && b.isNeural) return 1;
      return a.name.localeCompare(b.name);
    });

    return options;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghostnav_voice_enabled', enabled.toString());
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setSelectedVoiceId(voiceId: string) {
    this.selectedVoiceId = voiceId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghostnav_voice_id', voiceId);
    }
  }

  public getSelectedVoiceId(): string {
    return this.selectedVoiceId;
  }

  public setOpenAiApiKey(key: string) {
    this.openAiApiKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghostnav_openai_key', this.openAiApiKey);
    }
  }

  public getOpenAiApiKey(): string {
    return this.openAiApiKey;
  }

  public setElevenLabsApiKey(key: string) {
    this.elevenLabsApiKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghostnav_eleven_key', this.elevenLabsApiKey);
    }
  }

  public getElevenLabsApiKey(): string {
    return this.elevenLabsApiKey;
  }

  /**
   * Speak navigation instructions or camera safety alerts with high quality AI voice
   */
  public async speak(text: string, force: boolean = false): Promise<void> {
    if (!this.isEnabled || this.isMuted || !text) return;

    const now = Date.now();
    if (!force && text === this.lastSpokenText && now - this.lastSpokenTime < 5000) {
      return;
    }
    this.lastSpokenText = text;
    this.lastSpokenTime = now;

    // 1. Try OpenAI HD AI Voice (if API key provided)
    if (this.openAiApiKey) {
      try {
        const played = await this.speakOpenAI(text);
        if (played) return;
      } catch (e) {
        console.warn('OpenAI TTS failed, falling back to neural speech synthesis:', e);
      }
    }

    // 2. Try ElevenLabs AI Voice (if API key provided)
    if (this.elevenLabsApiKey) {
      try {
        const played = await this.speakElevenLabs(text);
        if (played) return;
      } catch (e) {
        console.warn('ElevenLabs TTS failed, falling back to neural speech synthesis:', e);
      }
    }

    // 3. Built-in Premium Neural Web Speech Synthesis (Zero Latency & Offline)
    this.speakBrowserNeural(text);
  }

  private speakBrowserNeural(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Stop prior utterance

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;

    const voices = this.getVoices();
    let chosen = voices.find((v) => v.id === this.selectedVoiceId)?.rawVoice;

    if (!chosen) {
      // Auto pick best neural English voice
      const best = voices.find((v) => v.isNeural && (v.lang === 'en-US' || v.lang.startsWith('en')));
      if (best) chosen = best.rawVoice;
    }

    if (chosen) {
      utterance.voice = chosen;
    }

    window.speechSynthesis.speak(utterance);
  }

  private async speakOpenAI(text: string): Promise<boolean> {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.openAiApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'alloy', // crystal-clear navigation voice
        speed: 1.05,
      }),
    });

    if (!res.ok) return false;
    const blob = await res.blob();
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    await audio.play();
    return true;
  }

  public async speakElevenLabs(text: string, overrideVoiceId?: string): Promise<boolean> {
    const voiceId = overrideVoiceId || this.elevenLabsVoiceId;
    const res = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.elevenLabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.70,
            similarity_boost: 0.85,
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) return false;
    const blob = await res.blob();
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    await audio.play();
    return true;
  }

  /**
   * Spoken Camera Alert
   */
  public speakCameraWarning(kind: CameraKind, distanceMeters: number) {
    let kindName = 'Flock ALPR camera';
    if (kind === 'speed') kindName = 'Speed radar camera';
    else if (kind === 'red_light') kindName = 'Red-light camera';
    else if (kind === 'anpr') kindName = 'License plate reader';

    const distFeet = Math.round(distanceMeters * 3.28084);
    const text = 'Caution: ' + kindName + ' ' + (distanceMeters <= 80 ? 'directly ahead' : 'in ' + distFeet + ' feet');
    this.speak(text);
  }

  /**
   * Spoken Turn Instruction
   */
  public speakTurn(instruction: string, distanceMeters: number) {
    if (!instruction) return;
    const distFeet = Math.round(distanceMeters * 3.28084);
    let prompt = instruction;
    if (distanceMeters > 30 && distanceMeters < 500) {
      prompt = 'In ' + distFeet + ' feet, ' + instruction.toLowerCase();
    }
    this.speak(prompt);
  }
}

export const voiceNav = new VoiceNavigationService();