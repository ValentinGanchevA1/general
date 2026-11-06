import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

/**
 * Horizontal NEXUS lockup based on the approved magenta-to-violet artwork.
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
    <View style={styles.root} accessible accessibilityRole="image" accessibilityLabel="NEXUS">
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

        {/* Heavy geometric letters with the five-letter NEXUS wordmark. */}
        <Path
          fill={`url(#${lettersId})`}
          fillRule="evenodd"
          d="M0 60V10H11L34 38V10H45V60H34L11 32V60Z M53 10H96V21H65V30H92V40H65V49H96V60H53Z M103 10H118L135 28L152 10H167L144 35L167 60H152L135 42L118 60H103L126 35Z M174 10H187V42C187 50 190 51 200 51C209 51 212 48 212 42V10H225V42C225 57 216 62 200 62C184 62 174 57 174 42Z M248 10H280V22H248C244 22 243 23 243 26C243 29 245 30 249 30H266C279 30 283 36 283 45C283 54 277 60 264 60H233V48H264C269 48 270 46 270 43C270 41 268 40 264 40H249C235 40 231 34 231 26C231 16 237 10 248 10Z"
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
