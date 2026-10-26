import React from 'react';
import Svg, { Path } from 'react-native-svg';

import { GOOGLE_BRAND_COLORS } from '@/features/profile/socialConfig';

/** Provider artwork is decorative; the enclosing button supplies its label. */
export function GoogleMark(): React.JSX.Element {
  return (
    <Svg width={24} height={24} viewBox="0 0 48 48" accessible={false}>
      <Path fill={GOOGLE_BRAND_COLORS.blue} d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.17v5.13h6.6c3.86-3.56 6.09-8.8 6.09-14.8Z" />
      <Path fill={GOOGLE_BRAND_COLORS.green} d="M24 44c5.5 0 10.11-1.82 13.52-4.95l-6.6-5.13c-1.83 1.23-4.17 1.96-6.92 1.96-5.32 0-9.83-3.59-11.44-8.41H5.74v5.29A20 20 0 0 0 24 44Z" />
      <Path fill={GOOGLE_BRAND_COLORS.yellow} d="M12.56 27.47a12 12 0 0 1 0-6.94v-5.29H5.74a20 20 0 0 0 0 17.52Z" />
      <Path fill={GOOGLE_BRAND_COLORS.red} d="M24 12.12c3 0 5.7 1.03 7.82 3.05l5.87-5.87A19.65 19.65 0 0 0 24 4 20 20 0 0 0 5.74 15.24l6.82 5.29C14.17 15.71 18.68 12.12 24 12.12Z" />
    </Svg>
  );
}
