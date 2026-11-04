import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

/**
 * Horizontal NEXA lockup based on the approved magenta-to-violet artwork.
 * The eye is built from open, rounded arcs and a luminous iris rather than
 * a closed diamond; layered vector strokes give it a native-safe soft glow.
 */
export function NexaWordmark(): React.JSX.Element {
  const id = useId().replaceAll(':', '');
  const lettersId = `nexa-wordmark-letters-${id}`;
  const eyeId = `nexa-wordmark-eye-${id}`;
  const pupilId = `nexa-wordmark-pupil-${id}`;

  const upperLid = 'M282 33C302 3 344 3 365 33';
  const lowerLeft = 'M289 47C301 58 310 63 319 64';
  const lowerRight = 'M326 64C337 61 348 56 359 47';

  return (
    <View style={styles.root} accessible accessibilityRole="image" accessibilityLabel="NEXA">
      <Svg width="100%" height="100%" viewBox="0 0 378 72" accessible={false}>
        <Defs>
          <LinearGradient id={lettersId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#EC35E9" />
            <Stop offset="42%" stopColor="#8241FA" />
            <Stop offset="72%" stopColor="#AE4DF8" />
            <Stop offset="100%" stopColor="#CF90FF" />
          </LinearGradient>
          <LinearGradient id={eyeId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#A75CFF" />
            <Stop offset="50%" stopColor="#8F46FF" />
            <Stop offset="100%" stopColor="#A96AFF" />
          </LinearGradient>
          <RadialGradient id={pupilId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="55%" stopColor="#F7E9FF" />
            <Stop offset="100%" stopColor="#C8A4FF" />
          </RadialGradient>
        </Defs>

        {/* Heavy geometric letters with the open counter in the A. */}
        <Path
          fill={`url(#${lettersId})`}
          fillRule="evenodd"
          d="M0 60V10H13L41 42V10H54V60H41L13 28V60Z M65 10H117V22H78V30H113V40H78V48H117V60H65Z M125 10H143L160 28L178 10H196L171 35L196 60H178L160 42L143 60H125L150 35Z M197 60L226 10H244L273 60H258L252 49H218L212 60Z M225 38H246L235.5 20Z"
        />

        {/* The two lid halves remain open at the optical center. */}
        <Path d={upperLid} fill="none" stroke="#824AFF" strokeOpacity={0.17} strokeWidth={17} strokeLinecap="round" />
        <Path d={upperLid} fill="none" stroke={`url(#${eyeId})`} strokeWidth={9} strokeLinecap="round" />
        <Path d={upperLid} fill="none" stroke="#E1C8FF" strokeOpacity={0.88} strokeWidth={3.5} strokeLinecap="round" />

        <Path d={lowerLeft} fill="none" stroke="#823CFF" strokeOpacity={0.23} strokeWidth={11} strokeLinecap="round" />
        <Path d={lowerRight} fill="none" stroke="#823CFF" strokeOpacity={0.23} strokeWidth={11} strokeLinecap="round" />
        <Path d={lowerLeft} fill="none" stroke={`url(#${eyeId})`} strokeWidth={6} strokeLinecap="round" />
        <Path d={lowerRight} fill="none" stroke={`url(#${eyeId})`} strokeWidth={6} strokeLinecap="round" />
        <Path d={lowerLeft} fill="none" stroke="#DAB4FF" strokeWidth={2.4} strokeLinecap="round" />
        <Path d={lowerRight} fill="none" stroke="#DAB4FF" strokeWidth={2.4} strokeLinecap="round" />

        {/* Iris and pupil use layered circles instead of platform-dependent SVG filters. */}
        <Circle cx={323} cy={38} r={24} fill="#9D57FF" fillOpacity={0.12} />
        <Circle cx={323} cy={38} r={20} fill="none" stroke="#9D57FF" strokeOpacity={0.38} strokeWidth={5} />
        <Circle cx={323} cy={38} r={19} fill="none" stroke="#BD6FFF" strokeOpacity={0.9} strokeWidth={2.4} />
        <Circle cx={323} cy={38} r={14} fill="#AE6AFF" fillOpacity={0.26} />
        <Circle cx={323} cy={38} r={12} fill={`url(#${pupilId})`} stroke="#F9E6FF" strokeWidth={1} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '86%', maxWidth: 320, aspectRatio: 378 / 72 },
});
