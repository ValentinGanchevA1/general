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
      subtitle={subtitle}
      meta={meta}
      header={header}
      headerTrailing={headerTrailing}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      actions={
        <NexaSpatialActionBar>
          <NexaSpatialActionButton
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            kind={kind}
            variant={primaryAction.variant ?? 'primary'}
            icon={primaryAction.icon}
            disabled={primaryAction.disabled}
            loading={primaryAction.loading}
            accessibilityLabel={primaryAction.accessibilityLabel}
            flex
          />
          {secondaryActions.map((action) => (
            <NexaSpatialActionButton
              key={action.id}
              label={action.label}
              onPress={action.onPress}
              kind={kind}
              variant={action.variant ?? 'secondary'}
              icon={action.icon}
              disabled={action.disabled}
              loading={action.loading}
              accessibilityLabel={action.accessibilityLabel}
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
