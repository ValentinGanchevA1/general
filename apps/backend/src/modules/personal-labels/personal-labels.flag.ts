import { NotFoundException } from '@nestjs/common';

/** Exact opt-in, false for missing, whitespace, truthy aliases or typos. */
export function personalLabelsEnabled(value = process.env.NEXA_PERSONAL_LABELS_ENABLED): boolean {
  return value === 'true';
}

export function requirePersonalLabelsEnabled(): void {
  if (!personalLabelsEnabled()) {
    throw new NotFoundException({
      code: 'personal_labels.disabled',
      message: 'This feature is not available.',
    });
  }
}
