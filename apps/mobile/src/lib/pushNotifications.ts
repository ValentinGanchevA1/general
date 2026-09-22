/**
 * Push notification setup — Firebase Cloud Messaging.
 *
 * Prerequisites (one-time, per platform):
 *   Android: place google-services.json in apps/mobile/android/app/
 *   iOS:     place GoogleService-Info.plist in apps/mobile/ios/G88/
 *            + add Push Notifications capability in Xcode
 *
 * Without those native config files the DEFAULT Firebase app is never created
 * and getMessaging() throws. All public entry points soft-fail in that case
 * so the rest of the app still boots (dev / CI without FCM credentials).
 *
 * Call registerPushToken() after every successful login/session restore.
 * Call unregisterPushToken() on logout / deleteAccount (best-effort).
 * Call setupNotificationHandlers(navigate) once at app boot after login.
 */
import { Platform, PermissionsAndroid } from 'react-native';
import { getApps } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  requestPermission as firebaseRequestPermission,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';

import { api } from '@/api/client';
import { focusUserOnMapViaRef } from '@/navigation/focusUserOnMap';

/** True only when native Firebase DEFAULT app exists (google-services / plist present). */
function isFirebaseReady(): boolean {
  try {
    return getApps().length > 0;
  } catch {
    return false;
  }
}

function messaging() {
  if (!isFirebaseReady()) {
    throw new Error('Firebase DEFAULT app not initialized');
  }
  return getMessaging();
}

// ─── Permission ──────────────────────────────────────────────────────────────

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const status = await firebaseRequestPermission(messaging());
    return (
      status === AuthorizationStatus.AUTHORIZED ||
      status === AuthorizationStatus.PROVISIONAL
    );
  }
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true; // Android < 13 — no runtime permission needed
}

// ─── Token registration ──────────────────────────────────────────────────────

export async function registerPushToken(): Promise<void> {
  if (!isFirebaseReady()) {
    if (__DEV__) {
      console.warn(
        '[push] Firebase not initialized — skip registerPushToken. ' +
          'Add android/app/google-services.json and/or ios GoogleService-Info.plist, then rebuild.',
      );
    }
    return;
  }

  try {
    const granted = await requestPermission();
    if (!granted) return;

    const token = await getToken(messaging());
    if (!token) return;

    if (__DEV__) console.log('[push] FCM token acquired:', token.slice(0, 20) + '...');

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await api.post('/notifications/device-token', { token, platform });
    if (__DEV__) console.log('[push] token registered with backend');
  } catch (err) {
    if (__DEV__) console.warn('[push] registerPushToken failed:', err);
  }
}

/**
 * Best-effort: remove this device token from the current user's rows so the next
 * account on the same device does not receive the previous user's pushes.
 * Must run while the access token is still valid (before tokenStore.clear).
 */
export async function unregisterPushToken(): Promise<void> {
  if (!isFirebaseReady()) {
    if (__DEV__) {
      console.warn('[push] Firebase not initialized — skip unregisterPushToken.');
    }
    return;
  }

  try {
    const token = await getToken(messaging());
    if (!token) return;
    await api.delete('/notifications/device-token', { data: { token } });
    if (__DEV__) console.log('[push] token unregistered with backend');
  } catch (err) {
    if (__DEV__) console.warn('[push] unregisterPushToken failed:', err);
  }
}

// ─── Deep-link navigation from notification tap ──────────────────────────────

type NavigateFn = (screen: string, params?: Record<string, unknown>) => void;

function handleNotificationTap(
  data: Record<string, string> | undefined,
  navigate: NavigateFn,
): void {
  if (!data) return;
  if (data['type'] === 'message' && data['conversationId']) {
    navigate('Chat', { conversationId: data['conversationId'], otherUserName: '' });
  } else if (data['type'] === 'wave' && data['fromUserId']) {
    // Core loop: inbound wave → peer pin on map (fallback: Interactions).
    void focusUserOnMapViaRef({ userId: data['fromUserId'] }).then((result) => {
      if (result === 'error') {
        navigate('Interactions');
      }
    });
  } else if (data['type'] === 'alert') {
    // Open the Pulse tab pre-filtered to alerts.
    navigate('Main', { screen: 'Pulse', params: { filter: 'alerts' } });
  } else if (data['type'] === 'gift') {
    navigate('GiftsInbox');
  }
}

// ─── Handler setup (call once after login) ───────────────────────────────────

export function setupNotificationHandlers(navigate: NavigateFn): () => void {
  if (!isFirebaseReady()) {
    if (__DEV__) {
      console.warn(
        '[push] Firebase not initialized — skip setupNotificationHandlers. ' +
          'Add android/app/google-services.json and/or ios GoogleService-Info.plist, then rebuild.',
      );
    }
    return () => undefined;
  }

  try {
    const unsubForeground = onMessage(messaging(), async () => {
      // No-op: socket delivers the message live.
    });

    const unsubBackgroundTap = onNotificationOpenedApp(messaging(), (remoteMessage) => {
      handleNotificationTap(remoteMessage.data as Record<string, string>, navigate);
    });

    void getInitialNotification(messaging()).then((remoteMessage) => {
      if (remoteMessage) {
        setTimeout(() => {
          handleNotificationTap(remoteMessage.data as Record<string, string>, navigate);
        }, 300);
      }
    });

    return () => {
      unsubForeground();
      unsubBackgroundTap();
    };
  } catch (err) {
    if (__DEV__) console.warn('[push] setupNotificationHandlers failed:', err);
    return () => undefined;
  }
}
