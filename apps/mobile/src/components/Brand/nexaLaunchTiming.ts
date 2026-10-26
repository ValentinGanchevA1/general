export const NEXA_LAUNCH_TIMING_MS = {
  pupilIgnition: 50,

  eyeDrawStart: 120,
  irisDrawStart: 185,
  lowerLidDrawStart: 245,
  eyeComplete: 445,

  orbitDrawStart: 455,
  orbitComplete: 760,

  node1: 590,
  node2: 640,
  node3: 690,
  node4: 735,

  convergenceStart: 760,
  convergencePeak: 810,
  convergenceEnd: 865,

  wordmarkReveal: 890,
  wordmarkComplete: 1040,

  entranceComplete: 1080,
} as const;

export const NEXA_REDUCED_MOTION_TIMING_MS = {
  entranceComplete: 220,
  exit: 160,
} as const;

export function launchTime(milliseconds: number): number {
  'worklet';
  return milliseconds / NEXA_LAUNCH_TIMING_MS.entranceComplete;
}
