import { Config } from '@/config';

/** Exact opt-in keeps the current map chrome as the default and rollback state. */
export function resolveMapChromePrototypeEnabled(value: string | undefined): boolean {
  return value === '1';
}

export const NEXA_MAP_CHROME_PROTOTYPE_ENABLED = resolveMapChromePrototypeEnabled(
  Config.MAP_CHROME_PROTOTYPE_REQUESTED,
);
