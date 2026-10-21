import type {
  AuthenticatedUser,
  ChatMessage,
  ConversationSummary,
  DiscoveryPoint,
  DiscoveryResponse,
  EntityKind,
  MessagePage,
} from '../../packages/shared/src/api';
import type { ActivityItem, FeedResponse } from '../../packages/shared/src/activity';
import type { InboxItem, InboxResponse } from '../../packages/shared/src/friends';
import type { ChatMessageEvent, FriendPresenceEvent } from '../../packages/shared/src/events';
import { mountNexaMap, type MapCamera, type MapViewport } from './map';
import { WebRealtimeClient } from './realtime';

type Tab = 'map' | 'discover' | 'pulse' | 'connections' | 'you';
type ThemePreference = 'system' | 'dark' | 'light';
type ApiPath =
  | '/auth/web/login'
  | '/auth/web/refresh'
  | '/auth/web/logout'
  | '/auth/me'
  | '/discovery/nearby'
  | '/feed?limit=24'
  | '/interactions/inbox?limit=24'
  | '/conversations'
  | '/interactions/wave'
  | `/conversations/${string}/messages?limit=50`
  | `/conversations/${string}/read`
  | `/friends/requests/${string}/accept`
  | `/friends/requests/${string}/decline`;

interface State {
  tab: Tab;
  theme: ThemePreference;
  user: AuthenticatedUser | null;
  points: DiscoveryPoint[];
  feed: ActivityItem[];
  kinds: Set<EntityKind>;
  authOpen: boolean;
  notice: string | null;
  mapCamera: MapCamera;
  mapViewport: MapViewport;
  inbox: InboxItem[];
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  connectionsLoading: boolean;
  realtimeConnected: boolean;
  conversationJoined: boolean;
}

interface WebAccessTokenResponse {
  accessToken: string;
  expiresAt: string;
}

interface WebLoginResponse extends WebAccessTokenResponse {
  user: AuthenticatedUser;
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const DEFAULT_CAMERA: MapCamera = {
  center: { lat: 43.2077, lng: 27.9167 },
  zoom: 13,
};

const DEFAULT_VIEWPORT: MapViewport = {
  ne: { lat: 43.245, lng: 27.985 },
  sw: { lat: 43.17, lng: 27.845 },
};

const API_BASE = window.location.origin === 'http://127.0.0.1:4174'
  ? 'http://127.0.0.1:3001/api/v1'
  : window.location.origin === 'http://localhost:4174'
    ? 'http://localhost:3001/api/v1'
    : '/api/v1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_TAGS = new Set([
  'ARTICLE', 'ASIDE', 'B', 'BUTTON', 'CODE', 'DIALOG', 'DIV', 'FOOTER', 'FORM',
  'H1', 'H2', 'H3', 'HEADER', 'I', 'INPUT', 'LABEL', 'MAIN', 'NAV', 'P',
  'SECTION', 'SMALL', 'SPAN', 'STRONG',
]);
const SAFE_ATTRIBUTES = new Set([
  'autocomplete', 'class', 'data-action', 'data-conversation-id', 'data-kind',
  'data-request-id', 'data-tab', 'data-target', 'data-tone', 'data-wave-user-id',
  'disabled', 'id', 'maxlength', 'minlength', 'open', 'placeholder', 'required', 'type',
]);

const demoPoints: DiscoveryPoint[] = [
  { kind: 'user', id: 'maria', lat: 43.2122, lng: 27.9248, meta: { displayName: 'Maria', avatarUrl: null, verification: 'phone', online: true, lastSeenAt: new Date().toISOString(), verifiedBadge: true } },
  { kind: 'user', id: 'alex', lat: 43.2066, lng: 27.9065, meta: { displayName: 'Alex', avatarUrl: null, verification: 'selfie', online: true, lastSeenAt: new Date().toISOString(), verifiedBadge: true } },
  { kind: 'event', id: 'sunset', lat: 43.2045, lng: 27.931, meta: { title: 'Sunset Beach Meetup', coverUrl: null, startsAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), attendeeCount: 42, capacity: 80 } },
  { kind: 'listing', id: 'bike', lat: 43.2158, lng: 27.893, meta: { title: 'City bike', thumbnailUrl: null, priceCents: 42000, currency: 'EUR', category: 'Sports', mode: 'sell' } },
  { kind: 'cluster', cellId: 'busy', lat: 43.198, lng: 27.954, count: 12, by: { user: 8, event: 2, listing: 2 } },
];

