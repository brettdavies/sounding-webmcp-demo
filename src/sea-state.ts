/**
 * Sea state for keel-1 at Mavericks approaches.
 * Archetypal compressed heat (not a dated contest day).
 */

import raw from './data/mavericks-heat.json';

export type SpectralComponent = {
  f_hz?: number;
  period_s: number;
  energy?: number;
  amplitude_m: number;
  direction_deg: number;
  steepness?: number;
};

export type SeaSample = {
  t: string;
  t_local?: string;
  wave_height_m: number;
  wave_period_s: number;
  wave_dir_deg: number;
  heave_m: number;
  pitch_deg: number;
  roll_deg: number;
  depth_m: number;
  face_m?: number;
};

export type Reading = {
  meters: number;
  station: string;
  place: string;
  as_of: string;
  as_of_local: string;
  source: string;
  buoy: string;
  event: {
    name: string;
    window_local: string;
    morning_note: string;
    afternoon_note: string;
    featured_phase: 'morning_high_tide' | 'afternoon_low_tide';
  };
  tide: {
    stage: string;
    approx_ft: number;
  };
  wind?: {
    direction_deg: number | null;
    speed_ms: number | null;
    gust_ms: number | null;
  };
  wave: {
    height_m: number;
    period_s: number;
    direction_deg: number;
    face_m?: number;
    direction_note?: string;
  };
  attitude: {
    heave_m: number;
    pitch_deg: number;
    roll_deg: number;
  };
  components?: SpectralComponent[];
  history: SeaSample[];
  loop_sec?: number;
  wave_gap_sec?: [number, number];
  sets?: Array<{ label: string; faces_m: number[] }>;
  swell?: { direction_deg: number; period_s: number; direction_note?: string };
  credits?: Record<string, string>;
};

type Dataset = {
  station: string;
  place: string;
  buoy: string;
  source: string;
  loop_sec: number;
  wave_gap_sec?: [number, number];
  as_of: string;
  as_of_local: string;
  meters: number;
  wave: Reading['wave'];
  attitude: Reading['attitude'];
  tide: Reading['tide'];
  event: Reading['event'];
  sets: Array<{ label: string; faces_m: number[] }>;
  credits?: Record<string, string>;
  swell?: { direction_deg: number; period_s: number };
};

const data = raw as Dataset;

/** Flatten set faces into a heat timeline for clients that want a list. */
function buildHistory(): SeaSample[] {
  const faces = data.sets.flatMap((s) => s.faces_m);
  const gap = 6;
  return faces.map((face, i) => ({
    t: `heat+${(i * gap).toFixed(0)}s`,
    t_local: `wave ${i + 1}`,
    wave_height_m: face,
    wave_period_s: data.swell?.period_s ?? data.wave.period_s,
    wave_dir_deg: data.swell?.direction_deg ?? data.wave.direction_deg,
    face_m: face,
    heave_m: 0,
    pitch_deg: 0,
    roll_deg: 0,
    depth_m: data.meters,
  }));
}

export function getReading(): Reading {
  return {
    meters: data.meters,
    station: data.station,
    place: data.place,
    as_of: data.as_of,
    as_of_local: data.as_of_local,
    source: data.source,
    buoy: data.buoy,
    event: data.event,
    tide: data.tide,
    wave: {
      ...data.wave,
      height_m: data.wave.face_m ?? data.wave.height_m,
    },
    attitude: data.attitude,
    history: buildHistory(),
    loop_sec: data.loop_sec,
    wave_gap_sec: data.wave_gap_sec as [number, number] | undefined,
    sets: data.sets,
    swell: data.swell,
    credits: data.credits,
  };
}
