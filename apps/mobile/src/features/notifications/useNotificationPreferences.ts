// apps/mobile/src/features/notifications/useNotificationPreferences.ts
//
// Loads + updates the signed-in user's per-channel push preferences
// (GET/PATCH /notifications/preferences). Optimistic toggle with rollback.

import { useCallback, useEffect, useState } from 'react';

import type {
  NotificationChannel,
  NotificationPreferences,
  UpdateNotificationPreferencesRequest,
} from '@g88/shared';
import { getJson, patchJson } from '@/api/client';

interface Result {
  prefs: NotificationPreferences | null;
  loading: boolean;
  /** Channel currently being saved (for a per-row spinner), if any. */
  saving: NotificationChannel | null;
  setChannel: (channel: NotificationChannel, enabled: boolean) => Promise<void>;
}

export function useNotificationPreferences(): Result {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<NotificationChannel | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setPrefs(await getJson<NotificationPreferences>('/notifications/preferences'));
      } catch {
        // leave null → screen shows a retry/empty state
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setChannel = useCallback(
    async (channel: NotificationChannel, enabled: boolean) => {
      setSaving(channel);
      // Optimistic: flip immediately, roll back on failure.
      setPrefs((prev) => (prev ? { ...prev, [channel]: enabled } : prev));
      try {
        const updated = await patchJson<UpdateNotificationPreferencesRequest, NotificationPreferences>(
          '/notifications/preferences',
          { preferences: { [channel]: enabled } },
        );
        setPrefs(updated);
      } catch {
        setPrefs((prev) => (prev ? { ...prev, [channel]: !enabled } : prev));
      } finally {
        setSaving(null);
      }
    },
    [],
  );

  return { prefs, loading, saving, setChannel };
}
