import React from 'react';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  type CircleProps,
  type PathProps,
  type RectProps,
} from 'react-native-svg';
import {
  Extrapolation,
  createAnimatedComponent,
  interpolate,
  useAnimatedProps,
  useDerivedValue,
} from 'react-native-reanimated';

import { nexaBrand, nexaDark } from '@/theme';

import type { NexaReadonlyProgress } from './NexaEnergyPath';
import { NEXA_LAUNCH_VISUAL } from './nexaLaunchVisual';
import {
  launchTime,
  NEXA_LAUNCH_TIMING_MS as T,
} from './nexaLaunchTiming';

const AnimatedPath = createAnimatedComponent(Path);
const AnimatedCircle = createAnimatedComponent(Circle);
const AnimatedRect = createAnimatedComponent(Rect);

const BACK_ORBIT = 'M28 150 C72 55 276 54 314 144';
const FRONT_ORBIT = 'M31 157 C86 228 263 226 311 148';
const FRONT_SWEEP = 'M24 178 C103 114 230 112 320 176';
const BACK_GHOST = 'M20 164 C66 38 290 45 323 156';

const BACK_LENGTH = 324;
const FRONT_LENGTH = 302;
const SWEEP_LENGTH = 330;

export type NexaOrbitLayer = 'back' | 'front';

export interface NexaLaunchOrbitProps {
  progress: NexaReadonlyProgress;
  layer: NexaOrbitLayer;
}

