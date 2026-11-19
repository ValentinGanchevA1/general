'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {assertLanAddress,isApi,staticPath,proxyHeaders} = require('./lan-preview.cjs');
test('LAN binding rejects wildcard, loopback and public IPv4',()=>{
 for(const value of ['0.0.0.0','127.0.0.1','8.8.8.8','::','localhost','']) assert.throws(()=>assertLanAddress(value));
 for(const value of ['192.168.1.15','10.0.0.9','172.16.0.2','172.31.255.1']) assert.equal(assertLanAddress(value),value);
});
test('proxy permits only API and Socket.IO paths',()=>{
 for(const value of ['/api/v1','/api/v1/health','/socket.io/']) assert.equal(isApi(value),true);
 for(const value of ['/','/api/v10','/socket.io.evil','/health']) assert.equal(isApi(value),false);
});
test('proxy strips client forwarding headers and pins backend origin',()=>{
 const headers=proxyHeaders({host:'evil.test',origin:'https://evil.test','x-forwarded-for':'1.2.3.4','x-forwarded-proto':'https'});
 assert.equal(headers.host,'127.0.0.1:33188');
 assert.equal(headers.origin,'http://127.0.0.1:33188');
 assert.equal(headers['x-forwarded-for'],undefined);
 assert.equal(headers['x-forwarded-proto'],undefined);
});
test('static serving cannot escape web root',()=>{
 assert.equal(staticPath('/../../.env'),null);
 assert.equal(staticPath('/%2e%2e/%2e%2e/package.json'),null);
 assert.equal(staticPath('/%5c..%5c.env'),null);
 assert.match(staticPath('/'),/web[\\/]index\.html$/);
});
