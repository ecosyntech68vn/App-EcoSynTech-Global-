import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('season store with regions', () => {
  let seasonStore, getRegionRegion, getRegionSeasons, getCropAdviceForRegion, listAllRegions;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../stores/season.js');
    seasonStore = mod.seasonStore;
    getRegionRegion = mod.getRegionRegion;
    getRegionSeasons = mod.getRegionSeasons;
    getCropAdviceForRegion = mod.getCropAdviceForRegion;
    listAllRegions = mod.listAllRegions;
  });

  describe('getRegionRegion', () => {
    it('returns nam-bo for provinces in South Vietnam', () => {
      expect(getRegionRegion('An Giang')).toBe('nam-bo');
      expect(getRegionRegion('Cần Thơ')).toBe('nam-bo');
      expect(getRegionRegion('TP.HCM')).toBe('nam-bo');
      expect(getRegionRegion('Kiên Giang')).toBe('nam-bo');
    });

    it('returns trung-bo for provinces in Central Vietnam', () => {
      expect(getRegionRegion('Đà Nẵng')).toBe('trung-bo');
      expect(getRegionRegion('Thừa Thiên-Huế')).toBe('trung-bo');
      expect(getRegionRegion('Nghệ An')).toBe('trung-bo');
    });

    it('returns bac-bo for provinces in North Vietnam', () => {
      expect(getRegionRegion('Hà Nội')).toBe('bac-bo');
      expect(getRegionRegion('Hải Phòng')).toBe('bac-bo');
      expect(getRegionRegion('Sơn La')).toBe('bac-bo');
    });

    it('returns null for unknown province', () => {
      expect(getRegionRegion('Tokyo')).toBeNull();
    });
  });

  describe('getRegionSeasons', () => {
    it('returns nam-bo region data', () => {
      const region = getRegionSeasons('nam-bo');
      expect(region).not.toBeNull();
      expect(region.label).toBe('Nam Bộ');
      expect(region.cropCalendar.Lúa).toBeDefined();
      expect(region.cropCalendar.Lúa.length).toBeGreaterThanOrEqual(2);
    });

    it('returns null for unknown region', () => {
      expect(getRegionSeasons('unknown')).toBeNull();
    });
  });

  describe('getCropAdviceForRegion', () => {
    it('returns current season advice for crop in region', () => {
      const advice = getCropAdviceForRegion('nam-bo', 'Lúa');
      expect(advice.all).toBeDefined();
      expect(advice.all.length).toBeGreaterThanOrEqual(2);
    });

    it('returns null for unrecognized crop', () => {
      const advice = getCropAdviceForRegion('nam-bo', 'Khoai mỡ');
      expect(advice.current).toBeNull();
      expect(advice.all).toBeNull();
    });
  });

  describe('listAllRegions', () => {
    it('returns 3 regions', () => {
      const regions = listAllRegions();
      expect(regions).toHaveLength(3);
      expect(regions.map(r => r.label)).toContain('Nam Bộ');
      expect(regions.map(r => r.label)).toContain('Trung Bộ');
      expect(regions.map(r => r.label)).toContain('Bắc Bộ');
    });
  });
});
