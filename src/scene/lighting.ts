import type { LightingPreset } from '../store/sceneStore'

export interface LightingSpec {
  label: string
  /** Multiplied over every surface — carries the mood onto photo-textured walls. */
  tint: string
  wall: string
  floor: string
  ambient: number
  ambientColor: string
  keyIntensity: number
  keyColor: string
  background: string
  fog: string
  /** Warm practical lights come on for the evening and night presets. */
  practicals: boolean
}

/**
 * Decorators sell ambience, not geometry — the same balloon arch reads
 * completely differently at noon and at 8pm, so these presets are a headline
 * feature rather than polish.
 */
export const LIGHTING: Record<LightingPreset, LightingSpec> = {
  day: {
    label: 'Daylight',
    tint: '#ffffff',
    wall: '#d9dde4',
    floor: '#b8bcc4',
    ambient: 1.1,
    ambientColor: '#dce6f5',
    keyIntensity: 1.5,
    keyColor: '#fffaf0',
    background: '#cfd8e6',
    fog: '#cfd8e6',
    practicals: false,
  },
  golden: {
    label: 'Golden hour',
    tint: '#ffd9a8',
    wall: '#d3c6b4',
    floor: '#ab9c88',
    ambient: 0.75,
    ambientColor: '#ffcf9a',
    keyIntensity: 1.9,
    keyColor: '#ffb163',
    background: '#e8a765',
    fog: '#e8a765',
    practicals: false,
  },
  evening: {
    label: 'Evening',
    tint: '#f0d3b0',
    wall: '#5c5a5e',
    floor: '#3f3d42',
    ambient: 0.42,
    ambientColor: '#6b7fa8',
    keyIntensity: 0.7,
    keyColor: '#ffc98a',
    background: '#1a1d26',
    fog: '#1a1d26',
    practicals: true,
  },
  night: {
    label: 'Night',
    tint: '#c9bce0',
    wall: '#33323a',
    floor: '#232228',
    ambient: 0.26,
    ambientColor: '#4a5b8c',
    keyIntensity: 0.35,
    keyColor: '#9fb4ff',
    background: '#0b0d13',
    fog: '#0b0d13',
    practicals: true,
  },
}