export function NexaLaunchOrbit({
  progress,
  layer,
}: NexaLaunchOrbitProps): React.JSX.Element {
  const orbitProgress = useDerivedValue(() =>
    interpolate(
      progress.value,
      [launchTime(T.orbitDrawStart), launchTime(T.orbitComplete)],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  );

  const sweepProgress = useDerivedValue(() =>
    interpolate(
      progress.value,
      [launchTime(T.orbitDrawStart + 90), launchTime(T.orbitComplete + 40)],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  );

  const length = layer === 'back' ? BACK_LENGTH : FRONT_LENGTH;
  const d = layer === 'back' ? BACK_ORBIT : FRONT_ORBIT;
  const gradientId = `nexa-orbit-${layer}`;

  const revealProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset: length * (1 - orbitProgress.value),
  }));

  const violetHeadProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset: length - orbitProgress.value * (length + 30),
    opacity: interpolate(
      orbitProgress.value,
      [0, 0.04, 0.9, 1],
      [0, 0.48, 0.48, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const whiteHeadProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset: length - orbitProgress.value * (length + 10),
    opacity: interpolate(
      orbitProgress.value,
      [0, 0.04, 0.92, 1],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const sweepRevealProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset: SWEEP_LENGTH * (1 - sweepProgress.value),
    opacity: interpolate(
      sweepProgress.value,
      [0, 0.08, 0.86, 1],
      [0, 1, 1, 0.92],
      Extrapolation.CLAMP,
    ),
  }));

  const sweepHeadProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset:
      SWEEP_LENGTH - sweepProgress.value * (SWEEP_LENGTH + 42),
    opacity: interpolate(
      sweepProgress.value,
      [0, 0.04, 0.9, 1],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Svg
      width={340}
      height={270}
      viewBox="0 0 340 270"
      accessible={false}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={nexaBrand.violetBright} stopOpacity={0.08} />
          <Stop offset="0.28" stopColor={nexaBrand.violetBright} stopOpacity={0.9} />
          <Stop offset="0.52" stopColor="#FFFFFF" stopOpacity={0.98} />
          <Stop offset="0.72" stopColor={nexaBrand.cyanBright} stopOpacity={0.9} />
          <Stop offset="1" stopColor={nexaBrand.violetBright} stopOpacity={0.12} />
        </LinearGradient>
        <LinearGradient id="nexa-sweep" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={nexaBrand.violetBright} stopOpacity={0.04} />
          <Stop offset="0.24" stopColor={nexaBrand.violetBright} stopOpacity={0.82} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="0.68" stopColor={nexaBrand.cyanBright} stopOpacity={0.92} />
          <Stop offset="1" stopColor={nexaBrand.violetBright} stopOpacity={0.08} />
        </LinearGradient>
        <RadialGradient id="nexa-node-glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
          <Stop offset="0.28" stopColor={nexaBrand.violetBright} stopOpacity={0.66} />
          <Stop offset="1" stopColor={nexaBrand.violetBright} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {layer === 'back' ? (
        <Path
          d={BACK_GHOST}
          fill="none"
          stroke="rgba(124,92,252,0.22)"
          strokeWidth={1.1}
          strokeLinecap="round"
        />
      ) : null}

      <AnimatedPath
        d={d}
        fill="none"
        stroke={layer === 'back' ? 'rgba(124,92,252,0.16)' : 'rgba(98,230,255,0.16)'}
        strokeWidth={
          layer === 'back'
            ? NEXA_LAUNCH_VISUAL.orbitGlowBack
            : NEXA_LAUNCH_VISUAL.orbitGlowFront
        }
        strokeLinecap="round"
        strokeDasharray={`${length} ${length}`}
        animatedProps={revealProps}
      />

      <AnimatedPath
        d={d}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={
          layer === 'back'
            ? NEXA_LAUNCH_VISUAL.orbitStrokeBack
            : NEXA_LAUNCH_VISUAL.orbitStrokeFront
        }
        strokeLinecap="round"
        strokeDasharray={`${length} ${length}`}
        animatedProps={revealProps}
      />

      <AnimatedPath
        d={d}
        fill="none"
        stroke={nexaBrand.violetBright}
        strokeWidth={NEXA_LAUNCH_VISUAL.orbitAccentStroke * 2.2}
        strokeLinecap="round"
        strokeDasharray={`30 ${length}`}
        animatedProps={violetHeadProps}
      />
      <AnimatedPath
        d={d}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={NEXA_LAUNCH_VISUAL.orbitAccentStroke}
        strokeLinecap="round"
        strokeDasharray={`10 ${length}`}
        animatedProps={whiteHeadProps}
      />

      {layer === 'front' ? (
        <>
          <AnimatedPath
            d={FRONT_SWEEP}
            fill="none"
            stroke="rgba(124,92,252,0.18)"
            strokeWidth={13}
            strokeLinecap="round"
            strokeDasharray={`${SWEEP_LENGTH} ${SWEEP_LENGTH}`}
            animatedProps={sweepRevealProps}
          />
          <AnimatedPath
            d={FRONT_SWEEP}
            fill="none"
            stroke="url(#nexa-sweep)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${SWEEP_LENGTH} ${SWEEP_LENGTH}`}
            animatedProps={sweepRevealProps}
          />
          <AnimatedPath
            d={FRONT_SWEEP}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={4.3}
            strokeLinecap="round"
            strokeDasharray={`14 ${SWEEP_LENGTH}`}
            animatedProps={sweepHeadProps}
          />
          <OrbitNodes progress={progress} />
        </>
      ) : null}
    </Svg>
  );
}

interface OrbitNodesProps {
  progress: NexaReadonlyProgress;
}

