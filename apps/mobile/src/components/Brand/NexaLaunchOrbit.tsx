import React from 'react';
import Svg, {
  Circle,
  Path,
  Rect,
  type CircleProps,
  type PathProps,
  type RectProps,
} from 'react-native-svg';
import Animated, {
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

const BACK_ORBIT = 'M38 146 C74 67 268 65 302 140';
const FRONT_ORBIT = 'M39 153 C84 219 261 217 301 145';

const BACK_LENGTH = 290;
const FRONT_LENGTH = 285;

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

  const length = layer === 'back' ? BACK_LENGTH : FRONT_LENGTH;
  const d = layer === 'back' ? BACK_ORBIT : FRONT_ORBIT;

  const revealProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset: length * (1 - orbitProgress.value),
  }));

  const violetHeadProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset: length - orbitProgress.value * (length + 17),
    opacity: interpolate(
      orbitProgress.value,
      [0, 0.04, 0.9, 1],
      [0, 0.22, 0.22, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const whiteHeadProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset: length - orbitProgress.value * (length + 7),
    opacity: interpolate(
      orbitProgress.value,
      [0, 0.04, 0.92, 1],
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
      <AnimatedPath
        d={d}
        fill="none"
        stroke={
          layer === 'back'
            ? 'rgba(146,120,255,0.52)'
            : 'rgba(98,230,255,0.42)'
        }
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
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`17 ${length}`}
        animatedProps={violetHeadProps}
      />
      <AnimatedPath
        d={d}
        fill="none"
        stroke={nexaDark.textPrimary}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeDasharray={`7 ${length}`}
        animatedProps={whiteHeadProps}
      />

      {layer === 'front' ? (
        <OrbitNodes progress={progress} />
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
      r: interpolate(reveal, [0, 1], [4, 18], Extrapolation.CLAMP),
      opacity: interpolate(
        reveal,
        [0, 0.5, 1],
        [0, 0.3, 0],
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
      r: interpolate(reveal, [0, 1], [4, 19], Extrapolation.CLAMP),
      opacity: interpolate(
        reveal,
        [0, 0.5, 1],
        [0, 0.28, 0],
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
      r: interpolate(reveal, [0, 1], [4, 18], Extrapolation.CLAMP),
      opacity: interpolate(
        reveal,
        [0, 0.5, 1],
        [0, 0.26, 0],
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
      r: interpolate(reveal, [0, 1], [4, 18], Extrapolation.CLAMP),
      opacity: interpolate(
        reveal,
        [0, 0.5, 1],
        [0, 0.28, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <>
      <AnimatedCircle
        cx={61}
        cy={84}
        fill={nexaBrand.violetBright}
        animatedProps={circleHaloProps}
      />
      <AnimatedCircle
        cx={61}
        cy={84}
        r={8}
        fill={nexaBrand.symbolCore}
        stroke={nexaDark.textPrimary}
        strokeWidth={1}
        animatedProps={circleProps}
      />

      <AnimatedCircle
        cx={283}
        cy={93}
        fill={nexaBrand.violetBright}
        animatedProps={starHaloProps}
      />
      <AnimatedPath
        d="M283 81 L286 90 L295 93 L286 96 L283 105 L280 96 L271 93 L280 90 Z"
        fill={nexaDark.textPrimary}
        animatedProps={starProps}
      />
      <AnimatedCircle
        cx={283}
        cy={93}
        r={3.5}
        fill={nexaBrand.symbolCore}
        animatedProps={starCoreProps}
      />

      <AnimatedCircle
        cx={252}
        cy={201}
        fill={nexaBrand.cyanBright}
        animatedProps={squareHaloProps}
      />
      <AnimatedRect
        x={244}
        y={193}
        width={16}
        height={16}
        rx={3}
        fill="rgba(124,92,252,0.16)"
        stroke={nexaBrand.symbolCore}
        strokeWidth={2}
        animatedProps={squareProps}
      />

      <AnimatedCircle
        cx={84}
        cy={207}
        fill={nexaBrand.violetBright}
        animatedProps={diamondHaloProps}
      />
      <AnimatedRect
        x={77}
        y={200}
        width={14}
        height={14}
        rx={2}
        fill="rgba(8,9,13,0.9)"
        stroke={nexaBrand.symbolCore}
        strokeWidth={2}
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
    [launchTime(startMs), launchTime(startMs + 120)],
    [0, 1],
    Extrapolation.CLAMP,
  );
}
