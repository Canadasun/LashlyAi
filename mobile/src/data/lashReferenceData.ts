/**
 * Static mirror of docs/lash-rules.md, for the in-app Reference Guide screen only —
 * this is display copy, not the rules engine (that's backend/src/services/lashmap.
 * service.ts + lashMapRules.data.ts, which the mobile app never talks to directly for
 * these values). Keep the three in sync when the owner updates the source doc.
 *
 * `confirmed: false` marks numbers docs/lash-rules.md still labels PLACEHOLDER — shown
 * to the artist as "Estimate" rather than presented with false confidence, matching the
 * CLAUDE.md mandate to never silently present placeholder data as settled fact.
 */

export interface EyeShapeGuide {
  eyeShape: string;
  style: string;
  curl: string;
  note: string;
}

export const EYE_SHAPE_GUIDE: EyeShapeGuide[] = [
  { eyeShape: 'Round', style: 'Cat Eye', curl: 'C', note: 'Lengthen outer corners to elongate' },
  { eyeShape: 'Almond', style: 'Natural / Wispy', curl: 'C or CC', note: 'Most curls work well' },
  { eyeShape: 'Hooded', style: 'Cat Eye', curl: 'CC or D', note: 'More curl to show through the crease' },
  { eyeShape: 'Monolid', style: 'Doll Eye / Cat Eye', curl: 'CC', note: 'Curl compensates for lid coverage' },
  { eyeShape: 'Downturned', style: 'Cat Eye', curl: 'CC', note: 'Lift the outer corner' },
  { eyeShape: 'Upturned', style: 'Doll Eye', curl: 'C', note: 'Balance the natural lift' },
  { eyeShape: 'Deep-set', style: 'Wispy', curl: 'CC or D', note: 'More curl brings lashes forward' },
  { eyeShape: 'Close-set', style: 'Cat Eye (outer emphasis)', curl: 'C', note: 'Extend length outward, keep inner corner shorter' },
  { eyeShape: 'Wide-set', style: 'Doll Eye (inner emphasis)', curl: 'C', note: 'Extend length inward, keep outer corner shorter' },
];

export interface LashSetGuide {
  name: string;
  diameter: string;
  curl: string;
  lengths: string; // Inner / Inner-mid / Center / Outer-mid / Outer, mm
  tier: 'Free' | 'Pro';
  note: string;
  diameterConfirmed: boolean;
}

export const LASH_SET_GUIDE: LashSetGuide[] = [
  { name: 'Classic', diameter: '0.15mm / 0.18mm / 0.20mm', curl: 'C', lengths: '8 / 9 / 10 / 10 / 9', tier: 'Free', note: '1:1 extension-to-natural-lash ratio', diameterConfirmed: true },
  { name: 'Hybrid', diameter: 'Classic 0.15–0.20mm + Volume fans 0.05mm / 0.07mm', curl: 'CC', lengths: '8 / 10 / 11 / 11 / 10', tier: 'Free', note: 'Mix of classic + volume fans', diameterConfirmed: true },
  { name: 'Volume', diameter: '0.05mm / 0.07mm / 0.10mm', curl: 'CC', lengths: '9 / 11 / 12 / 12 / 11', tier: 'Free', note: '3D–4D fans', diameterConfirmed: true },
  { name: 'Megavolume', diameter: '0.02mm / 0.03mm', curl: 'D', lengths: '10 / 12 / 14 / 14 / 12', tier: 'Pro', note: 'Ultra-fine, 5D–8D+ fans, fullest look — highest-skill technique', diameterConfirmed: true },
  { name: 'Wet Set', diameter: 'Estimated from natural density', curl: 'C', lengths: '6 / 7 / 8 / 8 / 7', tier: 'Pro', note: 'Shorter, styled wet/clumped look', diameterConfirmed: false },
  { name: 'Wet Wispy Set', diameter: '0.05mm / 0.07mm', curl: 'CC', lengths: '7 / 9 / 11 / 11 / 10', tier: 'Pro', note: 'Textured wet look, mixed lengths — needs Spike + Base Layer map', diameterConfirmed: true },
  { name: 'Medusa Set', diameter: 'Estimated from natural density', curl: 'CC', lengths: '6 / 11 / 8 / 13 / 9', tier: 'Pro', note: 'Spiky, mixed-length — needs Spike + Base Layer map', diameterConfirmed: false },
  { name: 'Anime Set', diameter: '0.05mm', curl: 'D', lengths: '10 / 12 / 15 / 14 / 11', tier: 'Pro', note: 'Dramatic, very long center — needs Spike + Base Layer map', diameterConfirmed: true },
  { name: 'Angel Set', diameter: 'Estimated from natural density', curl: 'CC', lengths: '9 / 10 / 12 / 11 / 9', tier: 'Free', note: 'Soft, rounded, doll-like fullness', diameterConfirmed: false },
  { name: 'YY Set', diameter: 'Estimated from natural density', curl: 'CC', lengths: '8 / 10 / 11 / 11 / 10', tier: 'Free', note: 'Y-shaped fans for a fluffy, textured finish', diameterConfirmed: false },
];

