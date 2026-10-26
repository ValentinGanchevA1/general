import {
  readMapLibreReleaseConfig,
  validateMapLibreReleaseConfig,
} from './maplibre-release-config.mjs';

const result = validateMapLibreReleaseConfig(readMapLibreReleaseConfig());

if (!result.ok) {
  console.error(`::error::[maplibre-release-gate] ${result.reason}`);
  process.exit(1);
}

console.log(
  `[maplibre-release-gate] provider=maptiler region=${result.region} mapId=${result.mapId}; API key present and format valid.`,
);
