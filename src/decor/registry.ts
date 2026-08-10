import type { FC } from 'react'
import type { BomLine } from '../types'
import { BalloonArch, balloonArchBom, BalloonColumn, balloonColumnBom } from './generators/balloons'
import {
  FloralArch,
  floralArchBom,
  FloralSwag,
  floralSwagBom,
  MarigoldStrings,
  marigoldBom,
} from './generators/florals'
import {
  BackdropPanel,
  backdropBom,
  MandapFrame,
  mandapBom,
  PathwayPillar,
  pillarBom,
  StageRiser,
  stageBom,
} from './generators/structures'
import { CeilingSwoop, ceilingSwoopBom, DrapePanel, drapeBom } from './generators/fabric'
import { FairyLights, fairyLightsBom, Uplighter, uplighterBom } from './generators/lights'
import { ChairRow, chairRowBom, RoundTable, roundTableBom } from './generators/furniture'
import { Billboard } from './generators/billboard'

export type Params = Record<string, number | string>

export interface GeneratorProps {
  params: Params
}

export type ParamSpec =
  | {
      key: string
      label: string
      type: 'number'
      min: number
      max: number
      step: number
      /** Shown next to the slider. Lengths are authored in metres, shown in feet. */
      unit?: 'ft' | 'pcs' | ''
      default: number
    }
  | { key: string; label: string; type: 'color'; default: string }
  | {
      key: string
      label: string
      type: 'select'
      options: { value: string; label: string }[]
      default: string
    }

export type Category = 'balloons' | 'florals' | 'structures' | 'fabric' | 'lighting' | 'furniture' | 'custom'

export const CATEGORY_LABELS: Record<Category, string> = {
  balloons: 'Balloons',
  florals: 'Florals',
  structures: 'Structures',
  fabric: 'Drapes',
  lighting: 'Lighting',
  furniture: 'Furniture',
  custom: 'Your uploads',
}

export interface DecorDef {
  id: string
  label: string
  category: Category
  /** Emoji stand-in for a thumbnail; real renders are a later polish pass. */
  icon: string
  params: ParamSpec[]
  Component: FC<GeneratorProps>
  bom: (params: Params) => BomLine[]
  /** Wall-mounted items sit against a surface rather than on the floor. */
  mount?: 'floor' | 'wall' | 'ceiling'
}

const palettes = {
  key: 'palette',
  label: 'Colour scheme',
  type: 'select' as const,
  options: [
    { value: 'blush', label: 'Blush & rose' },
    { value: 'gold', label: 'Gold' },
    { value: 'marigold', label: 'Marigold' },
    { value: 'pastel', label: 'Pastel' },
    { value: 'royal', label: 'Royal purple' },
    { value: 'white', label: 'Ivory & white' },
  ],
  default: 'blush',
}

