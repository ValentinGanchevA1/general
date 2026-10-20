/**
 * NEXA push notifications — Firebase Cloud Messaging.
 *
 * Re-entry rules are allow-listed and map-first. Push payloads are treated as
 * untrusted input: they may identify an entity, but can never select an
 * arbitrary React Navigation route or carry coordinates.
 *
 * Native prerequisites:
 *   Android: apps/mobile/android/app/google-services.json
 *   iOS:     GoogleService-Info.plist + Push Notifications capability
 *
 * All public entry points soft-fail when Firebase is not configured so dev/CI
 * builds continue to boot normally.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import { getApps } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  requestPermission as firebaseRequestPermission,
} from '@react-native-firebase/messaging';

import { api } from '@/api/client';
import { focusUserOnMapViaRef } from '@/navigation/focusUserOnMap';
import { navigationRef } from '@/navigation/navigationRef';
import {
  resolveNexaNotificationReentry,
  type NexaNotificationReentry,
} from '@/lib/nexaNotificationReentry';

/** True only when native Firebase DEFAULT app exists. */
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
  return true;
}

// ─── Token registration ─────────────────────────────────────────────────────

export async function registerPushToken(): Promise<void> {
  if (!isFirebaseReady()) {
    if (__DEV__) {
      console.warn(
        '[push] Firebase not initialized — skip registerPushToken. ' +
          'Add native Firebase config, then rebuild.',
      );
    }
    return;
  }

  try {
    const granted = await requestPermission();
    if (!granted) return;

    const token = await getToken(messaging());
    if (!token) return;

    if (__DEV__) {
      console.log('[push] FCM token acquired:', token.slice(0, 20) + '...');
    }

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await api.post('/notifications/device-token', { token, platform });
    if (__DEV__) console.log('[push] token registered with backend');
  } catch (err) {
    if (__DEV__) console.warn('[push] registerPushToken failed:', err);
  }
}

/**
 * Remove this device token while the current access token is still valid so a
 * later account on the same device cannot receive the previous account's push.
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

// ─── Re-entry ────────────────────────────────────────────────────────────────

type NavigateFn = (screen: string, params?: Record<string, unknown>) => void;
type PushData = Record<string, string> | undefined;

const RECENT_TAP_TTL_MS = 30_000;
const MAX_PENDING_REENTRY_ATTEMPTS = 16;
const REENTRY_RETRY_MS = 180;
const recentTapIds = new Map<string, number>();

interface PendingReentry {
  destination: NexaNotificationReentry;
  navigate: NavigateFn;
  attempts: number;
}

let pendingReentry: PendingReentry | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function shouldHandleTap(messageId: string | undefined): boolean {
  if (!messageId) return true;

  const now = Date.now();
  for (const [id, seenAt] of recentTapIds) {
    if (now - seenAt > RECENT_TAP_TTL_MS) recentTapIds.delete(id);
  }

  if (recentTapIds.has(messageId)) return false;
  recentTapIds.set(messageId, now);
  return true;
}

function navigateMainTab(tab: 'Map' | 'Pulse'): boolean {
  if (!navigationRef.isReady()) return false;

  if (tab === 'Pulse') {
    (navigationRef.navigate as (name: 'Main', params: object) => void)('Main', {
      screen: 'Pulse',
      params: { filter: 'nearby' },
    });
    return true;
  }

  (navigationRef.navigate as (name: 'Main', params: object) => void)('Main', {
    screen: 'Map',
  });
  return true;
}

function executeReentry(
  destination: NexaNotificationReentry,
  navigate: NavigateFn,
): boolean {
  if (!navigationRef.isReady()) return false;

  switch (destination.type) {
    case 'map':
      if (!destination.focusUserId) return navigateMainTab('Map');
      void focusUserOnMapViaRef({ userId: destination.focusUserId }).then((result) => {
        if (result === 'error') navigate('Interactions');
      });
      return true;
    case 'chat':
      navigate('Chat', {
        conversationId: destination.conversationId,
        otherUserName: '',
      });
      return true;
    case 'interactions':
      navigate('Interactions');
      return true;
    case 'gifts':
      navigate('GiftsInbox');
      return true;
    case 'pulse-nearby':
      return navigateMainTab('Pulse');
    case 'event-detail':
      navigate('EventDetail', { eventId: destination.eventId });
      return true;
    case 'listing-detail':
      navigate('ListingDetail', { listingId: destination.listingId });
      return true;
    case 'trust-center':
      navigate('TrustCenter', { focusStep: 'id' });
      return true;
  }
}

function schedulePendingReentry(): void {
  if (pendingTimer) return;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    flushPendingNotificationReentry();
  }, REENTRY_RETRY_MS);
}

/**
 * Flush a cold-start push after NavigationContainer becomes ready. The queue is
 * intentionally one-deep: the most recent user tap wins.
 */
export function flushPendingNotificationReentry(): void {
  if (!pendingReentry) return;

  if (executeReentry(pendingReentry.destination, pendingReentry.navigate)) {
    pendingReentry = null;
    return;
  }

  pendingReentry.attempts += 1;
  if (pendingReentry.attempts >= MAX_PENDING_REENTRY_ATTEMPTS) {
    pendingReentry = null;
    return;
  }
  schedulePendingReentry();
}

function handleNotificationTap(
  data: PushData,
  navigate: NavigateFn,
  messageId?: string,
): void {
  if (!shouldHandleTap(messageId)) return;

  const destination = resolveNexaNotificationReentry(data);
  if (executeReentry(destination, navigate)) return;

  pendingReentry = { destination, navigate, attempts: 0 };
  schedulePendingReentry();
}

// ─── Handler setup ───────────────────────────────────────────────────────────

/** Call once after login/session restore. */
export function setupNotificationHandlers(navigate: NavigateFn): () => void {
  if (!isFirebaseReady()) {
    if (__DEV__) {
      console.warn(
        '[push] Firebase not initialized — skip setupNotificationHandlers. ' +
          'Add native Firebase config, then rebuild.',
      );
    }
    return () => undefined;
  }

  try {
    const unsubForeground = onMessage(messaging(), async () => {
      // Socket.IO owns foreground interaction delivery to avoid duplicate UI.
    });

    const unsubBackgroundTap = onNotificationOpenedApp(
      messaging(),
      (remoteMessage) => {
        handleNotificationTap(
          remoteMessage.data as PushData,
          navigate,
          remoteMessage.messageId,
        );
      },
    );

    void getInitialNotification(messaging()).then((remoteMessage) => {
      if (!remoteMessage) return;
      handleNotificationTap(
        remoteMessage.data as PushData,
        navigate,
        remoteMessage.messageId,
      );
    });

    return () => {
      unsubForeground();
      unsubBackgroundTap();
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      pendingReentry = null;
    };
  } catch (err) {
    if (__DEV__) console.warn('[push] setupNotificationHandlers failed:', err);
    return () => undefined;
  }
}
