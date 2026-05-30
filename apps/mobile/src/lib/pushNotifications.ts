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
import messaging from '@react-native-firebase/messaging';

import { api } from '@/api/client';

// ─── Permission ──────────────────────────────────────────────────────────────

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const status = await messaging().requestPermission();
    return (
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL
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

    const token = await messaging().getToken();
    if (!token) return;

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await api.post('/notifications/device-token', { token, platform });
  } catch (err) {
    // Non-fatal — push is best-effort
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
  }
  // Wave tap → nothing actionable yet (no dedicated wave screen); map will show it.
}

// ─── Handler setup (call once after login) ───────────────────────────────────

export function setupNotificationHandlers(navigate: NavigateFn): () => void {
  // Foreground messages: Firebase doesn't show a notification UI by default —
  // the app is open, so we just let the socket handle real-time delivery.
  const unsubForeground = messaging().onMessage(async () => {
    // No-op: socket delivers the message live; no duplicate notification needed.
  });

  // Background / quit → app opened via notification tap.
  const unsubBackgroundTap = messaging().onNotificationOpenedApp((remoteMessage) => {
    handleNotificationTap(remoteMessage.data as Record<string, string>, navigate);
  });

  // Killed state: app was opened FROM a notification.
  void messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        // Delay slightly so the navigator is mounted before we navigate.
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
