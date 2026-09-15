import { describe, it, expect } from 'vitest';
import { bridgeGeometry } from './chartGeometry';

/**
 * The bridge's coordinates are DERIVED from its business values. This block used to read `top` and
 * `height` — the source mockup's pre-computed pixels — which the hygiene pass correctly strips, so
 * it rendered 0 times across 105 Decision Objects (audit §11.3).
 */
describe('bridgeGeometry — coordinates derived from business values', () => {
  const rows = (...vals) => vals.map(([display, anchor]) => ({ display, anchor: anchor === true }));

  it('stands an anchor row on the floor at its own magnitude', () => {
    expect(bridgeGeometry(rows(['$12,480', true]))).toEqual([{ base: 0, delta: 12480 }]);
  });

  it('floats a positive step from the running total', () => {
    const g = bridgeGeometry(rows(['$100', true], ['+$40']));
    expect(g[1]).toEqual({ base: 100, delta: 40 });
  });

  it('hangs a negative step down from the previous level, never below the axis', () => {
    const g = bridgeGeometry(rows(['$100', true], ['−$30']));
    // The bar spans 70..100: it starts where it ends up and rises back to where it began.
    expect(g[1]).toEqual({ base: 70, delta: 30 });
  });

  it('reproduces the reference bridge end to end (S10.1 variance)', () => {
    // $12,480 baseline, five drivers, closing at $10,640 — the closing anchor stands on the floor.
    const g = bridgeGeometry(rows(
      ['$12,480', true], ['−$2,210'], ['+$610'], ['−$240'], ['+$185'], ['−$315'], ['+$130'], ['$10,640', true],
    ));
    expect(g[0]).toEqual({ base: 0, delta: 12480 });
    expect(g[1]).toEqual({ base: 10270, delta: 2210 }); // 12480 − 2210
    expect(g[2]).toEqual({ base: 10270, delta: 610 });
    expect(g.at(-1)).toEqual({ base: 0, delta: 10640 });
  });

  it('contributes no bar for a row whose value will not parse, rather than NaN', () => {
    expect(bridgeGeometry(rows(['$100', true], ['n/a']))[1]).toEqual({ base: 0, delta: 0 });
  });
});
