import {
  assert,
  cleanupChrome,
  createTab,
  evaluate,
  launchChrome,
  waitFor,
} from './chrome-cdp.mjs';

const webOrigin = parsePublicHttpsOrigin(process.env.WEB_ORIGIN);
const requireAuth = process.env.WEB_SMOKE_REQUIRE_AUTH === '1';
const email = process.env.WEB_SMOKE_EMAIL?.trim() ?? '';
const password = process.env.WEB_SMOKE_PASSWORD ?? '';

await validatePublicEdge(webOrigin);
await validateWebSocketUpgrade(webOrigin);

if (email && password) {
  await validateAuthenticatedBrowserFlow(webOrigin, email, password);
} else if (requireAuth) {
  throw new Error('Authenticated deployed smoke is required but WEB_SMOKE_EMAIL/WEB_SMOKE_PASSWORD are not configured.');
} else {
  console.log('NEXA deployed public smoke passed; authenticated browser flow skipped because staging credentials are not configured.');
}

function parsePublicHttpsOrigin(value) {
  if (!value) throw new Error('WEB_ORIGIN is required');
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error('WEB_ORIGIN must use HTTPS');
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('WEB_ORIGIN must be a bare HTTPS origin');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname === '0.0.0.0' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '169.254.169.254' ||
    isPrivateIpv4(hostname)
  ) {
    throw new Error('WEB_ORIGIN must resolve to a public staging/production hostname');
  }

  return parsed.origin;
}

function isPrivateIpv4(hostname) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(hostname);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((value) => value < 0 || value > 255)) return true;
  const [a, b] = octets;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

async function validatePublicEdge(origin) {
  const health = await fetchWithColdStartRetry(`${origin}/healthz`, 90_000);
  assert(health.status === 200, `edge health returned ${health.status}`);
  const healthBody = await health.json();
  assert(healthBody?.ok === true, `edge health payload is invalid: ${JSON.stringify(healthBody)}`);

  const root = await fetchStrict(`${origin}/`);
  assert(root.status === 200, `web root returned ${root.status}`);
  const html = await root.text();
  assert(html.includes('NEXA'), 'web root does not contain NEXA shell');

  const csp = root.headers.get('content-security-policy') ?? '';
  const permissions = root.headers.get('permissions-policy') ?? '';
  assert(csp.includes("default-src 'self'"), 'deployed root is missing restrictive CSP');
  assert(csp.includes("frame-ancestors 'none'"), 'deployed root CSP does not deny framing');
  assert(permissions.includes('geolocation=()'), 'deployed root does not disable geolocation');
  assert(permissions.includes('camera=()'), 'deployed root does not disable camera');
  assert(permissions.includes('microphone=()'), 'deployed root does not disable microphone');
  assert(root.headers.get('x-content-type-options') === 'nosniff', 'deployed root is missing nosniff');

  // A protected backend path must reach Nest through the same-origin edge. A
  // 404 means the proxy is not mounted; a 5xx means the upstream is unhealthy.
  const protectedResponse = await fetchStrict(`${origin}/api/v1/auth/me`);
  assert(
    protectedResponse.status === 401 || protectedResponse.status === 403,
    `same-origin API proxy returned unexpected status ${protectedResponse.status}`,
  );
}

async function validateWebSocketUpgrade(origin) {
  const socketUrl = new URL('/socket.io/?EIO=4&transport=websocket', origin);
  socketUrl.protocol = 'wss:';

  const firstPacket = await new Promise((resolve, reject) => {
    const socket = new WebSocket(socketUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('timed out waiting for Engine.IO WebSocket open packet'));
    }, 20_000);

    socket.addEventListener('message', (event) => {
      clearTimeout(timeout);
      const payload = String(event.data);
      socket.close();
      resolve(payload);
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('same-origin /socket.io WebSocket upgrade failed'));
    }, { once: true });
  });

  assert(typeof firstPacket === 'string' && firstPacket.startsWith('0{'), `unexpected Engine.IO open packet: ${String(firstPacket)}`);
}

