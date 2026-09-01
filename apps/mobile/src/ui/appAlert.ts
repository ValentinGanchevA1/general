// apps/mobile/src/ui/appAlert.ts
//
// Themed replacement for React Native's Alert.alert.
// Matches the Alert.alert call signature so call sites can migrate 1:1.
// Requires <AppAlertHost /> mounted once under the root navigator.

export type AppAlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AppAlertButton {
  text: string;
  style?: AppAlertButtonStyle;
  onPress?: () => void;
}

export interface AppAlertOptions {
  /** When false, Android back / outside tap does not dismiss. Default true. */
  cancelable?: boolean;
}

export interface AppAlertRequest {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  options?: AppAlertOptions;
}

type Listener = (req: AppAlertRequest | null) => void;

let listener: Listener | null = null;
let pending: AppAlertRequest | null = null;

/** Called by AppAlertHost on mount/unmount. */
export function bindAppAlertHost(next: Listener | null): void {
  listener = next;
  if (listener && pending) {
    listener(pending);
    pending = null;
  }
}

/** Present a themed alert. Signature mirrors React Native Alert.alert. */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  options?: AppAlertOptions,
): void {
  const resolved: AppAlertButton[] =
    buttons && buttons.length > 0
      ? buttons
      : [{ text: 'OK', style: 'default' }];

  const req: AppAlertRequest = {
    title,
    message,
    buttons: resolved,
    options,
  };

  if (listener) {
    listener(req);
  } else {
    pending = req;
  }
}

/** Dismiss without invoking a button (used by host for outside/back). */
export function dismissAppAlert(): void {
  if (listener) listener(null);
  pending = null;
}