function OrbitNodes({
  progress,
}: OrbitNodesProps): React.JSX.Element {
  const circleProps = useAnimatedProps<CircleProps>(() => ({
    opacity: nodeReveal(progress.value, T.node1),
  }));
  const circleHaloProps = useAnimatedProps<CircleProps>(() => {
    const reveal = nodeReveal(progress.value, T.node1);
    return {
      r: interpolate(reveal, [0, 1], [4, 24], Extrapolation.CLAMP),
      opacity: interpolate(
        reveal,
        [0, 0.5, 1],
        [0, 0.52, 0.12],
        Extrapolation.CLAMP,
      ),
    };
  });

  const starProps = useAnimatedProps<PathProps>(() => ({
    opacity: nodeReveal(progress.value, T.node2),
  }));
  const starCoreProps = useAnimatedProps<CircleProps>(() => ({
    opacity: nodeReveal(progress.value, T.node2),
  }));
  const starHaloProps = useAnimatedProps<CircleProps>(() => {
    const reveal = nodeReveal(progress.value, T.node2);
    return {
      r: interpolate(reveal, [0, 1], [4, 25], Extrapolation.CLAMP),
      opacity: interpolate(
        reveal,
        [0, 0.5, 1],
        [0, 0.48, 0.1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const squareProps = useAnimatedProps<RectProps>(() => ({
    opacity: nodeReveal(progress.value, T.node3),
  }));
  const squareHaloProps = useAnimatedProps<CircleProps>(() => {
    const reveal = nodeReveal(progress.value, T.node3);
    return {
      r: interpolate(reveal, [0, 1], [4, 23], Extrapolation.CLAMP),
      opacity: interpolate(
        reveal,
        [0, 0.5, 1],
        [0, 0.42, 0.08],
        Extrapolation.CLAMP,
      ),
    };
  });

  const diamondProps = useAnimatedProps<RectProps>(() => ({
    opacity: nodeReveal(progress.value, T.node4),
  }));
  const diamondHaloProps = useAnimatedProps<CircleProps>(() => {
    const reveal = nodeReveal(progress.value, T.node4);
    return {
      r: interpolate(reveal, [0, 1], [4, 23], Extrapolation.CLAMP),
      opacity: interpolate(
        reveal,
        [0, 0.5, 1],
        [0, 0.44, 0.08],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <>
      <AnimatedCircle
        cx={61}
        cy={84}
        fill="url(#nexa-node-glow)"
        animatedProps={circleHaloProps}
      />
      <AnimatedCircle
        cx={61}
        cy={84}
        r={9}
        fill={nexaBrand.symbolCore}
        stroke={nexaDark.textPrimary}
        strokeWidth={1.2}
        animatedProps={circleProps}
      />

      <AnimatedCircle
        cx={283}
        cy={93}
        fill="url(#nexa-node-glow)"
        animatedProps={starHaloProps}
      />
      <AnimatedPath
        d="M283 79 L286.5 89.5 L297 93 L286.5 96.5 L283 107 L279.5 96.5 L269 93 L279.5 89.5 Z"
        fill={nexaDark.textPrimary}
        animatedProps={starProps}
      />
      <AnimatedCircle
        cx={283}
        cy={93}
        r={3.8}
        fill={nexaBrand.symbolCore}
        animatedProps={starCoreProps}
      />

      <AnimatedCircle
        cx={252}
        cy={201}
        fill="url(#nexa-node-glow)"
        animatedProps={squareHaloProps}
      />
      <AnimatedRect
        x={243}
        y={192}
        width={18}
        height={18}
        rx={3.5}
        fill="rgba(124,92,252,0.2)"
        stroke={nexaBrand.symbolCore}
        strokeWidth={2.2}
        animatedProps={squareProps}
      />

      <AnimatedCircle
        cx={84}
        cy={207}
        fill="url(#nexa-node-glow)"
        animatedProps={diamondHaloProps}
      />
      <AnimatedRect
        x={76.5}
        y={199.5}
        width={15}
        height={15}
        rx={2}
        fill="rgba(8,9,13,0.78)"
        stroke={nexaBrand.symbolCore}
        strokeWidth={2.2}
        transform="rotate(45 84 207)"
        animatedProps={diamondProps}
      />
    </>
  );
}

function nodeReveal(progress: number, startMs: number): number {
  'worklet';
  return interpolate(
    progress,
    [launchTime(startMs), launchTime(startMs + 145)],
    [0, 1],
    Extrapolation.CLAMP,
  );
}
