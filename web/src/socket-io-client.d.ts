declare module 'socket.io-client' {
  export function io(url: string, options?: Readonly<Record<string, unknown>>): unknown;
}
