/**
 * Push notification setup — Firebase Cloud Messaging.
 *
 * Prerequisites (one-time, per platform):
 *   Android: place google-services.json in apps/mobile/android/app/
 *   iOS:     place GoogleService-Info.plist in apps/mobile/ios/G88/
 *            + add Push Notifications capability in Xcode
 *
 * Call registerPushToken() after every successful login/session restore.
 * Call setupNotificationHandlers(navigate) once at app boot after login.
 */
import { Platform, PermissionsAndroid } from 'react-native';
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

const messaging = () => getMessaging();

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

// ─── Deep-link navigation from notification tap ──────────────────────────────

type NavigateFn = (screen: string, params?: Record<string, unknown>) => void;

function handleNotificationTap(
  data: Record<string, string> | undefined,
  navigate: NavigateFn,
): void {
  if (!data) return;
  if (data['type'] === 'message' && data['conversationId']) {
    navigate('Chat', { conversationId: data['conversationId'], otherUserName: '' });
  } else if (data['type'] === 'alert') {
    // Open the Pulse tab pre-filtered to alerts.
    navigate('Main', { screen: 'Pulse', params: { filter: 'alerts' } });
  }
}

// ─── Handler setup (call once after login) ───────────────────────────────────

export function setupNotificationHandlers(navigate: NavigateFn): () => void {
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
}
