export const NEXA_LAUNCH_TIMING_MS = {
  pupilIgnition: 60,

  eyeDrawStart: 160,
  irisDrawStart: 245,
  lowerLidDrawStart: 330,
  eyeComplete: 610,

  orbitDrawStart: 500,
  orbitComplete: 1040,

  node1: 740,
  node2: 810,
  node3: 900,
  node4: 980,

  convergenceStart: 1040,
  convergencePeak: 1110,
  convergenceEnd: 1190,

  wordmarkReveal: 1140,
  wordmarkComplete: 1380,

  entranceComplete: 1450,
} as const;

export const NEXA_REDUCED_MOTION_TIMING_MS = {
  entranceComplete: 220,
  exit: 160,
} as const;

export function launchTime(milliseconds: number): number {
  'worklet';
  return milliseconds / NEXA_LAUNCH_TIMING_MS.entranceComplete;
}
