import type {PublicUserProfile} from '@g88/shared';

export type ViewerMode = 'social' | 'dating';
export type PeerMode = 'social' | 'dating' | 'both' | 'none';
export type PinType = 'user' | 'event' | 'listing';
export type Stage = 'preview' | 'detail' | 'full';
export type CanMessage = 'none' | 'request' | 'chat';

export interface RelationshipSnapshot {
  waveSent: boolean;
  hasMutualWave: boolean;
  canMessage: CanMessage;
  isFriend: boolean;
  blockedByViewer: boolean;
  blockedByPeer: boolean;
  likeSent: boolean;
  isMatch: boolean;
  passed: boolean;
}

export interface PinContext {
  pinId: string;
  pinType: PinType;
  lat: number;
  lng: number;

  viewerMode: ViewerMode;
  peerMode: PeerMode;

  profile?: PublicUserProfile | undefined;
  distanceMeters?: number | undefined;

  waveSent: boolean;
  hasMutualWave: boolean;
  canMessage: CanMessage;
  isFriend: boolean;
  blockedByViewer: boolean;
  blockedByPeer: boolean;

  likeSent: boolean;
  /** Reserved for premium; unused in v1 UI. */
  superLiked: boolean;
  isMatch: boolean;
  passed: boolean;

  /** Social mutual-wave chat thread (from wave response or WS). */
  conversationId?: string | null;
  /** Dating match thread (from like response or MATCH_CREATED). */
  datingConversationId?: string | null;

  /** When true, a pin tap skips PreviewCallout after loading and opens detail. */
  openDetailOnLoad: boolean;
  stage: Stage;
  error?: string | undefined;
  lastResult?:
    | 'wave_sent'
    | 'like_sent'
    | 'matched'
    | 'message_opened'
    | 'blocked'
    | 'passed'
    | undefined;
}

export type PinEvent =
  | {
      type: 'PIN_TAP';
      pinId: string;
      pinType: PinType;
      lat: number;
      lng: number;
      viewerMode: ViewerMode;
      /** Direct map-pin selection should open EntityBottomSheet after load. */
      openDetail?: boolean;
    }
  | {type: 'LAYER_CHANGED'; viewerMode: ViewerMode}
  | {type: 'DISMISS'}
  | {type: 'OPEN_DETAIL'}
  | {type: 'OPEN_FULL'}
  | {type: 'BACK'}
  | {type: 'QUICK_WAVE'}
  | {type: 'QUICK_LIKE'}
  | {type: 'SEND_WAVE'}
  | {type: 'SEND_LIKE'}
  | {type: 'PASS'}
  | {type: 'MESSAGE'}
  | {type: 'BLOCK'}
  | {type: 'REPORT'}
  | {type: 'RETRY'}
  | {type: 'WAVE_MUTUAL'}
  | {type: 'MATCH_CREATED'; datingConversationId: string}
  | {type: 'USER_BLOCKED'}
  | {type: 'PROFILE_UPDATED'; profile: PublicUserProfile}
  | {type: 'PEER_MODE_CHANGED'; peerMode: PeerMode}
  | {
      type: 'LOAD_SUCCESS';
      profile: PublicUserProfile;
      peerMode: PeerMode;
      distanceMeters?: number;
      relationship: RelationshipSnapshot;
    }
  | {type: 'LOAD_FAILURE'; error: string}
  | {type: 'ACTION_SUCCESS'; result: NonNullable<PinContext['lastResult']>}
  | {type: 'ACTION_FAILURE'; error: string};
