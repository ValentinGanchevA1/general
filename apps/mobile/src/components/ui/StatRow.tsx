import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { StatItem } from './StatItem';

export interface StatRowItem {
  value: string | number;
  label: string;
}

export interface StatRowProps {
  items: StatRowItem[];
  style?: StyleProp<ViewStyle>;
}

export function StatRow({ items, style }: StatRowProps): React.JSX.Element {
  return (
    <View style={[styles.row, style]}>
      {items.map((item) => (
        <StatItem key={item.label} value={item.value} label={item.label} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
});
