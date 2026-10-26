import React from 'react';
import Svg, {
  Circle,
  Defs,
  Line,
  RadialGradient,
  Stop,
  type CircleProps,
  type LineProps,
} from 'react-native-svg';
import {
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
      [0, 0.72, 0.95],
      Extrapolation.CLAMP,
    ),
  }));

  const lensRingProps = useAnimatedProps<CircleProps>(() => ({
    opacity: interpolate(
      irisProgress.value,
      [0, 0.32, 1],
      [0, 0.28, 0.68],
      Extrapolation.CLAMP,
    ),
  }));

  const outerHaloProps = useAnimatedProps<CircleProps>(() => {
    const ignition = interpolate(
      progress.value,
      [
        launchTime(T.pupilIgnition),
        launchTime(150),
        launchTime(300),
      ],
      [0, 1, 0.58],
      Extrapolation.CLAMP,
    );

    return {
      r: interpolate(ignition, [0, 1], [3, 42]),
      opacity: interpolate(ignition, [0, 1], [0, 0.72]),
    };
  });

  const innerHaloProps = useAnimatedProps<CircleProps>(() => {
    const ignition = interpolate(
      progress.value,
      [
        launchTime(T.pupilIgnition),
        launchTime(145),
        launchTime(315),
      ],
      [0, 1, 0.68],
      Extrapolation.CLAMP,
    );

    return {
      r: interpolate(ignition, [0, 1], [2, 28]),
      opacity: interpolate(ignition, [0, 1], [0, 0.78]),
    };
  });

  const pupilProps = useAnimatedProps<CircleProps>(() => {
    const radius = interpolate(
      progress.value,
      [
        launchTime(T.pupilIgnition),
        launchTime(155),
        launchTime(260),
      ],
      [1, NEXA_EYE.pupilRadius * 1.22, NEXA_EYE.pupilRadius * 1.06],
      Extrapolation.CLAMP,
    );

    return {
      r: radius,
      opacity: interpolate(
        progress.value,
        [launchTime(T.pupilIgnition), launchTime(125)],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const hotCoreProps = useAnimatedProps<CircleProps>(() => ({
    r: interpolate(
      progress.value,
      [launchTime(T.pupilIgnition), launchTime(160)],
      [0, 4.8],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(
      progress.value,
      [launchTime(T.pupilIgnition), launchTime(140)],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const rayProps = useAnimatedProps<LineProps>(() => ({
    opacity: interpolate(
      progress.value,
      [
        launchTime(T.pupilIgnition),
        launchTime(110),
        launchTime(190),
        launchTime(330),
      ],
      [0, 1, 0.78, 0],
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
      <Defs>
        <RadialGradient id="nexa-iris-aura" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.96} />
          <Stop offset="0.22" stopColor="#DCD3FF" stopOpacity={0.92} />
          <Stop offset="0.5" stopColor={nexaBrand.violetBright} stopOpacity={0.72} />
          <Stop offset="0.76" stopColor={nexaBrand.cyanBright} stopOpacity={0.22} />
          <Stop offset="1" stopColor={nexaBrand.violetBright} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="nexa-pupil-core" cx="48%" cy="44%" r="56%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="0.38" stopColor="#F1ECFF" stopOpacity={1} />
          <Stop offset="0.72" stopColor={nexaBrand.symbolCore} stopOpacity={1} />
          <Stop offset="1" stopColor={nexaBrand.violetBright} stopOpacity={0.96} />
        </RadialGradient>
      </Defs>

      <AnimatedLine
        x1={80}
        y1={67}
        x2={80}
        y2={53}
        stroke="#FFFFFF"
        strokeWidth={1.5}
        animatedProps={rayProps}
      />
      <AnimatedLine
        x1={69}
        y1={73}
        x2={59}
        y2={65}
        stroke={nexaBrand.violetBright}
        strokeWidth={1.4}
        animatedProps={rayProps}
      />
      <AnimatedLine
        x1={91}
        y1={73}
        x2={101}
        y2={65}
        stroke={nexaBrand.cyanBright}
        strokeWidth={1.4}
        animatedProps={rayProps}
      />

      <AnimatedCircle
        cx={NEXA_EYE.centerX}
        cy={NEXA_EYE.centerY}
        fill="url(#nexa-iris-aura)"
        animatedProps={outerHaloProps}
      />
      <AnimatedCircle
        cx={NEXA_EYE.centerX}
        cy={NEXA_EYE.centerY}
        fill="url(#nexa-iris-aura)"
        animatedProps={innerHaloProps}
      />

      <AnimatedCircle
        cx={NEXA_EYE.centerX}
        cy={NEXA_EYE.centerY}
        r={36}
        fill="none"
        stroke="rgba(146,120,255,0.28)"
        strokeWidth={1.1}
        animatedProps={lensRingProps}
      />
      <AnimatedCircle
        cx={NEXA_EYE.centerX}
        cy={NEXA_EYE.centerY}
        r={31.5}
        fill="none"
        stroke="rgba(98,230,255,0.18)"
        strokeWidth={0.9}
        animatedProps={lensRingProps}
      />

      <AnimatedCircle
        cx={NEXA_EYE.centerX}
        cy={NEXA_EYE.centerY}
        r={NEXA_EYE.irisRadius}
        fill="rgba(8,9,13,0.34)"
        stroke={nexaBrand.symbolCore}
        strokeWidth={2.2}
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
        opacity={0.82}
      />
      <NexaEnergyPath
        d={NEXA_EYE.lowerRight}
        length={NEXA_EYE_PATH_LENGTH.lower}
        progress={lowerProgress}
        width={NEXA_LAUNCH_VISUAL.lowerStroke}
        opacity={0.82}
      />

      <AnimatedCircle
        cx={NEXA_EYE.centerX}
        cy={NEXA_EYE.centerY}
        fill="url(#nexa-pupil-core)"
        stroke="#FFFFFF"
        strokeWidth={1.15}
        animatedProps={pupilProps}
      />
      <AnimatedCircle
        cx={NEXA_EYE.centerX - 2.2}
        cy={NEXA_EYE.centerY - 2.4}
        fill="#FFFFFF"
        animatedProps={hotCoreProps}
      />
    </Svg>
  );
}
