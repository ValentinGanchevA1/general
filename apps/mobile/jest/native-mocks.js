// Mocks for native modules that have no JS implementation under jest.
// Component-render tests reach these transitively (e.g. tokenStore → AsyncStorage).
/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-keychain: in-memory generic-password store, keyed by `service`.
jest.mock('react-native-keychain', () => {
  const store = new Map();
  return {
    setGenericPassword: jest.fn((username, password, options = {}) => {
      store.set(options.service ?? 'default', { username, password });
      return Promise.resolve(true);
    }),
    getGenericPassword: jest.fn((options = {}) =>
      Promise.resolve(store.get(options.service ?? 'default') ?? false),
    ),
    resetGenericPassword: jest.fn((options = {}) => {
      store.delete(options.service ?? 'default');
      return Promise.resolve(true);
    }),
    __resetMockStore: () => store.clear(),
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ idToken: 'test-id-token', user: {} })),
    signInSilently: jest.fn(() => Promise.resolve({})),
    signOut: jest.fn(() => Promise.resolve()),
    isSignedIn: jest.fn(() => Promise.resolve(false)),
    getCurrentUser: jest.fn(() => Promise.resolve(null)),
  },
  GoogleSigninButton: 'GoogleSigninButton',
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

const messagingMock = () => ({
  requestPermission: jest.fn(() => Promise.resolve(1)),
  getToken: jest.fn(() => Promise.resolve('test-fcm-token')),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
  setBackgroundMessageHandler: jest.fn(),
  onTokenRefresh: jest.fn(() => jest.fn()),
});
jest.mock('@react-native-firebase/messaging', () => messagingMock);
jest.mock('@react-native-firebase/app', () => ({ firebase: { app: jest.fn() } }));

// PulseScreen → StoryViewer → @gorhom/bottom-sheet → gesture-handler TurboModule.
// Without stubs, Jest fails: RNGestureHandlerModule could not be found.
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  const noop = () => undefined;
  const handler = () => ({
    onStart: noop,
    onUpdate: noop,
    onEnd: noop,
    onFinalize: noop,
    onChange: noop,
    onBegin: noop,
    onTouchesDown: noop,
    onTouchesMove: noop,
    onTouchesUp: noop,
    onTouchesCancelled: noop,
    enabled: noop,
    activeOffsetY: noop,
    activeOffsetX: noop,
    failOffsetY: noop,
    failOffsetX: noop,
    hitSlop: noop,
    runOnJS: noop,
    withRef: noop,
  });
  return {
    __esModule: true,
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: View,
    gestureHandlerRootHOC: (c) => c,
    Directions: {},
    GestureHandlerRootView: ({ children }) => React.createElement(View, null, children),
    Gesture: {
      Tap: handler,
      Pan: handler,
      Pinch: handler,
      Rotation: handler,
      Fling: handler,
      LongPress: handler,
      ForceTouch: handler,
      Native: handler,
      Manual: handler,
      Race: noop,
      Simultaneous: noop,
      Exclusive: noop,
    },
    GestureDetector: ({ children }) => React.createElement(View, null, children),
  };
});

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Sheet = React.forwardRef(({ children }, _ref) =>
    React.createElement(View, { testID: 'mock-bottom-sheet' }, children),
  );
  Sheet.displayName = 'MockBottomSheetModal';
  return {
    __esModule: true,
    BottomSheetModal: Sheet,
    BottomSheet: Sheet,
    BottomSheetView: View,
    BottomSheetScrollView: View,
    BottomSheetFlatList: View,
    BottomSheetTextInput: View,
    BottomSheetBackdrop: View,
    BottomSheetModalProvider: ({ children }) => children,
    useBottomSheetModal: () => ({ dismiss: jest.fn(), present: jest.fn() }),
    useBottomSheet: () => ({ close: jest.fn(), expand: jest.fn(), collapse: jest.fn() }),
  };
});

// PulseScreen → Avatar → useCachedImageUri → avatarCache → blob-util native fs.
// Without stub: TypeError Cannot read properties of null (reading 'getConstants').
jest.mock('react-native-blob-util', () => {
  const dirs = { CacheDir: '/tmp/g88-jest-cache', DocumentDir: '/tmp/g88-jest-docs' };
  const fs = {
    dirs,
    isDir: jest.fn(() => Promise.resolve(true)),
    mkdir: jest.fn(() => Promise.resolve()),
    exists: jest.fn(() => Promise.resolve(false)),
    unlink: jest.fn(() => Promise.resolve()),
  };
  const fetchResult = {
    info: () => ({ status: 404 }),
    path: () => '',
  };
  const api = {
    fs,
    config: jest.fn(() => ({
      fetch: jest.fn(() => Promise.resolve(fetchResult)),
    })),
  };
  return {
    __esModule: true,
    default: api,
    ...api,
  };
});
