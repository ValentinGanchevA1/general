// process.env.* references (see src/config.ts) are inlined at bundle time by
// babel-plugin-transform-inline-environment-variables. There is no @types/node
// in the mobile app, so declare the minimal global shape tsc needs.
declare const process: {
  env: { [key: string]: string | undefined };
};
