import { DECOR_BY_ID, defaultParams } from '../decor/registry'
import type { DecorInstance, Space, Venue } from '../types'

export interface Template {
  id: string
  label: string
  blurb: string
  venue: Venue
  /** Params here are overrides on top of each generator's defaults. */
  items: { type: string; position: [number, number, number]; rotationY?: number; params?: Record<string, number | string> }[]
}

/**
 * Starter scenes.
 *
 * The target user is a student who has never built a 3D scene. Opening to an
 * empty grid is where they quit; opening to a finished sangeet stage they can
 * take apart is where they learn what the tool can do.
 */
export const TEMPLATES: Template[] = [
  {
    id: 'sangeet-stage',
    label: 'Sangeet stage',
    blurb: 'Indoor hall, raised stage, balloon garland and fairy lights.',
    venue: { mode: 'indoor', width: 13, depth: 10, height: 4.2 },
    items: [
      { type: 'stage', position: [0, 0, -3.4], params: { width: 6, depth: 3, height: 0.45, topColor: '#7d2b46' } },
      { type: 'backdrop', position: [0, 0.45, -4.6], params: { width: 4.2, height: 2.9, shape: 'arch', color: '#efe0cc' } },
      { type: 'balloon-arch', position: [0, 1.9, -4.4], params: { span: 5.2, rise: 1.5, density: 7, palette: 'blush' } },
      { type: 'fairy-lights', position: [0, 3.6, -1.2], params: { span: 9, sag: 0.9, strands: 4 } },
      { type: 'fairy-lights', position: [0, 3.6, 1.4], params: { span: 9, sag: 0.9, strands: 4 } },
      { type: 'drape', position: [-6.4, 0, -2], rotationY: Math.PI / 2, params: { width: 3, height: 4, folds: 9 } },
      { type: 'drape', position: [6.4, 0, -2], rotationY: -Math.PI / 2, params: { width: 3, height: 4, folds: 9 } },
      { type: 'chair-row', position: [0, 0, 1.4], params: { count: 12, curve: 14 } },
      { type: 'chair-row', position: [0, 0, 2.4], params: { count: 12, curve: 14 } },
      { type: 'uplighter', position: [-3.2, 0, -4.6], params: { color: '#c46bff' } },
      { type: 'uplighter', position: [3.2, 0, -4.6], params: { color: '#c46bff' } },
    ],
  },
  {
    id: 'haldi-lawn',
    label: 'Haldi lawn',
    blurb: 'Outdoor daytime setup with marigold hangings and a mandap.',
    venue: { mode: 'outdoor', width: 16, depth: 13, height: 4 },
    items: [
      { type: 'mandap', position: [0, 0, -2.4], params: { width: 3.6, depth: 3.6, height: 3 } },
      { type: 'marigold-strings', position: [0, 3.0, -2.4], params: { width: 3.4, drop: 1.5, count: 22 } },
      { type: 'marigold-strings', position: [-4.5, 3.2, 0], params: { width: 3, drop: 2.2, count: 16 } },
      { type: 'marigold-strings', position: [4.5, 3.2, 0], params: { width: 3, drop: 2.2, count: 16 } },
      { type: 'floral-arch', position: [0, 0, 3.6], params: { span: 3.2, rise: 2.6, palette: 'marigold' } },
      { type: 'pillar', position: [-1.6, 0, 1.6], params: { palette: 'marigold' } },
      { type: 'pillar', position: [1.6, 0, 1.6], params: { palette: 'marigold' } },
      { type: 'pillar', position: [-1.6, 0, 0.2], params: { palette: 'marigold' } },
      { type: 'pillar', position: [1.6, 0, 0.2], params: { palette: 'marigold' } },
    ],
  },
  {
    id: 'reception',
    label: 'Reception',
    blurb: 'Banquet hall with guest tables, backdrop and ceiling drapes.',
    venue: { mode: 'indoor', width: 16, depth: 12, height: 4.5 },
    items: [
      { type: 'stage', position: [0, 0, -4.2], params: { width: 5, depth: 2.6, height: 0.5, topColor: '#2b3a52' } },
      { type: 'backdrop', position: [0, 0.5, -5.2], params: { width: 3.6, height: 3, shape: 'arch', color: '#f4efe6' } },
      { type: 'floral-arch', position: [0, 0.5, -5.0], params: { span: 3.4, rise: 2.6, palette: 'white' } },
      { type: 'ceiling-swoop', position: [0, 0, 1], params: { radius: 4.5, height: 4.4, panels: 14 } },
      { type: 'round-table', position: [-3.6, 0, 0.4], params: { seats: 8 } },
      { type: 'round-table', position: [0, 0, 1.6], params: { seats: 8 } },
      { type: 'round-table', position: [3.6, 0, 0.4], params: { seats: 8 } },
      { type: 'round-table', position: [-3.6, 0, 4], params: { seats: 8 } },
      { type: 'round-table', position: [3.6, 0, 4], params: { seats: 8 } },
      { type: 'fairy-lights', position: [0, 4.0, -2], params: { span: 12, sag: 1.1, strands: 5 } },
    ],
  },
  {
    id: 'birthday-hall',
    label: 'Birthday hall',
    blurb: 'Small room, balloon columns, arch and a cake table.',
    venue: { mode: 'indoor', width: 8, depth: 7, height: 3.2 },
    items: [
      { type: 'balloon-arch', position: [0, 0.9, -3.1], params: { span: 4, rise: 1.4, density: 8, palette: 'pastel' } },
      { type: 'balloon-column', position: [-2.4, 0, -2.6], params: { height: 2, palette: 'pastel' } },
      { type: 'balloon-column', position: [2.4, 0, -2.6], params: { height: 2, palette: 'pastel' } },
      { type: 'backdrop', position: [0, 0, -3.3], params: { width: 2.4, height: 2.4, shape: 'rect', color: '#e9d8e8' } },
      { type: 'round-table', position: [0, 0, -1.4], params: { diameter: 1.1, seats: 4, cloth: '#f7e9f2' } },
      { type: 'floral-swag', position: [0, 0.78, -1.4], params: { span: 1.1, sag: 0.2, palette: 'pastel' } },
      { type: 'fairy-lights', position: [0, 2.8, -1], params: { span: 6, sag: 0.5, strands: 2 } },
    ],
  },
]

export function instantiate(template: Template): DecorInstance[] {
  return template.items.map((spec) => {
    const def = DECOR_BY_ID.get(spec.type)
    return {
      id: crypto.randomUUID(),
      type: spec.type,
      position: spec.position,
      rotationY: spec.rotationY ?? 0,
      params: def ? { ...defaultParams(def), ...spec.params } : { ...spec.params },
    }
  })
}

/** A template becomes a fully-formed space, ready to drop into a project. */
export function templateSpace(template: Template): Space {
  return {
    id: crypto.randomUUID(),
    name: template.label,
    venue: { ...template.venue },
    pins: [],
    items: instantiate(template),
    // Templates ship with real-world dimensions already set.
    calibrated: true,
    lighting: template.id === 'haldi-lawn' ? 'day' : 'evening',
  }
}
