export const NEXA_LAUNCH_TIMING_MS = {
  pupilIgnition: 40,

  eyeDrawStart: 130,
  irisDrawStart: 210,
  lowerLidDrawStart: 270,
  eyeComplete: 450,

  orbitDrawStart: 460,
  orbitComplete: 710,

  node1: 580,
  node2: 620,
  node3: 660,
  node4: 700,

  convergenceStart: 700,
  convergencePeak: 735,
  convergenceEnd: 805,

  wordmarkReveal: 810,
  wordmarkComplete: 1050,

  entranceComplete: 1080,
} as const;

export const NEXA_REDUCED_MOTION_TIMING_MS = {
  entranceComplete: 220,
  exit: 160,
} as const;

export function launchTime(milliseconds: number): number {
  return milliseconds / NEXA_LAUNCH_TIMING_MS.entranceComplete;
}
