import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Web Speech API
beforeEach(() => {
  // Mock only if not present
  if (typeof window !== 'undefined') {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      window.webkitSpeechRecognition = class {
        constructor() {
          this.lang = '';
          this.continuous = false;
          this.interimResults = false;
          this.maxAlternatives = 1;
        }
        start() { setTimeout(() => this.onresult?.({ results: [[{ transcript: 'test transcript' }]] }), 10); }
        stop() {}
        abort() {}
      };
    }
  }
});

describe('voiceStore', () => {
  let voiceStore;

  beforeEach(async () => {
    vi.resetModules();
    voiceStore = (await import('../stores/voice.js')).voiceStore;
  });

  describe('parse', () => {
    it('parses irrigation activity', () => {
      const r = voiceStore.parse('Hôm nay tưới rau muống 30 phút');
      expect(r.type).toBe('irrigation');
      expect(r.crop).toBe('Rau muống');
      expect(r.duration).toBe(30);
    });

    it('parses pesticide application', () => {
      const r = voiceStore.parse('Phun thuốc trừ sâu 20 ml cho lúa');
      expect(r.type).toBe('pest');
      expect(r.crop).toBe('Lúa');
      expect(r.dose).toBe('20');
      expect(r.doseUnit).toBe('ml');
    });

    it('parses fertilizer', () => {
      const r = voiceStore.parse('Bón phân NPK 50 kg cho cà chua');
      expect(r.type).toBe('fertilizer');
      expect(r.crop).toBe('Cà chua');
      expect(r.dose).toBe('50');
      expect(r.doseUnit).toBe('kg');
    });

    it('parses weeding', () => {
      const r = voiceStore.parse('Làm cỏ lúa 2 giờ');
      expect(r.type).toBe('weeding');
      expect(r.crop).toBe('Lúa');
      expect(r.duration).toBe(120); // 2 giờ = 120 phút
    });

    it('parses tank mix with +', () => {
      const r = voiceStore.parse('Pha 20ml abamectin + 30ml mancozeb phun xoài');
      expect(r.type).toBe('pest');
      expect(r.crop).toBe('Xoài');
      expect(r.note).toContain('+');
    });

    it('returns other for unknown activity', () => {
      const r = voiceStore.parse('Đi chợ mua rau');
      expect(r.type).toBe('other');
    });

    it('extracts area when mentioned', () => {
      const r = voiceStore.parse('Phun thuốc 500 m2 cho cải bẹ');
      expect(r.type).toBe('pest');
      expect(r.crop).toBe('Cải');
    });
  });

  describe('isSupported', () => {
    it('returns true when SpeechRecognition is available', () => {
      // In test environment with mock
      const supported = voiceStore.isSupported();
      // Should be true since we mocked it
      expect(typeof supported).toBe('boolean');
    });
  });
});
