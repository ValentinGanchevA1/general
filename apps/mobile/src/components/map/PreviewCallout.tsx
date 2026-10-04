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

  profile?: PublicUserProfile;
  distanceMeters?: number;

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

  stage: Stage;
  error?: string;
  lastResult?:
    | 'wave_sent'
    | 'like_sent'
    | 'matched'
    | 'message_opened'
    | 'blocked'
    | 'passed';
}

export type PinEvent =
  | {
      type: 'PIN_TAP';
      pinId: string;
      pinType: PinType;
      lat: number;
      lng: number;
      viewerMode: ViewerMode;
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

