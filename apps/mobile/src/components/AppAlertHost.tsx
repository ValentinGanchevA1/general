// apps/mobile/src/components/AppAlertHost.tsx
//
// Global themed alert modal — dark surface, brand accents, matches G88 chrome.
// Mount once next to AmbientToastHost in AppNavigator.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  bindAppAlertHost,
  dismissAppAlert,
  type AppAlertButton,
  type AppAlertRequest,
} from '@/ui/appAlert';
import { colors, fontSize, radius, spacing } from '@/theme';

export function AppAlertHost(): React.JSX.Element | null {
  const [req, setReq] = useState<AppAlertRequest | null>(null);

  useEffect(() => {
    bindAppAlertHost(setReq);
    return () => bindAppAlertHost(null);
  }, []);

  const onButton = useCallback((btn: AppAlertButton) => {
    setReq(null);
    queueMicrotask(() => {
      btn.onPress?.();
    });
  }, []);

  const cancelable = req?.options?.cancelable !== false;

  const orderedButtons = useMemo(() => {
    if (!req) return [];
    const btns = [...req.buttons];
    btns.sort((a, b) => {
      const rank = (s?: string) =>
        s === 'cancel' ? 0 : s === 'destructive' ? 2 : 1;
      return rank(a.style) - rank(b.style);
    });
    return btns;
  }, [req]);

  if (!req) return null;

  const multi = orderedButtons.length > 1;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (cancelable) dismissAppAlert();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (cancelable) dismissAppAlert();
        }}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{req.title}</Text>
          {req.message ? <Text style={styles.message}>{req.message}</Text> : null}

          <View style={[styles.actions, multi && styles.actionsRow]}>
            {orderedButtons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <TouchableOpacity
                  key={`${btn.text}-${i}`}
                  style={[
                    styles.btn,
                    multi && styles.btnFlex,
                    !multi && styles.btnFull,
                    isDestructive && styles.btnDestructive,
                    !isCancel && !isDestructive && styles.btnPrimary,
                    isCancel && styles.btnCancel,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => onButton(btn)}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isDestructive && styles.btnTextDestructive,
                      !isCancel && !isDestructive && styles.btnTextPrimary,
                      isCancel && styles.btnTextCancel,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  btn: {
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnFlex: {
    flex: 1,
  },
  btnFull: {
    width: '100%',
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnCancel: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDestructive: {
    backgroundColor: 'rgba(255,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.45)',
  },
  btnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  btnTextPrimary: {
    color: colors.onPrimary,
  },
  btnTextCancel: {
    color: colors.textSecondary,
  },
  btnTextDestructive: {
    color: colors.danger,
  },
});
