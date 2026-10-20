// apps/mobile/src/components/AppAlertHost.tsx
// Global themed alert modal. Mount once next to AmbientToastHost in AppNavigator.

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
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      shadowColor: colors.shadowInk,
      shadowOpacity: 0.45,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 16,
    },
    title: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', textAlign: 'center' },
    message: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22, textAlign: 'center', marginTop: spacing.sm },
    actions: { marginTop: spacing.xl, gap: spacing.sm },
    actionsRow: { flexDirection: 'row' },
    btn: { minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    btnFlex: { flex: 1 },
    btnFull: { width: '100%' },
    btnPrimary: { backgroundColor: colors.primary },
    btnCancel: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
    btnDestructive: { backgroundColor: colors.dangerSurface, borderWidth: 1, borderColor: colors.dangerBorder },
    btnText: { fontSize: fontSize.md, fontWeight: '700', textAlign: 'center' },
    btnTextPrimary: { color: colors.onPrimary },
    btnTextCancel: { color: colors.textSecondary },
    btnTextDestructive: { color: colors.danger },
  });
}

export function AppAlertHost(): React.JSX.Element | null {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [req, setReq] = useState<AppAlertRequest | null>(null);

  useEffect(() => {
    bindAppAlertHost(setReq);
    return () => bindAppAlertHost(null);
  }, []);

  const onButton = useCallback((btn: AppAlertButton) => {
    setReq(null);
    setTimeout(() => { btn.onPress?.(); }, 0);
  }, []);

  const cancelable = req?.options?.cancelable !== false;
  const orderedButtons = useMemo(() => {
    if (!req) return [];
    const btns = [...req.buttons];
    btns.sort((a, b) => {
      const rank = (s?: string) => s === 'cancel' ? 0 : s === 'destructive' ? 2 : 1;
      return rank(a.style) - rank(b.style);
    });
    return btns;
  }, [req]);

  if (!req) return null;
  const useRow = orderedButtons.length === 2;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (cancelable) dismissAppAlert(); }}>
      <Pressable style={styles.backdrop} onPress={() => { if (cancelable) dismissAppAlert(); }}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{req.title}</Text>
          {req.message ? <Text style={styles.message}>{req.message}</Text> : null}
          <View style={[styles.actions, useRow && styles.actionsRow]}>
            {orderedButtons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <TouchableOpacity
                  key={`${btn.text}-${i}`}
                  style={[styles.btn, useRow && styles.btnFlex, !useRow && styles.btnFull, isDestructive && styles.btnDestructive, !isCancel && !isDestructive && styles.btnPrimary, isCancel && styles.btnCancel]}
                  activeOpacity={0.85}
                  onPress={() => onButton(btn)}
                >
                  <Text style={[styles.btnText, isDestructive && styles.btnTextDestructive, !isCancel && !isDestructive && styles.btnTextPrimary, isCancel && styles.btnTextCancel]} numberOfLines={2}>
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
