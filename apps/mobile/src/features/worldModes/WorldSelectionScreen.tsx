import React, { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { NexaWorldPortalTransition } from './NexaWorldPortalTransition';
import { finishFirstRunWorldSelection } from './worldModesSlice';
import { WorldModesScreen } from './WorldModesScreen';

/** First-run wrapper; selection and Settings share the same World picker. */
export function WorldSelectionScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector((state) => state.worldModes.selectedId);
  const [enteringWorld, setEnteringWorld] = useState(false);

  const handleSelectionComplete = useCallback(() => {
    setEnteringWorld(true);
  }, []);

  const handlePortalComplete = useCallback(() => {
    dispatch(finishFirstRunWorldSelection());
    navigation.replace('Main');
  }, [dispatch, navigation]);

  if (enteringWorld) {
    return (
      <NexaWorldPortalTransition
        worldId={selectedId}
        onComplete={handlePortalComplete}
      />
    );
  }

  return <WorldModesScreen onComplete={handleSelectionComplete} />;
}