const demoFeed: ActivityItem[] = [
  { id: 'event:sunset', type: 'event', category: null, title: 'Sunset Beach Meetup', preview: 'People nearby are joining tonight by the Sea Garden.', actorId: null, actorName: null, distanceM: 1800, createdAt: new Date(Date.now() - 18 * 60_000).toISOString(), unread: true, deepLink: { screen: 'EventDetail', params: { eventId: 'sunset' } } },
  { id: 'alert:coffee', type: 'alert', category: 'general', title: 'Coffee & coworking nearby', preview: 'A few people are meeting for an open coworking session this morning.', actorId: 'maria', actorName: 'Maria', distanceM: 650, createdAt: new Date(Date.now() - 45 * 60_000).toISOString(), unread: false, deepLink: { screen: 'AreaAlertDetail' } },
  { id: 'listing:bike', type: 'listing', category: null, title: 'City bike · €420', preview: 'Fresh marketplace listing near the center.', actorId: null, actorName: null, distanceM: 3400, createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), unread: false, deepLink: { screen: 'ListingDetail' } },
];

const state: State = {
  tab: 'map',
  theme: readTheme(),
  user: null,
  points: demoPoints,
  feed: demoFeed,
  kinds: new Set<EntityKind>(['user', 'event', 'listing']),
  authOpen: false,
  notice: null,
  mapCamera: DEFAULT_CAMERA,
  mapViewport: DEFAULT_VIEWPORT,
  inbox: [],
  conversations: [],
  activeConversationId: null,
  messages: [],
  connectionsLoading: false,
  realtimeConnected: false,
  conversationJoined: false,
};

const realtime = new WebRealtimeClient();
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let discoveryController: AbortController | null = null;
let connectionsRefreshTimer: number | null = null;

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('Missing #app root');
const root: HTMLDivElement = appRoot;

