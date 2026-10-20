import React, { type ReactNode } from 'react';

import {
  NexaSpatialActionBar,
  NexaSpatialActionButton,
  NexaSpatialSheetScaffold,
  type NexaSpatialMetaItem,
} from './NexaSpatialSheet';
import type { NexaSpatialSheetKind } from './nexaSpatialSheet';

export interface NexaSpatialSheetActionSpec {
  id: string;
  label: string;
  onPress: () => void;
  icon?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
}

export interface NexaSpatialEntitySheetProps {
  title: string;
  subtitle?: string | null;
  meta?: NexaSpatialMetaItem[];
  primaryAction: NexaSpatialSheetActionSpec;
  secondaryActions?: NexaSpatialSheetActionSpec[];
  header?: ReactNode;
  headerTrailing?: ReactNode;
  children?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
}

function EntitySheet({
  kind,
  title,
  subtitle,
  meta,
  primaryAction,
  secondaryActions = [],
  header,
  headerTrailing,
  children,
  accessibilityLabel,
  testID,
}: NexaSpatialEntitySheetProps & { kind: NexaSpatialSheetKind }): React.JSX.Element {
  return (
    <NexaSpatialSheetScaffold
      kind={kind}
      title={title}
      meta={meta ?? []}
      {...(subtitle !== undefined ? { subtitle } : {})}
      {...(header !== undefined ? { header } : {})}
      {...(headerTrailing !== undefined ? { headerTrailing } : {})}
      {...(accessibilityLabel !== undefined ? { accessibilityLabel } : {})}
      {...(testID !== undefined ? { testID } : {})}
      actions={
        <NexaSpatialActionBar>
          <NexaSpatialActionButton
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            kind={kind}
            variant={primaryAction.variant ?? 'primary'}
            disabled={primaryAction.disabled ?? false}
            loading={primaryAction.loading ?? false}
            flex
            {...(primaryAction.icon !== undefined ? { icon: primaryAction.icon } : {})}
            {...(primaryAction.accessibilityLabel !== undefined
              ? { accessibilityLabel: primaryAction.accessibilityLabel }
              : {})}
          />
          {secondaryActions.map((action) => (
            <NexaSpatialActionButton
              key={action.id}
              label={action.label}
              onPress={action.onPress}
              kind={kind}
              variant={action.variant ?? 'secondary'}
              disabled={action.disabled ?? false}
              loading={action.loading ?? false}
              {...(action.icon !== undefined ? { icon: action.icon } : {})}
              {...(action.accessibilityLabel !== undefined
                ? { accessibilityLabel: action.accessibilityLabel }
                : {})}
            />
          ))}
        </NexaSpatialActionBar>
      }
    >
      {children}
    </NexaSpatialSheetScaffold>
  );
}

export function NexaPersonSheet(props: NexaSpatialEntitySheetProps): React.JSX.Element {
  return <EntitySheet {...props} kind="person" />;
}

export function NexaEventSheet(props: NexaSpatialEntitySheetProps): React.JSX.Element {
  return <EntitySheet {...props} kind="event" />;
}

export function NexaListingSheet(props: NexaSpatialEntitySheetProps): React.JSX.Element {
  return <EntitySheet {...props} kind="listing" />;
}

export function NexaOpportunitySheet(props: NexaSpatialEntitySheetProps): React.JSX.Element {
  return <EntitySheet {...props} kind="opportunity" />;
}