export interface LashStyleGuide {
  name: string;
  mapping: string;
  bestFor: string;
  confirmed: boolean;
}

export const LASH_STYLE_GUIDE: LashStyleGuide[] = [
  {
    name: 'Cat Eye',
    mapping: 'Shorter at the inner corner; length gradually increases outward; longest lengths concentrated at the outer section — a winged eyeliner effect.',
    bestFor: 'Clients wanting a lifted, elongated appearance.',
    confirmed: true,
  },
  {
    name: 'Doll Eye',
    mapping: 'Shorter at the inner and outer corners; longest lengths placed in the center of the eye.',
    bestFor: 'Clients wanting a bigger, more open-eye effect.',
    confirmed: true,
  },
  {
    name: 'Open Eye',
    mapping: 'Short at the inner corner; length increases toward the middle; longest point around the center; decreases again toward the outer corner.',
    bestFor: 'Clients wanting the eyes to appear larger and more open.',
    confirmed: true,
  },
  {
    name: 'Squirrel Eye',
    mapping: 'Length increases gradually from the inner corner; maximum length placed slightly before the outer corner, which is then slightly shorter than the peak — a lifted, balanced effect without dragging the eye downward.',
    bestFor: 'Clients who want a lifted but soft appearance.',
    confirmed: true,
  },
  { name: 'Kitten Eye', mapping: 'A softer, shorter-winged cat eye.', bestFor: 'Not yet confirmed by owner.', confirmed: false },
  { name: 'Fox Eye', mapping: 'Dramatic outer lift, longer outer lengths.', bestFor: 'Not yet confirmed by owner.', confirmed: false },
  { name: 'Natural Eye', mapping: 'Mimics natural lash growth pattern, minimal drama.', bestFor: 'Not yet confirmed by owner.', confirmed: false },
];

export interface DensityGuide {
  density: string;
  diameter: string;
  fanType: string;
}

export const DENSITY_GUIDE: DensityGuide[] = [
  { density: 'Sparse / fine', diameter: '0.10mm–0.12mm', fanType: 'Classic (1:1)' },
  { density: 'Medium', diameter: '0.15mm', fanType: '3D–4D volume' },
  { density: 'Dense / coarse', diameter: '0.18mm–0.20mm', fanType: '5D–8D volume' },
];

export interface GlueGuide {
  humidity: string;
  viscosity: string;
  cureTime: string;
  note: string;
}

export const GLUE_GUIDE: GlueGuide[] = [
  { humidity: 'Below 30% (low)', viscosity: 'Thinner viscosity', cureTime: 'Longer, ~5–6 sec per lash', note: 'Consider a humidifier near the workstation — low humidity slows cure' },
  { humidity: '30–70% (ideal)', viscosity: 'Standard viscosity', cureTime: 'Standard, ~2–3 sec per lash', note: 'This is the target range most glues are formulated for' },
  { humidity: 'Above 70% (high)', viscosity: 'Thicker viscosity', cureTime: 'Faster, ~1–2 sec per lash', note: 'Consider a dehumidifier — high humidity over-accelerates cure and can cause bonding issues' },
];
