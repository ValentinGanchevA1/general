import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    // In prod this would go to Sentry. For now, log to console.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = (): void => this.setState({ hasError: false, message: '' });

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.message}</Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: { color: '#ff6b6b', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  message: { color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  btn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  btnText: { color: '#00d4ff', fontWeight: '600', fontSize: 14 },
});