function token(): string | null { return accessToken; }
function readTheme(): ThemePreference {
  const saved = localStorage.getItem('nexa.web.theme');
  return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
}
function applyTheme(): void {
  const resolved = state.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : state.theme;
  document.documentElement.dataset.theme = resolved;
}
function cycleTheme(): void {
  const order: ThemePreference[] = ['system', 'dark', 'light'];
  state.theme = order[(order.indexOf(state.theme) + 1) % order.length] ?? 'system';
  localStorage.setItem('nexa.web.theme', state.theme);
  applyTheme();
  render();
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}
function assertUuid(value: string): string {
  if (!UUID_RE.test(value)) throw new Error('Invalid resource identifier');
  return value;
}
function apiUrl(path: ApiPath): string { return `${API_BASE}${path}`; }
function conversationMessagesPath(id: string): ApiPath {
  return `/conversations/${assertUuid(id)}/messages?limit=50`;
}
function conversationReadPath(id: string): ApiPath {
  return `/conversations/${assertUuid(id)}/read`;
}
function friendRequestPath(id: string, action: 'accept' | 'decline'): ApiPath {
  return `/friends/requests/${assertUuid(id)}/${action}`;
}
async function readApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new ApiError(`${response.status} ${response.statusText}`, response.status);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
async function webSessionApi<T>(path: ApiPath, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Nexa-Web-Session', '1');
  const response = await fetch(apiUrl(path), { ...init, headers, credentials: 'include' });
  return readApiResponse<T>(response);
}
async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  const pending = (async (): Promise<boolean> => {
    try {
      const result = await webSessionApi<WebAccessTokenResponse>('/auth/web/refresh', { method: 'POST' });
      accessToken = result.accessToken;
      realtime.setToken(result.accessToken);
      return true;
    } catch {
      accessToken = null;
      realtime.disconnect();
      return false;
    }
  })();

  refreshInFlight = pending;
  try {
    return await pending;
  } finally {
    if (refreshInFlight === pending) refreshInFlight = null;
  }
}
async function api<T>(path: ApiPath, init: RequestInit = {}, retryAuth = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token()) headers.set('Authorization', `Bearer ${token()}`);
  const response = await fetch(apiUrl(path), { ...init, headers, credentials: 'include' });

  if (response.status === 401 && retryAuth && token() && await refreshAccessToken()) {
    return api<T>(path, init, false);
  }

  return readApiResponse<T>(response);
}
async function login(email: string, password: string): Promise<void> {
  const result = await webSessionApi<WebLoginResponse>('/auth/web/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  accessToken = result.accessToken;
  state.user = result.user;
  state.authOpen = false;
  await connectRealtime();
  notice(`Welcome, ${result.user.displayName}.`);
  await Promise.all([loadDiscovery(), loadFeed(), loadConnections()]);
}
async function logout(): Promise<void> {
  await webSessionApi<void>('/auth/web/logout', { method: 'POST' });
  discoveryController?.abort();
  if (connectionsRefreshTimer !== null) window.clearTimeout(connectionsRefreshTimer);
  realtime.disconnect();
  accessToken = null;
  state.user = null;
  state.points = demoPoints;
  state.feed = demoFeed;
  state.inbox = [];
  state.conversations = [];
  state.activeConversationId = null;
  state.messages = [];
  state.realtimeConnected = false;
  state.conversationJoined = false;
  notice('Signed out. Demo mode active.');
}
async function restoreSession(): Promise<void> {
  if (!await refreshAccessToken()) {
    render();
    return;
  }
  try {
    state.user = await api<AuthenticatedUser>('/auth/me');
    await connectRealtime();
    await Promise.all([loadDiscovery(), loadFeed(), loadConnections()]);
  } catch {
    accessToken = null;
    state.user = null;
    realtime.disconnect();
  }
  render();
}
async function connectRealtime(): Promise<void> {
  const currentToken = token();
  if (!currentToken) return;
  try {
    await realtime.connect(currentToken, {
      onConnectionChange: (connected) => {
        state.realtimeConnected = connected;
        state.conversationJoined = false;
        if (connected && state.activeConversationId) void joinActiveConversation();
        if (state.tab === 'connections') render();
      },
      onChatMessage: handleChatMessage,
      onFriendRequest: () => scheduleConnectionsRefresh(),
      onFriendAccepted: () => scheduleConnectionsRefresh(),
      onFriendPresence: handleFriendPresence,
      onWaveReceived: () => scheduleConnectionsRefresh(),
      onWaveMutual: () => scheduleConnectionsRefresh(),
      onConversationOpened: () => scheduleConnectionsRefresh(),
      onError: (message) => {
        if (state.tab === 'connections') notice(`Realtime: ${message}`);
      },
    });
  } catch (error: unknown) {
    state.realtimeConnected = false;
    if (state.tab === 'connections') {
      notice(error instanceof Error ? error.message : 'Realtime connection unavailable.');
    }
  }
}
async function loadDiscovery(): Promise<void> {
  if (!token()) {
    state.points = demoPoints;
    return;
  }

  discoveryController?.abort();
  const controller = new AbortController();
  discoveryController = controller;

  try {
    const data = await api<DiscoveryResponse>('/discovery/nearby', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({
        viewport: state.mapViewport,
        zoom: state.mapCamera.zoom,
        kinds: [...state.kinds],
        rankBy: 'relevance',
      }),
    });
    if (controller.signal.aborted) return;
    state.points = data.points;
    render();
  } catch (error: unknown) {
    if (isAbortError(error)) return;
    state.points = demoPoints;
    notice('Live discovery unavailable; demo results shown.');
  } finally {
    if (discoveryController === controller) discoveryController = null;
  }
}
async function loadFeed(): Promise<void> {
  if (!token()) {
    state.feed = demoFeed;
    return;
  }
  try {
    state.feed = (await api<FeedResponse>('/feed?limit=24')).items;
  } catch {
    state.feed = demoFeed;
    notice('Live Pulse unavailable; demo activity shown.');
  }
  render();
}
async function loadConnections(): Promise<void> {
  if (!token()) {
    state.inbox = [];
    state.conversations = [];
    state.connectionsLoading = false;
    return;
  }

  state.connectionsLoading = true;
  if (state.tab === 'connections') render();
  try {
    const [inbox, conversations] = await Promise.all([
      api<InboxResponse>('/interactions/inbox?limit=24'),
      api<ConversationSummary[]>('/conversations'),
    ]);
    state.inbox = inbox.items;
    state.conversations = conversations;
    if (
      state.activeConversationId &&
      !conversations.some((conversation) => conversation.id === state.activeConversationId)
    ) {
      state.activeConversationId = null;
      state.messages = [];
      state.conversationJoined = false;
    }
  } catch (error: unknown) {
    notice(error instanceof Error ? `Connections unavailable: ${error.message}` : 'Connections unavailable.');
  } finally {
    state.connectionsLoading = false;
    if (state.tab === 'connections') render();
  }
}
function scheduleConnectionsRefresh(): void {
  if (!token()) return;
  if (connectionsRefreshTimer !== null) window.clearTimeout(connectionsRefreshTimer);
  connectionsRefreshTimer = window.setTimeout(() => {
    connectionsRefreshTimer = null;
    void loadConnections();
  }, 180);
}
async function openConversation(conversationId: string): Promise<void> {
  const id = assertUuid(conversationId);
  const page = await api<MessagePage>(conversationMessagesPath(id));
  state.activeConversationId = id;
  state.messages = [...page.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  state.conversationJoined = false;
  state.conversations = state.conversations.map((conversation) => (
    conversation.id === id ? { ...conversation, unreadCount: 0 } : conversation
  ));
  render();
  await api<void>(conversationReadPath(id), { method: 'POST' }).catch(() => undefined);
  await joinActiveConversation();
}
async function joinActiveConversation(): Promise<void> {
  const id = state.activeConversationId;
  if (!id || !state.realtimeConnected) return;
  const result = await realtime.joinConversation(assertUuid(id));
  state.conversationJoined = result.ok;
  if (!result.ok) notice(result.message);
  if (state.tab === 'connections') render();
}
async function sendActiveMessage(body: string): Promise<void> {
  const id = state.activeConversationId;
  const message = body.trim();
  if (!id || !message) return;
  if (message.length > 2000) throw new Error('Message is limited to 2000 characters.');
  if (!state.conversationJoined) throw new Error('Realtime chat is reconnecting.');

  const result = await realtime.sendMessage(assertUuid(id), message);
  if (!result.ok) throw new Error(result.message);
  appendMessage(result.data);
  scheduleConnectionsRefresh();
  render();
}
async function respondToFriendRequest(requestId: string, action: 'accept' | 'decline'): Promise<void> {
  await api<Record<string, boolean>>(friendRequestPath(requestId, action), { method: 'POST' });
  notice(action === 'accept' ? 'Friend request accepted.' : 'Friend request declined.');
  await loadConnections();
}
async function waveBack(userId: string): Promise<void> {
  const id = assertUuid(userId);
  await api<Record<string, unknown>>('/interactions/wave', {
    method: 'POST',
    body: JSON.stringify({ toUserId: id, context: 'profile' }),
  });
  notice('Wave sent.');
  await loadConnections();
}
function handleChatMessage(event: ChatMessageEvent): void {
  if (event.conversationId === state.activeConversationId) appendMessage(event);
  scheduleConnectionsRefresh();
  if (state.tab === 'connections') render();
}
function appendMessage(event: ChatMessageEvent): void {
  if (state.messages.some((message) => message.id === event.id)) return;
  state.messages = [...state.messages, event].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
function handleFriendPresence(event: FriendPresenceEvent): void {
  state.conversations = state.conversations.map((conversation) => {
    const peerId = peerForConversation(conversation)?.id;
    return peerId === event.userId ? { ...conversation, peerOnline: event.online } : conversation;
  });
  if (state.tab === 'connections') render();
}
function onMapViewportSettled(camera: MapCamera, viewport: MapViewport): void {
  state.mapCamera = camera;
  state.mapViewport = viewport;
  if (token()) void loadDiscovery();
}
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
function notice(message: string): void {
  state.notice = message;
  render();
  setTimeout(() => {
    if (state.notice === message) {
      state.notice = null;
      render();
    }
  }, 3800);
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'N';
}
function distance(value: number | null): string {
  return value == null ? 'Nearby' : value < 1000 ? `${Math.round(value)} m` : `${(value / 1000).toFixed(1)} km`;
}
function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
}
function verificationLabel(value: AuthenticatedUser['verification']): string {
  return value === 'none' ? 'Not verified' : `${value[0]?.toUpperCase() ?? ''}${value.slice(1)} verified`;
}
function peerForConversation(conversation: ConversationSummary): ConversationSummary['participants'][number] | null {
  const userId = state.user?.id;
  return conversation.participants.find((participant) => participant.id !== userId) ?? conversation.participants[0] ?? null;
}
function truncate(value: string, length = 78): string {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
}

function nav(tab: Tab, icon: string, tone: 'discovery' | 'action'): string {
  return `<button class="nav ${state.tab === tab ? 'active' : ''}" data-tab="${tab}" data-tone="${tone}"><span>${icon}</span><small>${tab[0]?.toUpperCase()}${tab.slice(1)}</small></button>`;
}
function shell(): string {
  return `<div class="shell"><aside class="rail"><button class="logo" data-tab="map"><i></i><b>NEXA</b></button><nav>${nav('map','⌖','discovery')}${nav('discover','◇','discovery')}${nav('pulse','≋','discovery')}${nav('connections','◎','action')}${nav('you','◉','action')}</nav><div class="rail-foot"><button id="theme">${state.theme === 'light' ? '☀' : state.theme === 'dark' ? '☾' : '◐'}</button>${state.user ? `<button class="avatar" data-tab="you">${escapeHtml(initials(state.user.displayName))}</button>` : '<button id="auth">Sign in</button>'}</div></aside><main><header>${topbar()}</header><section class="content">${view()}</section></main><nav class="mobile-nav">${nav('map','⌖','discovery')}${nav('discover','◇','discovery')}${nav('pulse','≋','discovery')}${nav('connections','◎','action')}${nav('you','◉','action')}</nav>${state.notice ? `<div class="toast">${escapeHtml(state.notice)}</div>` : ''}${authPanel()}</div>`;
}
function topbar(): string {
  const copy: Record<Tab, [string,string]> = {
    map: ['Map','What is happening around you right now.'],
    discover: ['Discover','Focused entry points into local life.'],
    pulse: ['Pulse','Useful local activity, not an endless feed.'],
    connections: ['Connections','Chats and relationship actions.'],
    you: ['You','Identity, verification, presence and account controls.'],
  };
  const [title, subtitle] = copy[state.tab];
  const liveLabel = state.tab === 'connections' && state.user
    ? (state.realtimeConnected ? 'Realtime live' : 'Realtime offline')
    : (state.user ? 'Live backend' : 'Demo mode');
  return `<div><p class="eyebrow">NEXA / ${title.toUpperCase()}</p><h1>${title}</h1><p>${subtitle}</p></div><div class="header-actions"><span class="mode"><i></i>${liveLabel}</span>${state.user ? '<button id="refresh">Refresh</button>' : '<button class="primary" id="auth-top">Connect backend</button>'}</div>`;
}
function view(): string {
  return state.tab === 'map' ? mapView() : state.tab === 'discover' ? discoverView() : state.tab === 'pulse' ? pulseView() : state.tab === 'connections' ? connectionsView() : youView();
}
function mapView(): string {
  const visible = state.points.filter((point) => point.kind === 'cluster' || state.kinds.has(point.kind));
  return `<div class="map-layout"><section class="map-card"><div class="toolbar"><div class="search">⌕ <span>Pan or zoom to search this area</span></div><div class="chips">${chip('user','People')}${chip('event','Events')}${chip('listing','Listings')}</div></div><div class="map" id="nexa-map"></div></section><aside class="panel"><div class="section-head"><div><p class="eyebrow">NEARBY NOW</p><h2>Local signals</h2></div><button id="refresh-map">Refresh</button></div>${visible.slice(0,8).map(row).join('') || '<p class="empty">No results in these filters.</p>'}<div class="create"><b>＋</b><div><strong>Create nearby</strong><p>Creation stays contextual to the current Map viewport.</p></div></div></aside></div>`;
}
function chip(kind: EntityKind, label: string): string {
  return `<button class="chip ${state.kinds.has(kind) ? 'selected' : ''}" data-kind="${kind}">${label}</button>`;
}
function row(point: DiscoveryPoint): string {
  if (point.kind === 'cluster') return `<article class="row"><b class="entity cluster">${point.count}</b><div><strong>Busy area</strong><p>${point.count} signals</p></div></article>`;
  if (point.kind === 'user') return `<article class="row"><b class="entity user">${escapeHtml(initials(point.meta.displayName))}</b><div><strong>${escapeHtml(point.meta.displayName)}${point.meta.verifiedBadge ? ' ✓' : ''}</strong><p>${point.meta.online ? 'Online now' : 'Nearby'} · ${escapeHtml(point.meta.verification)}</p></div></article>`;
  if (point.kind === 'event') return `<article class="row"><b class="entity event">◆</b><div><strong>${escapeHtml(point.meta.title)}</strong><p>${point.meta.attendeeCount} going</p></div></article>`;
  return `<article class="row"><b class="entity listing">▣</b><div><strong>${escapeHtml(point.meta.title)}</strong><p>${escapeHtml(point.meta.currency)} ${(point.meta.priceCents / 100).toFixed(0)} · ${escapeHtml(point.meta.category)}</p></div></article>`;
}
function discoverView(): string {
  return `<div class="discover">${discoverCard('Nearby people','Map → People','map','discovery')}${discoverCard('Local events','Pulse → Events','pulse','discovery')}${discoverCard('Marketplace','Map → Listings','map','action')}${discoverCard('People you may know','Connections','connections','action')}<article class="principle wide"><p class="eyebrow">DISCOVERY CONTRACT</p><h2>One city. Multiple lenses.</h2><p>Discover is a routing surface, not another ranked social feed. Spatial relevance remains authoritative on Map.</p></article></div>`;
}
function discoverCard(title: string, cta: string, target: Tab, tone: 'discovery'|'action'): string {
  return `<button class="discover-card ${tone}" data-target="${target}"><i></i><h2>${title}</h2><p>Open a focused NEXA surface without duplicating ranking or location requests.</p><strong>${cta} →</strong></button>`;
}
function pulseView(): string {
  return `<div class="pulse-layout"><section class="stream"><div class="chips"><button class="chip selected">For you</button><button class="chip">Nearby</button><button class="chip">Events</button><button class="chip">Marketplace</button></div>${state.feed.map(activity).join('') || '<p class="empty">No local activity yet.</p>'}</section><aside><article class="signal"><p class="eyebrow">CITY SIGNAL</p><b>${state.points.length}</b><span>nearby map signals</span><div class="bars"><i></i><i></i><i></i><i></i><i></i></div></article><article class="principle"><p class="eyebrow">PULSE IS NOT</p><h3>An infinite popularity feed.</h3><p>It prioritizes useful local events, alerts and listings.</p></article></aside></div>`;
}
function activity(item: ActivityItem): string {
  return `<article class="activity"><div><span>${item.type.toUpperCase()}</span><span>${ago(item.createdAt)}</span></div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.preview)}</p><footer><span>${distance(item.distanceM)}</span><span>${item.actorName ? escapeHtml(item.actorName) : 'NEXA local signal'}</span>${item.unread ? '<i></i>' : ''}</footer></article>`;
}
function connectionsView(): string {
  if (!state.user) {
    return `<div class="you-empty"><div class="identity"></div><p class="eyebrow">LIVE CONNECTIONS</p><h2>Sign in to open your private interaction inbox and chats.</h2><p>Waves, requests and conversations are loaded only for your authenticated account.</p><button class="primary" id="auth-connections">Sign in</button></div>`;
  }

  const actionable = state.inbox.filter((item) => item.type === 'wave' || item.type === 'friend_request' || item.type === 'match');
  const status = state.realtimeConnected ? 'Live' : 'Reconnecting';
  return `<div class="connections-live"><section class="connection-card inbox-card"><div class="section-head"><div><p class="eyebrow">ACTIONABLE</p><h2>Needs your attention</h2></div><b class="badge">${actionable.length}</b></div>${state.connectionsLoading && state.inbox.length === 0 ? '<p class="empty">Loading interactions…</p>' : state.inbox.slice(0, 12).map(inboxRow).join('') || '<p class="empty">Nothing needs your attention.</p>'}</section><section class="connection-card conversations-card"><div class="section-head"><div><p class="eyebrow">CONVERSATIONS</p><h2>Recent chats</h2></div><span class="socket-state">${status}</span></div>${state.connectionsLoading && state.conversations.length === 0 ? '<p class="empty">Loading conversations…</p>' : state.conversations.slice(0, 20).map(conversationRow).join('') || '<p class="empty">No conversations yet.</p>'}</section>${activeChatView()}</div>`;
}
function inboxRow(item: InboxItem): string {
  const actor = escapeHtml(item.fromUser.displayName);
  const face = escapeHtml(initials(item.fromUser.displayName));
  if (item.type === 'friend_request' && item.requestId && UUID_RE.test(item.requestId)) {
    const requestId = escapeHtml(item.requestId);
    return `<article class="interaction-row"><b class="connection-face">${face}</b><div><strong>${actor}</strong><p>Sent you a friend request · ${ago(item.createdAt)}</p></div><div class="row-actions"><button data-action="accept-friend" data-request-id="${requestId}">Accept</button><button data-action="decline-friend" data-request-id="${requestId}">Decline</button></div></article>`;
  }
  if (item.type === 'wave' && UUID_RE.test(item.fromUser.id)) {
    return `<article class="interaction-row"><b class="connection-face wave">≈</b><div><strong>${actor} waved at you</strong><p>${ago(item.createdAt)}${item.isMutual ? ' · mutual' : ''}</p></div><button data-action="wave-back" data-wave-user-id="${escapeHtml(item.fromUser.id)}">Wave back</button></article>`;
  }
  if (item.type === 'match' && item.match?.conversationId && UUID_RE.test(item.match.conversationId)) {
    return `<article class="interaction-row"><b class="connection-face">${face}</b><div><strong>New match with ${actor}</strong><p>${ago(item.createdAt)}</p></div><button data-action="open-chat" data-conversation-id="${escapeHtml(item.match.conversationId)}">Open chat</button></article>`;
  }

  const detail = item.type === 'gift' && item.gift
    ? `${item.gift.emoji} ${item.gift.label}`
    : item.type === 'follow'
      ? 'Started following you'
      : item.type === 'story_reaction'
        ? `Reacted to your story${item.reactionKind ? ` · ${item.reactionKind}` : ''}`
        : item.type === 'notification'
          ? 'New activity'
          : item.type.replace('_', ' ');
  return `<article class="interaction-row passive"><b class="connection-face">${face}</b><div><strong>${actor}</strong><p>${escapeHtml(detail)} · ${ago(item.createdAt)}</p></div></article>`;
}
function conversationRow(conversation: ConversationSummary): string {
  const peer = peerForConversation(conversation);
  const name = peer?.displayName ?? 'Conversation';
  const unread = conversation.unreadCount ?? 0;
  const last = conversation.lastMessage?.body ? truncate(conversation.lastMessage.body) : 'No messages yet';
  const online = conversation.peerOnline === true ? '<i class="online-dot"></i>' : '';
  const active = conversation.id === state.activeConversationId ? ' active' : '';
  const id = UUID_RE.test(conversation.id) ? escapeHtml(conversation.id) : '';
  return `<button class="conversation-row${active}" data-action="open-chat" data-conversation-id="${id}" ${id ? '' : 'disabled'}><b class="connection-face">${escapeHtml(initials(name))}</b><div><strong>${escapeHtml(name)} ${online}</strong><p>${escapeHtml(last)}</p></div><span>${unread > 0 ? `<b class="unread-count">${Math.min(unread, 99)}</b>` : (conversation.lastMessageAt ? ago(conversation.lastMessageAt) : '')}</span></button>`;
}
function activeChatView(): string {
  const id = state.activeConversationId;
  if (!id) return `<section class="chat-panel"><div class="chat-placeholder"><p class="eyebrow">PRIVATE CHAT</p><h2>Select a conversation</h2><p>Messages stay scoped to conversations you participate in. Realtime sending becomes available after the room join is acknowledged.</p></div></section>`;
  const conversation = state.conversations.find((item) => item.id === id);
  const peer = conversation ? peerForConversation(conversation) : null;
  const name = peer?.displayName ?? 'Conversation';
  const roomState = state.conversationJoined ? 'Room joined' : (state.realtimeConnected ? 'Joining room…' : 'Realtime offline');
  return `<section class="chat-panel"><header class="chat-head"><div><p class="eyebrow">PRIVATE CHAT</p><h2>${escapeHtml(name)}</h2><p>${roomState}</p></div><span>${conversation?.peerOnline === true ? 'Online' : 'Private 1:1'}</span></header><div class="message-list" id="message-list">${state.messages.map(messageRow).join('') || '<p class="empty">No messages yet. Start the conversation.</p>'}</div><form class="chat-composer" id="chat-composer"><input id="chat-input" type="text" maxlength="2000" autocomplete="off" placeholder="Message…" ${state.conversationJoined ? '' : 'disabled'}><button class="primary" type="submit" ${state.conversationJoined ? '' : 'disabled'}>Send</button></form></section>`;
}
function messageRow(message: ChatMessage): string {
  const mine = message.senderId === state.user?.id;
  const body = message.type === 'text' ? message.body : message.type === 'location' ? 'Shared a location' : 'Shared live location';
  return `<article class="message ${mine ? 'mine' : 'peer'}"><p>${escapeHtml(body)}</p><small>${mine ? 'You' : 'Peer'} · ${ago(message.createdAt)}</small></article>`;
}
function youView(): string {
  if (!state.user) return `<div class="you-empty"><div class="identity"></div><p class="eyebrow">YOUR NEXA IDENTITY</p><h2>Connect the live backend to open your identity surface.</h2><p>Map presence, verification and privacy belong here—not in a vanity feed.</p><button class="primary" id="auth-you">Sign in</button></div>`;
  const verification = verificationLabel(state.user.verification);
  return `<div class="you"><section class="identity-card"><div class="profile">${escapeHtml(initials(state.user.displayName))}</div><div><p class="eyebrow">SIGNED IN</p><h2>${escapeHtml(state.user.displayName)}</h2><p>${escapeHtml(state.user.email)}</p></div><span>${escapeHtml(verification)}</span></section><section class="trust"><div><p class="eyebrow">VERIFICATION SIGNAL</p><h2>${escapeHtml(verification)}</h2><p>Web v1 renders the factual verification level returned by the backend. It does not calculate or expose a public numeric trust score.</p></div></section><button class="danger" id="logout">Sign out of web preview</button></div>`;
}
function authPanel(): string {
  return `<dialog class="auth-dialog" ${state.authOpen ? 'open' : ''}><form id="login"><button type="button" id="close">×</button><div class="logo auth-logo"><i></i><b>NEXA</b></div><p class="eyebrow">LIVE BACKEND</p><h2>Sign in to NEXA</h2><p>The access token stays in memory. The refresh credential is held by the backend in an HttpOnly SameSite cookie and is never exposed to browser JavaScript.</p><label>Email<input id="email" type="email" required autocomplete="email"></label><label>Password<input id="password" type="password" minlength="8" required autocomplete="current-password"></label><button class="primary" type="submit">Connect live backend</button><small>Local preview targets backend port 3001. Production uses same-origin <code>/api/v1</code> and <code>/socket.io</code> edge routes.</small></form></dialog>`;
}

function safeFragment(html: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  for (const element of [...parsed.body.querySelectorAll('*')]) {
    if (!SAFE_TAGS.has(element.tagName)) {
      element.remove();
      continue;
    }
    for (const attribute of [...element.attributes]) {
      if (SAFE_ATTRIBUTES.has(attribute.name)) continue;
      element.removeAttribute(attribute.name);
    }
  }

  const fragment = document.createDocumentFragment();
  for (const child of [...parsed.body.childNodes]) fragment.append(document.importNode(child, true));
  return fragment;
}

function bind(): void {
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach((element) => element.addEventListener('click', () => {
    const tab = element.dataset.tab as Tab | undefined;
    if (tab) {
      state.tab = tab;
      render();
    }
  }));
  document.querySelectorAll<HTMLElement>('[data-target]').forEach((element) => element.addEventListener('click', () => {
    const tab = element.dataset.target as Tab | undefined;
    if (tab) {
      state.tab = tab;
      render();
    }
  }));
  document.querySelectorAll<HTMLElement>('[data-kind]').forEach((element) => element.addEventListener('click', () => {
    const kind = element.dataset.kind as EntityKind | undefined;
    if (!kind) return;
    if (state.kinds.has(kind) && state.kinds.size > 1) state.kinds.delete(kind);
    else state.kinds.add(kind);
    render();
    if (token()) void loadDiscovery();
  }));
  document.querySelectorAll<HTMLElement>('[data-action="open-chat"]').forEach((element) => element.addEventListener('click', () => {
    const id = element.dataset.conversationId;
    if (!id) return;
    void openConversation(id).catch((error: unknown) => notice(error instanceof Error ? error.message : 'Could not open conversation.'));
  }));
  document.querySelectorAll<HTMLElement>('[data-action="accept-friend"],[data-action="decline-friend"]').forEach((element) => element.addEventListener('click', () => {
    const id = element.dataset.requestId;
    if (!id) return;
    const action = element.dataset.action === 'accept-friend' ? 'accept' : 'decline';
    void respondToFriendRequest(id, action).catch((error: unknown) => notice(error instanceof Error ? error.message : 'Friend request action failed.'));
  }));
  document.querySelectorAll<HTMLElement>('[data-action="wave-back"]').forEach((element) => element.addEventListener('click', () => {
    const userId = element.dataset.waveUserId;
    if (!userId) return;
    void waveBack(userId).catch((error: unknown) => notice(error instanceof Error ? error.message : 'Wave failed.'));
  }));
  document.querySelector('#theme')?.addEventListener('click', cycleTheme);
  document.querySelector('#refresh')?.addEventListener('click', () => {
    if (state.tab === 'connections') void loadConnections();
    else if (state.tab === 'pulse') void loadFeed();
    else void loadDiscovery();
  });
  document.querySelector('#refresh-map')?.addEventListener('click', () => void loadDiscovery());
  document.querySelector('#logout')?.addEventListener('click', () => {
    void logout().catch((error: unknown) => notice(error instanceof Error ? `Sign out failed: ${error.message}` : 'Sign out failed. Retry while connected.'));
  });
  ['#auth','#auth-top','#auth-you','#auth-connections'].forEach((selector) => document.querySelector(selector)?.addEventListener('click', () => {
    state.authOpen = true;
    render();
  }));
  document.querySelector('#close')?.addEventListener('click', () => {
    state.authOpen = false;
    render();
  });
  document.querySelector<HTMLFormElement>('#login')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.querySelector<HTMLInputElement>('#email')?.value.trim() ?? '';
    const password = document.querySelector<HTMLInputElement>('#password')?.value ?? '';
    void login(email, password).catch((error: unknown) => notice(error instanceof Error ? error.message : 'Sign in failed.'));
  });
  document.querySelector<HTMLFormElement>('#chat-composer')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.querySelector<HTMLInputElement>('#chat-input');
    const body = input?.value ?? '';
    if (input) input.disabled = true;
    void sendActiveMessage(body)
      .then(() => { if (input) input.value = ''; })
      .catch((error: unknown) => notice(error instanceof Error ? error.message : 'Message failed.'))
      .finally(() => { if (input && state.conversationJoined) input.disabled = false; });
  });

  const map = document.querySelector<HTMLElement>('#nexa-map');
  if (map) {
    const visiblePoints = state.points.filter((point) => point.kind === 'cluster' || state.kinds.has(point.kind));
    mountNexaMap({
      container: map,
      points: visiblePoints,
      camera: state.mapCamera,
      onViewportSettled: onMapViewportSettled,
    });
  }

  const messageList = document.querySelector<HTMLElement>('#message-list');
  if (messageList) messageList.scrollTop = messageList.scrollHeight;
}
function render(): void {
  root.replaceChildren(safeFragment(shell()));
  bind();
}

matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (state.theme === 'system') {
    applyTheme();
    render();
  }
});
applyTheme();
render();
void restoreSession();
