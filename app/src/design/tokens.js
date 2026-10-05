/* Design tokens: the single source for colours, fonts and the stage layout (design/VISUAL_LANGUAGE.md §1–3).
 * app/build.mjs fails if this file and the spec disagree. CSS custom properties are generated from TK at boot. */
export const TK = { paper: '#FCFBF8', light: '#FFFDF4', ink: '#1F2732', pool: '#0C121B', graphite: '#59616C', muted: '#6F7278', pencil: '#8E959D', wash: '#7D8DA3', faint: '#C9CBCF', hair: '#D9D6CF', accent: '#B93A20', mist: '#E6EBF1', tintBlue: '#4E5D73', tintRed: '#6B5A55', glow: '#FFF3D8', grain: '#A68D63' };
/** tokens allowed for text (contrast ≥ 4.5 on paper); pencil, wash, faint and hair are strokes and fills only */
export const TEXT_TOKENS = ['ink', 'pool', 'graphite', 'muted', 'accent'];
export const FONTS = { serif: "'Fraunces', Georgia, serif", sans: "'Inter', 'Helvetica Neue', Arial, sans-serif", mono: "'IBM Plex Mono', Menlo, monospace" };
/** the design stage (scaled to fit) and its two fields: the margin column and the figure */
export const STAGE = { W: 1440, H: 880, MAIN: { x: 340, y: 70, w: 1070, h: 780 } };
