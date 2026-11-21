import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { WorldModesScreen } from './WorldModesScreen';

/** First-run wrapper; the picker itself is shared with Settings → World Modes. */
export function WorldSelectionScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const handleComplete = useCallback(() => {
    navigation.replace('Main');
  }, [navigation]);

  return <WorldModesScreen onComplete={handleComplete} />;
}
