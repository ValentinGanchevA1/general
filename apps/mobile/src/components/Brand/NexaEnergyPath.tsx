import React from 'react';
import { Path, type PathProps } from 'react-native-svg';
import Animated, {
  Extrapolation,
  createAnimatedComponent,
  interpolate,
  type SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';

import { nexaBrand, nexaDark } from '@/theme';

import { NEXA_LAUNCH_VISUAL } from './nexaLaunchVisual';

const AnimatedPath = createAnimatedComponent(Path);

export interface NexaEnergyPathProps {
  d: string;
  length: number;
  progress: SharedValue<number>;
  width: number;
  opacity?: number;
}

export function NexaEnergyPath({
  d,
  length,
  progress,
  width,
  opacity = 1,
}: NexaEnergyPathProps): React.JSX.Element {
  const revealProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset: length * (1 - progress.value),
    opacity,
  }));

  const violetHeadProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset:
      length -
      progress.value *
        (length + NEXA_LAUNCH_VISUAL.energyVioletLength),
    opacity: interpolate(
      progress.value,
      [0, 0.04, 0.9, 1],
      [0, 0.24, 0.24, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const cyanHeadProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset:
      length -
      progress.value *
        (length + NEXA_LAUNCH_VISUAL.energyCyanLength),
    opacity: interpolate(
      progress.value,
      [0, 0.04, 0.9, 1],
      [0, 0.34, 0.34, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const whiteHeadProps = useAnimatedProps<PathProps>(() => ({
    strokeDashoffset:
      length -
      progress.value *
        (length + NEXA_LAUNCH_VISUAL.energyWhiteLength),
    opacity: interpolate(
      progress.value,
      [0, 0.03, 0.92, 1],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <>
      <AnimatedPath
        d={d}
        fill="none"
        stroke="rgba(124,92,252,0.11)"
        strokeWidth={width * 2.3}
        strokeLinecap="round"
        strokeDasharray={`${length} ${length}`}
        animatedProps={revealProps}
      />

      <AnimatedPath
        d={d}
        fill="none"
        stroke="rgba(98,230,255,0.13)"
        strokeWidth={width * 1.55}
        strokeLinecap="round"
        strokeDasharray={`${length} ${length}`}
        animatedProps={revealProps}
      />

      <AnimatedPath
        d={d}
        fill="none"
        stroke={nexaDark.textPrimary}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={`${length} ${length}`}
        animatedProps={revealProps}
      />

      <AnimatedPath
        d={d}
        fill="none"
        stroke={nexaBrand.violetBright}
        strokeWidth={width * 2}
        strokeLinecap="round"
        strokeDasharray={`${NEXA_LAUNCH_VISUAL.energyVioletLength} ${length}`}
        animatedProps={violetHeadProps}
      />

      <AnimatedPath
        d={d}
        fill="none"
        stroke={nexaBrand.cyanBright}
        strokeWidth={width * 1.45}
        strokeLinecap="round"
        strokeDasharray={`${NEXA_LAUNCH_VISUAL.energyCyanLength} ${length}`}
        animatedProps={cyanHeadProps}
      />

      <AnimatedPath
        d={d}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={width * 0.95}
        strokeLinecap="round"
        strokeDasharray={`${NEXA_LAUNCH_VISUAL.energyWhiteLength} ${length}`}
        animatedProps={whiteHeadProps}
      />
    </>
  );
}
