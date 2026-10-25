import React from 'react';
import Svg, {
  Circle,
  Line,
  type CircleProps,
  type LineProps,
} from 'react-native-svg';
import Animated, {
  Extrapolation,
  createAnimatedComponent,
  interpolate,
  useAnimatedProps,
  useDerivedValue,
} from 'react-native-reanimated';

import { nexaBrand, nexaDark } from '@/theme';

import {
  NexaEnergyPath,
  type NexaReadonlyProgress,
} from './NexaEnergyPath';
import { NEXA_LAUNCH_VISUAL } from './nexaLaunchVisual';
import {
  launchTime,
  NEXA_LAUNCH_TIMING_MS as T,
} from './nexaLaunchTiming';
import {
  NEXA_EYE,
  NEXA_EYE_PATH_LENGTH,
  NEXA_SYMBOL_VIEWBOX,
} from './nexaSymbolGeometry';

const AnimatedCircle = createAnimatedComponent(Circle);
const AnimatedLine = createAnimatedComponent(Line);

export interface NexaAnimatedSymbolProps {
  progress: NexaReadonlyProgress;
  size?: number;
}

export function NexaAnimatedSymbol({
  progress,
  size = NEXA_LAUNCH_VISUAL.symbolSize,
}: NexaAnimatedSymbolProps): React.JSX.Element {
  const upperProgress = useDerivedValue(() =>
    interpolate(
      progress.value,
      [launchTime(T.eyeDrawStart), launchTime(T.eyeComplete)],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  );

  const irisProgress = useDerivedValue(() =>
    interpolate(
      progress.value,
      [launchTime(T.irisDrawStart), launchTime(T.eyeComplete + 40)],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  );

  const lowerProgress = useDerivedValue(() =>
    interpolate(
      progress.value,
      [launchTime(T.lowerLidDrawStart), launchTime(T.eyeComplete + 70)],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  );

  const irisProps = useAnimatedProps<CircleProps>(() => ({
    strokeDashoffset:
      NEXA_EYE_PATH_LENGTH.iris * (1 - irisProgress.value),
    opacity: interpolate(
      irisProgress.value,
      [0, 0.12, 1],
      [0, 0.58, 0.82],
      Extrapolation.CLAMP,
    ),
  }));

  const outerHaloProps = useAnimatedProps<CircleProps>(() => {
    const ignition = interpolate(
      progress.value,
      [
        launchTime(T.pupilIgnition),
        launchTime(125),
        launchTime(220),
      ],
      [0, 1, 0.38],
      Extrapolation.CLAMP,
    );

    return {
      r: interpolate(ignition, [0, 1], [3, 33]),
      opacity: interpolate(ignition, [0, 1], [0, 0.19]),
    };
  });

  const innerHaloProps = useAnimatedProps<CircleProps>(() => {
    const ignition = interpolate(
      progress.value,
      [
        launchTime(T.pupilIgnition),
        launchTime(120),
        launchTime(230),
      ],
      [0, 1, 0.44],
      Extrapolation.CLAMP,
    );

    return {
      r: interpolate(ignition, [0, 1], [2, 21]),
      opacity: interpolate(ignition, [0, 1], [0, 0.28]),
    };
  });

  const pupilProps = useAnimatedProps<CircleProps>(() => {
    const radius = interpolate(
      progress.value,
      [
        launchTime(T.pupilIgnition),
        launchTime(125),
        launchTime(210),
      ],
      [1, NEXA_EYE.pupilRadius * 1.17, NEXA_EYE.pupilRadius],
      Extrapolation.CLAMP,
    );

    return {
      r: radius,
      opacity: interpolate(
        progress.value,
        [launchTime(T.pupilIgnition), launchTime(100)],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const hotCoreProps = useAnimatedProps<CircleProps>(() => ({
    r: interpolate(
      progress.value,
      [launchTime(T.pupilIgnition), launchTime(130)],
      [0, 4.2],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(
      progress.value,
      [launchTime(T.pupilIgnition), launchTime(115)],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const rayProps = useAnimatedProps<LineProps>(() => ({
    opacity: interpolate(
      progress.value,
      [
        launchTime(T.pupilIgnition),
        launchTime(85),
        launchTime(145),
        launchTime(230),
      ],
      [0, 0.92, 0.72, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${NEXA_SYMBOL_VIEWBOX} ${NEXA_SYMBOL_VIEWBOX}`}
      accessible={false}
      pointerEvents="none"
    >
      <AnimatedLine
        x1={80}
        y1={68}
        x2={80}
        y2={56}
        stroke={nexaDark.textPrimary}
        strokeWidth={1.3}
        animatedProps={rayProps}
      />
      <AnimatedLine
        x1={69}
        y1={73}
        x2={60}
        y2={66}
        stroke={nexaBrand.violetBright}
        strokeWidth={1.3}
        animatedProps={rayProps}
      />
      <AnimatedLine
        x1={91}
        y1={73}
        x2={100}
        y2={66}
        stroke={nexaBrand.cyanBright}
        strokeWidth={1.3}
        animatedProps={rayProps}
      />

      <AnimatedCircle
        cx={NEXA_EYE.centerX}
        cy={NEXA_EYE.centerY}
        fill={nexaBrand.violetBright}
        animatedProps={outerHaloProps}
      />
      <AnimatedCircle
        cx={NEXA_EYE.centerX}
        cy={NEXA_EYE.centerY}
        fill={nexaBrand.cyanBright}
        animatedProps={innerHaloProps}
      />

      <AnimatedCircle
        cx={NEXA_EYE.centerX}
        cy={NEXA_EYE.centerY}
        r={NEXA_EYE.irisRadius}
        fill="rgba(8,9,13,0.48)"
        stroke={nexaBrand.symbolCore}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={`${NEXA_EYE_PATH_LENGTH.iris} ${NEXA_EYE_PATH_LENGTH.iris}`}
        animatedProps={irisProps}
      />

      <NexaEnergyPath
        d={NEXA_EYE.upperLeft}
        length={NEXA_EYE_PATH_LENGTH.upper}
        progress={upperProgress}
        width={NEXA_LAUNCH_VISUAL.upperStroke}
      />
      <NexaEnergyPath
        d={NEXA_EYE.upperRight}
        length={NEXA_EYE_PATH_LENGTH.upper}
        progress={upperProgress}
        width={NEXA_LAUNCH_VISUAL.upperStroke}
      />

      <NexaEnergyPath
        d={NEXA_EYE.lowerLeft}
        length={NEXA_EYE_PATH_LENGTH.lower}
        progress={lowerProgress}
        width={NEXA_LAUNCH_VISUAL.lowerStroke}
        opacity={0.72}
      />
      <NexaEnergyPath
        d={NEXA_EYE.lowerRight}
        length={NEXA_EYE_PATH_LENGTH.lower}
        progress={lowerProgress}
        width={NEXA_LAUNCH_VISUAL.lowerStroke}
        opacity={0.72}
      />

      <AnimatedCircle
        cx={NEXA_EYE.centerX}
        cy={NEXA_EYE.centerY}
        fill={nexaBrand.symbolCore}
        stroke={nexaDark.textPrimary}
        strokeWidth={1}
        animatedProps={pupilProps}
      />
      <AnimatedCircle
        cx={NEXA_EYE.centerX}
        cy={NEXA_EYE.centerY}
        fill="#FFFFFF"
        animatedProps={hotCoreProps}
      />
    </Svg>
  );
}
