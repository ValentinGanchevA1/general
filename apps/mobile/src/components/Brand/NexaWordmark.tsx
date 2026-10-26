import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { nexaBrand, nexaDark } from '@/theme';

/** Horizontal auth lockup. Vector outlines keep the wordmark independent of fonts. */
export function NexaWordmark(): React.JSX.Element {
  const gradientId = `nexa-wordmark-${useId().replace(/:/g, '')}`;
  return (
    <View style={styles.root} accessible accessibilityRole="image" accessibilityLabel="NEXA">
      <Svg width="100%" height="100%" viewBox="0 0 360 54" accessible={false}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={nexaBrand.violet} />
            <Stop offset="1" stopColor={nexaBrand.violetBright} />
          </LinearGradient>
        </Defs>
        <Path fill={`url(#${gradientId})`} fillRule="evenodd" d="M0 50V4H10L43 36V4H53V50H43L10 18V50Z M72 4H121V13H82V22H116V31H82V41H121V50H72Z M139 4H152L173 23L194 4H207L180 27L207 50H194L173 31L152 50H139L166 27Z M207 50L234 4H245L272 50H260L254 39H225L219 50Z M230 30H249L239.5 13Z M292 27Q326 -7 360 27Q326 61 292 27Z" />
        <Circle cx="326" cy="27" r="4.8" fill="none" stroke={nexaDark.canvas} strokeWidth="0.8" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '86%', maxWidth: 320, aspectRatio: 360 / 54 },
});
