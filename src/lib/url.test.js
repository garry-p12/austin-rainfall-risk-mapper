import { describe, expect, it } from 'vitest';
import { choicesFromSearch, searchFromChoices } from './url.js';

const DEFAULTS = { mode: 'direction', dir: 'S', time: 'Night', uhi: 'Strong', sel: 5, unit: 'districts' };

describe('searchFromChoices', () => {
  it('writes only the storm direction parameters in that view', () => {
    expect(searchFromChoices({ ...DEFAULTS, dir: 'E', unit: 'grid', sel: 2 }))
      .toBe('?view=direction&dir=E&unit=grid&district=2');
  });

  it('writes only the time of day and heat parameters in that view, in lower case', () => {
    expect(searchFromChoices({ ...DEFAULTS, mode: 'uhi', time: 'Day', uhi: 'Moderate', sel: 10 }))
      .toBe('?view=uhi&time=day&heat=moderate&district=10');
  });
});

describe('choicesFromSearch', () => {
  it('uses the defaults when the address has no parameters', () => {
    expect(choicesFromSearch('', DEFAULTS)).toEqual(DEFAULTS);
  });

  it('round-trips every view', () => {
    const cases = [
      { ...DEFAULTS, dir: 'NW', unit: 'grid', sel: 9 },
      { ...DEFAULTS, mode: 'uhi', time: 'Day', uhi: 'Weak', sel: 1 },
    ];
    for (const c of cases) {
      const back = choicesFromSearch(searchFromChoices(c), DEFAULTS);
      expect(searchFromChoices(back)).toBe(searchFromChoices(c));
      expect(back.mode).toBe(c.mode);
      expect(back.sel).toBe(c.sel);
    }
  });

  it('accepts any letter case', () => {
    expect(choicesFromSearch('?view=direction&dir=sw&unit=GRID', DEFAULTS)).toMatchObject({ dir: 'SW', unit: 'grid' });
    expect(choicesFromSearch('?view=uhi&time=DAY&heat=weak', DEFAULTS)).toMatchObject({ mode: 'uhi', time: 'Day', uhi: 'Weak' });
  });

  it('falls back to the default for anything it does not recognize', () => {
    expect(choicesFromSearch('?view=forecast&dir=up&unit=miles&time=noon&heat=extreme&district=11', DEFAULTS)).toEqual(DEFAULTS);
    expect(choicesFromSearch('?district=0', DEFAULTS).sel).toBe(5);
    expect(choicesFromSearch('?district=2.5', DEFAULTS).sel).toBe(5);
    expect(choicesFromSearch('?district=abc', DEFAULTS).sel).toBe(5);
  });

  it('keeps settings for the other view at their defaults', () => {
    expect(choicesFromSearch('?view=uhi&time=day&heat=weak&district=3', DEFAULTS))
      .toEqual({ ...DEFAULTS, mode: 'uhi', time: 'Day', uhi: 'Weak', sel: 3 });
  });
});