async function validateAuthenticatedBrowserFlow(origin, loginEmail, loginPassword) {
  const runtime = await launchChrome('nexa-deployed-smoke-');
  try {
    const tab = await createTab(
      runtime.cdp,
      `${origin}/`,
      "document.querySelector('[data-tab=\"connections\"]') !== null",
    );

    await waitFor(
      async () => await evaluate(runtime.cdp, tab, "document.body.textContent.includes('Demo mode') || document.body.textContent.includes('Live backend')"),
      20_000,
      'initial deployed app state',
    );

    const alreadySignedIn = await evaluate(runtime.cdp, tab, "document.body.textContent.includes('Live backend')");
    if (!alreadySignedIn) {
      await evaluate(runtime.cdp, tab, "document.querySelector('#auth-top')?.click()");
      await waitFor(
        async () => await evaluate(runtime.cdp, tab, "document.querySelector('#login') !== null"),
        5_000,
        'login form',
      );

      await evaluate(runtime.cdp, tab, `(() => {
        const email = document.querySelector('#email');
        const password = document.querySelector('#password');
        const form = document.querySelector('#login');
        if (!(email instanceof HTMLInputElement) || !(password instanceof HTMLInputElement) || !(form instanceof HTMLFormElement)) {
          throw new Error('deployed login form is incomplete');
        }
        email.value = ${JSON.stringify(loginEmail)};
        password.value = ${JSON.stringify(loginPassword)};
        form.requestSubmit();
      })()`);
    }

    await waitFor(
      async () => await evaluate(runtime.cdp, tab, "document.body.textContent.includes('Live backend')"),
      20_000,
      'authenticated browser session',
    );

    assert(
      await evaluate(runtime.cdp, tab, "!document.cookie.includes('nexa_web_refresh=')"),
      'HttpOnly refresh cookie became visible to browser JavaScript',
    );
    assert(
      await evaluate(runtime.cdp, tab, "![...Object.keys(localStorage), ...Object.keys(sessionStorage)].some((key) => /token|refresh|access|credential/i.test(key))"),
      'credential-like key was persisted in Web Storage',
    );

    const refreshStatus = await evaluate(runtime.cdp, tab, `fetch('/api/v1/auth/web/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Nexa-Web-Session': '1' },
    }).then((response) => response.status)`);
    assert(refreshStatus === 200, `deployed HttpOnly refresh rotation returned ${refreshStatus}`);
    assert(
      await evaluate(runtime.cdp, tab, "!document.cookie.includes('nexa_web_refresh=')"),
      'rotated HttpOnly refresh cookie became visible to browser JavaScript',
    );

    await evaluate(runtime.cdp, tab, "document.querySelector('[data-tab=\"connections\"]')?.click()");
    await waitFor(
      async () => await evaluate(runtime.cdp, tab, "document.body.textContent.includes('Realtime live')"),
      20_000,
      'authenticated Socket.IO /realtime connection',
    );

    await evaluate(runtime.cdp, tab, "document.querySelector('[data-tab=\"you\"]')?.click()");
    await waitFor(
      async () => await evaluate(runtime.cdp, tab, "document.querySelector('#logout') !== null"),
      5_000,
      'logout control',
    );
    await evaluate(runtime.cdp, tab, "document.querySelector('#logout')?.click()");
    await waitFor(
      async () => await evaluate(runtime.cdp, tab, "document.body.textContent.includes('Demo mode')"),
      20_000,
      'deployed logout completion',
    );

    console.log('NEXA deployed authenticated smoke passed: login, HttpOnly refresh rotation, realtime connection and logout.');
  } catch (error) {
    const chromeErrors = runtime.errors();
    if (chromeErrors) console.error(chromeErrors);
    throw error;
  } finally {
    await cleanupChrome(runtime);
  }
}

async function fetchWithColdStartRetry(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetchStrict(url);
      if (response.status < 500) return response;
      lastError = new Error(`received ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`deployed service did not become healthy: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
}

async function fetchStrict(url) {
  return fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': 'NEXA-deployed-smoke/1.0' },
  });
}