export const DECOR: DecorDef[] = [
  {
    id: 'balloon-arch',
    label: 'Balloon garland arch',
    category: 'balloons',
    icon: '🎈',
    params: [
      { key: 'span', label: 'Span', type: 'number', min: 1, max: 14, step: 0.1, unit: 'ft', default: 4 },
      { key: 'rise', label: 'Rise', type: 'number', min: 0.2, max: 6, step: 0.1, unit: 'ft', default: 1.6 },
      { key: 'density', label: 'Density', type: 'number', min: 2, max: 14, step: 0.5, default: 6 },
      { key: 'size', label: 'Balloon size', type: 'number', min: 0.05, max: 0.3, step: 0.005, unit: 'ft', default: 0.13 },
      palettes,
    ],
    Component: BalloonArch,
    bom: balloonArchBom,
  },
  {
    id: 'balloon-column',
    label: 'Balloon column',
    category: 'balloons',
    icon: '🎈',
    params: [
      { key: 'height', label: 'Height', type: 'number', min: 0.8, max: 4, step: 0.1, unit: 'ft', default: 2.2 },
      { key: 'size', label: 'Balloon size', type: 'number', min: 0.05, max: 0.3, step: 0.005, unit: 'ft', default: 0.14 },
      { ...palettes, default: 'pastel' },
    ],
    Component: BalloonColumn,
    bom: balloonColumnBom,
  },
  {
    id: 'floral-arch',
    label: 'Flower arch / gate',
    category: 'florals',
    icon: '🌸',
    params: [
      { key: 'span', label: 'Span', type: 'number', min: 1, max: 12, step: 0.1, unit: 'ft', default: 3 },
      { key: 'rise', label: 'Rise', type: 'number', min: 0.5, max: 6, step: 0.1, unit: 'ft', default: 2.4 },
      { key: 'density', label: 'Density', type: 'number', min: 1, max: 8, step: 0.25, default: 3.5 },
      { key: 'bloom', label: 'Bloom size', type: 'number', min: 0.03, max: 0.2, step: 0.005, unit: 'ft', default: 0.075 },
      palettes,
    ],
    Component: FloralArch,
    bom: floralArchBom,
  },
  {
    id: 'marigold-strings',
    label: 'Marigold hangings',
    category: 'florals',
    icon: '🌼',
    mount: 'ceiling',
    params: [
      { key: 'width', label: 'Spread', type: 'number', min: 0.5, max: 14, step: 0.1, unit: 'ft', default: 4 },
      { key: 'drop', label: 'Drop', type: 'number', min: 0.4, max: 5, step: 0.1, unit: 'ft', default: 1.8 },
      { key: 'count', label: 'Strings', type: 'number', min: 2, max: 60, step: 1, unit: 'pcs', default: 16 },
      { key: 'bead', label: 'Flower size', type: 'number', min: 0.02, max: 0.1, step: 0.002, unit: 'ft', default: 0.045 },
      { ...palettes, default: 'marigold' },
    ],
    Component: MarigoldStrings,
    bom: marigoldBom,
  },
  {
    id: 'floral-swag',
    label: 'Floral swag',
    category: 'florals',
    icon: '💐',
    params: [
      { key: 'span', label: 'Span', type: 'number', min: 0.5, max: 10, step: 0.1, unit: 'ft', default: 2.4 },
      { key: 'sag', label: 'Sag', type: 'number', min: 0.05, max: 1.5, step: 0.05, unit: 'ft', default: 0.35 },
      { key: 'bloom', label: 'Bloom size', type: 'number', min: 0.02, max: 0.15, step: 0.005, unit: 'ft', default: 0.06 },
      { ...palettes, default: 'white' },
    ],
    Component: FloralSwag,
    bom: floralSwagBom,
  },
  {
    id: 'mandap',
    label: 'Mandap / canopy frame',
    category: 'structures',
    icon: '🏛️',
    params: [
      { key: 'width', label: 'Width', type: 'number', min: 1.5, max: 8, step: 0.1, unit: 'ft', default: 3.2 },
      { key: 'depth', label: 'Depth', type: 'number', min: 1.5, max: 8, step: 0.1, unit: 'ft', default: 3.2 },
      { key: 'height', label: 'Height', type: 'number', min: 1.8, max: 5, step: 0.1, unit: 'ft', default: 2.9 },
      { ...palettes, default: 'marigold' },
    ],
    Component: MandapFrame,
    bom: mandapBom,
  },
  {
    id: 'stage',
    label: 'Stage riser',
    category: 'structures',
    icon: '🎬',
    params: [
      { key: 'width', label: 'Width', type: 'number', min: 1, max: 16, step: 0.1, unit: 'ft', default: 5 },
      { key: 'depth', label: 'Depth', type: 'number', min: 1, max: 10, step: 0.1, unit: 'ft', default: 3 },
      { key: 'height', label: 'Height', type: 'number', min: 0.1, max: 1.5, step: 0.05, unit: 'ft', default: 0.4 },
      { key: 'topColor', label: 'Deck colour', type: 'color', default: '#8d2f4a' },
    ],
    Component: StageRiser,
    bom: stageBom,
  },
  {
    id: 'pillar',
    label: 'Pathway pillar',
    category: 'structures',
    icon: '🕯️',
    params: [
      { key: 'height', label: 'Height', type: 'number', min: 0.5, max: 2.5, step: 0.05, unit: 'ft', default: 1.1 },
      palettes,
    ],
    Component: PathwayPillar,
    bom: pillarBom,
  },
  {
    id: 'backdrop',
    label: 'Backdrop panel',
    category: 'structures',
    icon: '🖼️',
    params: [
      { key: 'width', label: 'Width', type: 'number', min: 0.6, max: 8, step: 0.1, unit: 'ft', default: 2 },
      { key: 'height', label: 'Height', type: 'number', min: 0.8, max: 5, step: 0.1, unit: 'ft', default: 2.4 },
      {
        key: 'shape',
        label: 'Shape',
        type: 'select',
        options: [
          { value: 'arch', label: 'Arched' },
          { value: 'rect', label: 'Rectangular' },
        ],
        default: 'arch',
      },
      { key: 'color', label: 'Colour', type: 'color', default: '#e9dfd0' },
    ],
    Component: BackdropPanel,
    bom: backdropBom,
  },
  {
    id: 'drape',
    label: 'Drape panel',
    category: 'fabric',
    icon: '🪟',
    mount: 'wall',
    params: [
      { key: 'width', label: 'Width', type: 'number', min: 0.4, max: 8, step: 0.1, unit: 'ft', default: 1.6 },
      { key: 'height', label: 'Height', type: 'number', min: 0.8, max: 8, step: 0.1, unit: 'ft', default: 3.2 },
      { key: 'folds', label: 'Folds', type: 'number', min: 2, max: 20, step: 1, default: 7 },
      { key: 'color', label: 'Colour', type: 'color', default: '#f0e6d6' },
    ],
    Component: DrapePanel,
    bom: drapeBom,
  },
  {
    id: 'ceiling-swoop',
    label: 'Ceiling drape ring',
    category: 'fabric',
    icon: '⛺',
    params: [
      { key: 'radius', label: 'Radius', type: 'number', min: 0.6, max: 8, step: 0.1, unit: 'ft', default: 2.5 },
      { key: 'height', label: 'Height', type: 'number', min: 1, max: 8, step: 0.1, unit: 'ft', default: 3.4 },
      { key: 'panels', label: 'Panels', type: 'number', min: 4, max: 24, step: 1, unit: 'pcs', default: 10 },
      { key: 'color', label: 'Colour', type: 'color', default: '#efe4d4' },
    ],
    Component: CeilingSwoop,
    bom: ceilingSwoopBom,
  },
  {
    id: 'fairy-lights',
    label: 'Fairy light swag',
    category: 'lighting',
    icon: '✨',
    mount: 'ceiling',
    params: [
      { key: 'span', label: 'Span', type: 'number', min: 1, max: 16, step: 0.1, unit: 'ft', default: 5 },
      { key: 'sag', label: 'Sag', type: 'number', min: 0.1, max: 2.5, step: 0.05, unit: 'ft', default: 0.6 },
      { key: 'strands', label: 'Strands', type: 'number', min: 1, max: 8, step: 1, unit: 'pcs', default: 3 },
      { key: 'spacing', label: 'Bulb spacing', type: 'number', min: 0.05, max: 0.5, step: 0.01, unit: 'ft', default: 0.12 },
      { key: 'color', label: 'Colour', type: 'color', default: '#ffd9a0' },
    ],
    Component: FairyLights,
    bom: fairyLightsBom,
  },
  {
    id: 'uplighter',
    label: 'Uplighter',
    category: 'lighting',
    icon: '🔦',
    params: [
      { key: 'intensity', label: 'Brightness', type: 'number', min: 0.2, max: 4, step: 0.1, default: 1.4 },
      { key: 'color', label: 'Colour', type: 'color', default: '#8a6cff' },
    ],
    Component: Uplighter,
    bom: uplighterBom,
  },
  {
    id: 'chair-row',
    label: 'Chair row',
    category: 'furniture',
    icon: '🪑',
    params: [
      { key: 'count', label: 'Chairs', type: 'number', min: 1, max: 30, step: 1, unit: 'pcs', default: 8 },
      { key: 'spacing', label: 'Spacing', type: 'number', min: 0.45, max: 1.2, step: 0.01, unit: 'ft', default: 0.58 },
      { key: 'curve', label: 'Curve', type: 'number', min: 0, max: 40, step: 1, default: 0 },
      { key: 'sash', label: 'Sash colour', type: 'color', default: '#c9a24a' },
    ],
    Component: ChairRow,
    bom: chairRowBom,
  },
  {
    id: 'round-table',
    label: 'Guest table',
    category: 'furniture',
    icon: '🍽️',
    params: [
      { key: 'diameter', label: 'Diameter', type: 'number', min: 0.9, max: 2.4, step: 0.05, unit: 'ft', default: 1.5 },
      { key: 'seats', label: 'Seats', type: 'number', min: 4, max: 14, step: 1, unit: 'pcs', default: 8 },
      { key: 'cloth', label: 'Cloth colour', type: 'color', default: '#f2ece0' },
      { key: 'sash', label: 'Sash colour', type: 'color', default: '#c9a24a' },
    ],
    Component: RoundTable,
    bom: roundTableBom,
  },
  {
    id: 'billboard',
    label: 'Photo cutout',
    category: 'custom',
    icon: '🖼️',
    params: [
      { key: 'height', label: 'Height', type: 'number', min: 0.2, max: 6, step: 0.05, unit: 'ft', default: 1.6 },
      {
        key: 'facing',
        label: 'Facing',
        type: 'select',
        options: [
          { value: 'camera', label: 'Always face viewer' },
          { value: 'fixed', label: 'Fixed direction' },
        ],
        default: 'camera',
      },
      { key: 'photoId', label: 'Photo', type: 'select', options: [], default: '' },
    ],
    Component: Billboard,
    // Cutouts are a visualisation stand-in, so they must not invent a price.
    bom: () => [],
  },
]

export const DECOR_BY_ID = new Map(DECOR.map((d) => [d.id, d]))

export function defaultParams(def: DecorDef): Params {
  const out: Params = {}
  for (const p of def.params) out[p.key] = p.default
  return out
}
