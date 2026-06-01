// Jest mock for @sentry/react-native.
//
// The real package ships ESM and pulls in native modules, which the `node` test
// environment can't load (and unit tests don't need). This no-op stub stands in
// for it via moduleNameMapper. Covers the API surface used across the app
// (addBreadcrumb / setUser / captureException) plus common extras so new call
// sites don't require touching this file.
const noop = () => {};

module.exports = {
  __esModule: true,
  init: noop,
  addBreadcrumb: noop,
  captureException: noop,
  captureMessage: noop,
  captureEvent: noop,
  setUser: noop,
  setTag: noop,
  setTags: noop,
  setContext: noop,
  setExtra: noop,
  setExtras: noop,
  withScope: (cb) => cb({ setTag: noop, setExtra: noop, setContext: noop }),
  flush: () => Promise.resolve(true),
  close: () => Promise.resolve(true),
  // Sentry.wrap(App) must return a usable component.
  wrap: (component) => component,
};
