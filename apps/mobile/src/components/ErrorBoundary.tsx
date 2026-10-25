import * as Sentry from '@sentry/react-native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme, type ThemeColors } from '@/theme';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Try again.';

function DefaultErrorFallback({ message, onRetry }: { message: string; onRetry: () => void }): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.btn} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.btnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(_error: unknown): State {
    return {
      hasError: true,
      message: DEFAULT_ERROR_MESSAGE,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  reset = (): void => this.setState({ hasError: false, message: '' });

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <DefaultErrorFallback message={this.state.message} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    title: { color: colors.dangerMuted, fontSize: 18, fontWeight: '700', marginBottom: 8 },
    message: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 24 },
    btn: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    btnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  });
}
