'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertLanAddress, parseRequestTarget, isApi, isAllowedHost,
  staticPath, MIME,
} = require('./lan-preview.cjs');

test('LAN binding rejects wildcard, loopback and public IPv4', () => {
  for (const value of ['0.0.0.0', '127.0.0.1', '8.8.8.8', '::', 'localhost', '']) {
    assert.throws(() => assertLanAddress(value));
  }
  for (const value of ['192.168.1.15', '10.0.0.9', '172.16.0.2', '172.31.255.1']) {
    assert.equal(assertLanAddress(value), value);
  }
});

test('request target parser accepts only origin-form and rejects path normalization tricks', () => {
  assert.equal(parseRequestTarget('https://evil.example/api/v1'), null);
  assert.equal(parseRequestTarget('//evil.example/api/v1'), null);
  assert.equal(parseRequestTarget('/%2e%2e/.env'), null);
  assert.equal(parseRequestTarget('/%252e%252e/.env'), null);
  assert.equal(parseRequestTarget('/%2e%2e%2f.env'), null);
  assert.equal(parseRequestTarget('/%5c..%5c.env'), null);
  assert.equal(parseRequestTarget('/%ZZ'), null);
  assert.equal(parseRequestTarget('/api/v1#https://evil.example'), null);
  assert.equal(parseRequestTarget('/api/v1?x=1').search, '?x=1');
});

test('dynamic API and Socket.IO paths are identified for denial by the static-only preview', () => {
  for (const value of ['/api/v1', '/api/v1/health', '/socket.io/']) {
    assert.equal(isApi(value), true);
  }
  for (const value of ['/', '/api/v10', '/socket.io.evil', '/health']) {
    assert.equal(isApi(value), false);
  }
});

test('LAN HTTP Host and Origin must match the configured TLS listener', () => {
  const address = '192.168.1.15';
  assert.equal(isAllowedHost({ host: address + ':4176', origin: 'https://' + address + ':4176' }, address), true);
  assert.equal(isAllowedHost({ host: 'evil.example:4176', origin: 'https://evil.example:4176' }, address), false);
  assert.equal(isAllowedHost({ host: address + ':4176', origin: 'https://evil.example' }, address), false);
  assert.equal(isAllowedHost({ host: address + ':4176' }, address), true);
});

test('static serving cannot escape web root or expose unapproved files', () => {
  assert.equal(staticPath('/../../.env'), null);
  assert.equal(staticPath('/%2e%2e/%2e%2e/package.json'), null);
  assert.equal(staticPath('/%252e%252e/package.json'), null);
  assert.equal(staticPath('/%5c..%5c.env'), null);
  assert.match(staticPath('/'), /web[\\/]index\.html$/);
});

test('legacy clear-text LAN preview is disabled', async () => {
  const preview = await import('./lan-preview.mjs');
  assert.throws(
    () => preview.start(),
    /Legacy LAN HTTP preview is disabled/,
  );
});

test('JavaScript module assets receive a browser-compatible MIME type', () => {
  assert.equal(MIME['.mjs'], 'text/javascript; charset=utf-8');
});
