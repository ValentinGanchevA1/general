# NEXUS v8 private LAN preview — legacy listener retired

The legacy TCP 4175 diagnostic listener is disabled. Clear-text LAN preview is not supported.

Use the opt-in TLS **static-only** preview documented in [HTTPS-LAN-PREVIEW.md](./HTTPS-LAN-PREVIEW.md). It binds to the explicitly configured private IPv4 on TCP 4176 and serves only allowlisted web assets. API routes, login, writes and Socket.IO are denied; no backend proxy is opened.

Do not restore the legacy listener or weaken the app's HTTPS-only non-loopback map policy. Use synthetic UI data and a dedicated test device. Nothing is deployed or migrated.
