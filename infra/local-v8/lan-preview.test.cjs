'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertLanAddress, parseRequestTarget, isApi, isAllowedHost,
  staticPath, proxyHeaders, safeResponseHeaders,
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

test('proxy permits only API and Socket.IO paths', () => {
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

test('proxy forwards only required application headers and pins backend origin', () => {
  const headers = proxyHeaders({
    host: 'evil.test',
    origin: 'https://evil.test',
    authorization: 'Bearer synthetic-test-token',
    cookie: 'session=synthetic',
    'x-forwarded-for': '1.2.3.4',
    'x-forwarded-proto': 'https',
    'proxy-authorization': 'attacker',
    connection: 'close',
  });
  assert.equal(headers.host, '127.0.0.1:33188');
  assert.equal(headers.origin, 'http://127.0.0.1:33188');
  assert.equal(headers.authorization, 'Bearer synthetic-test-token');
  assert.equal(headers.cookie, 'session=synthetic');
  assert.equal(headers['x-forwarded-for'], undefined);
  assert.equal(headers['x-forwarded-proto'], undefined);
  assert.equal(headers['proxy-authorization'], undefined);
  assert.equal(headers.connection, undefined);
});

test('upstream response cannot create an external redirect or hop-by-hop response headers', () => {
  const headers = safeResponseHeaders({
    'content-type': 'application/json',
    location: 'https://evil.example/steal',
    connection: 'keep-alive',
    'transfer-encoding': 'chunked',
    'set-cookie': 'session=synthetic; HttpOnly',
  });
  assert.equal(headers['content-type'], 'application/json');
  assert.equal(headers.location, undefined);
  assert.equal(headers.connection, undefined);
  assert.equal(headers['transfer-encoding'], undefined);
  assert.equal(headers['set-cookie'], 'session=synthetic; HttpOnly');
});

test('static serving cannot escape web root or expose unapproved files', () => {
  assert.equal(staticPath('/../../.env'), null);
  assert.equal(staticPath('/%2e%2e/%2e%2e/package.json'), null);
  assert.equal(staticPath('/%252e%252e/package.json'), null);
  assert.equal(staticPath('/%5c..%5c.env'), null);
  assert.match(staticPath('/'), /web[\\/]index\.html$/);
});

test('read-only HTTP LAN preview rejects ambiguous targets and untrusted hosts', async () => {
  const preview = await import('./lan-preview.mjs');
  assert.equal(preview.parseRequestTarget('http://evil.example/api/v1/feed'), null);
  assert.equal(preview.parseRequestTarget('//evil.example/api/v1/feed'), null);
  assert.equal(preview.parseRequestTarget('/%2e%2e/.env'), null);
  assert.equal(preview.parseRequestTarget('/%252e%252e/.env'), null);
  assert.equal(preview.parseRequestTarget('/%5c..%5c.env'), null);
  assert.equal(preview.isAllowedHost(
    { host: '192.168.1.15:4175', origin: 'http://192.168.1.15:4175' },
    '192.168.1.15',
  ), true);
  assert.equal(preview.isAllowedHost(
    { host: 'evil.example:4175', origin: 'http://evil.example:4175' },
    '192.168.1.15',
  ), false);
  assert.equal(preview.staticPath('/%2e%2e/package.json'), null);
});
