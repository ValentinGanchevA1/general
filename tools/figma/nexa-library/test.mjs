/**
 * Structural smoke-test of the generated NEXA Figma plugin.
 * Does NOT replace visual inspection in Figma Desktop.
 *
 * node --test tools/figma/nexa-library/test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'plugin.template.js'), 'utf8');
const bundle = readFileSync(join(here, 'code.js'), 'utf8');
const tokens = JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8'));
const marker = '/*__NEXA_TOKEN_PAYLOAD__*/';
const requireLocal = createRequire(import.meta.url);
const pluginPath = join(here, 'code.js');

function fakeFigma({ maxModes = Number.POSITIVE_INFINITY, maxPages = Number.POSITIVE_INFINITY } = {}) {
  let counter = 0;
  const id = () => 'node:' + (++counter);
  const pages = [];
  const groups = [];
  const variables = [];
  const textStyles = [];
  const effectStyles = [];
  let currentPage = null;
  let close;
  const done = new Promise((resolve) => { close = resolve; });

  function node(type) {
    const value = {
      id: id(), type, name: '', children: [], parent: null, x: 0, y: 0, width: 10, height: 10,
      fills: [], strokes: [], opacity: 1, fontSize: 15, cornerRadius: 0, variables: {},
      appendChild(child) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = this;
        this.children.push(child);
      },
      resize(w, h) { this.width = w; this.height = h; },
      resizeWithoutConstraints(w, h) { this.resize(w, h); },
      setBoundVariable(field, variable) { this.variables[field] = variable.id; },
      addComponentProperty(name, type, defaultValue) {
        this.properties ??= {};
        const key = name + '#' + Object.keys(this.properties).length;
        this.properties[key] = { type, defaultValue };
        return key;
      },
    };
    if (type === 'TEXT') {
      let chars = '';
      Object.defineProperty(value, 'characters', {
        get() { return chars; },
        set(next) { chars = next; this.width = Math.max(8, chars.length * this.fontSize * 0.52); this.height = this.fontSize * 1.3; },
      });
    }
    if (currentPage && type !== 'PAGE') currentPage.appendChild(value);
    return value;
  }
  function style() {
    return { id: id(), name: '' };
  }
  const figma = {
    root: { children: pages },
    get currentPage() { return currentPage; },
    createPage() {
      if (pages.length >= maxPages) throw new Error('Starter plan page limit reached');
      const page = node('PAGE');
      pages.push(page);
      currentPage ??= page;
      return page;
    },
    async setCurrentPageAsync(page) { currentPage = page; },
    async loadFontAsync() {},
    createComponent: () => node('COMPONENT'),
    createSection: () => node('SECTION'),
    createRectangle: () => node('RECTANGLE'),
    createEllipse: () => node('ELLIPSE'),
    createText: () => node('TEXT'),
    createStar: () => node('STAR'),
    combineAsVariants(components, page) {
      const set = node('COMPONENT_SET');
      page.appendChild(set);
      for (const component of components) set.appendChild(component);
      return set;
    },
    variables: {
      async getLocalVariableCollectionsAsync() { return [...groups]; },
      async getLocalVariablesAsync() { return [...variables]; },
      createVariableCollection(name) {
        const collection = {
          id: id(), name, modes: [{ modeId: id(), name: 'Mode 1' }],
          renameMode(modeId, newName) { this.modes.find((x) => x.modeId === modeId).name = newName; },
          addMode(newName) { if (this.modes.length >= maxModes) throw new Error('Mode limit reached on Starter plan'); const modeId = id(); this.modes.push({ modeId, name: newName }); return modeId; },
        };
        groups.push(collection);
        return collection;
      },
      createVariable(name, group, type) {
        const variable = {
          id: id(), name, variableCollectionId: group.id, resolvedType: type, valuesByMode: {}, scopes: [],
          setVariableCodeSyntax(platform, syntax) { this.codeSyntax ??= {}; this.codeSyntax[platform] = syntax; },
          setValueForMode(mode, value) {
            if (type === 'COLOR') {
              for (const channel of ['r', 'g', 'b', 'a']) {
                assert.equal(typeof value[channel], 'number', 'Figma COLOR values require RGBA channel ' + channel);
                assert.ok(value[channel] >= 0 && value[channel] <= 1, 'RGBA channel is outside 0..1: ' + channel);
              }
            }
            this.valuesByMode[mode] = value;
          },
        };
        variables.push(variable);
        return variable;
      },
      setBoundVariableForPaint(paint, field, variable) {
        return { ...paint, boundVariables: { [field]: variable.id } };
      },
    },
    async getLocalTextStylesAsync() { return [...textStyles]; },
    createTextStyle() { const entry = style(); textStyles.push(entry); return entry; },
    async getLocalEffectStylesAsync() { return [...effectStyles]; },
    createEffectStyle() { const entry = style(); effectStyles.push(entry); return entry; },
    viewport: { scrollAndZoomIntoView() {} },
    closePlugin: (message) => close(message),
  };
  return { figma, pages, groups, variables, textStyles, effectStyles, done };
}

async function runOnce(figma) {
  const finished = new Promise((resolve) => { figma.closePlugin = resolve; });
  // Execute only the committed, fixed-path local plugin module (not arbitrary source text).
  // Clear the Node module cache so repeated runs exercise the real entrypoint.
  const moduleId = requireLocal.resolve(pluginPath);
  delete requireLocal.cache[moduleId];
  const previousFigma = globalThis.figma;
  globalThis.figma = figma;
  requireLocal(moduleId);
  const message = await Promise.race([
    finished,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Plugin did not finish')), 5000)),
  ]);
  globalThis.figma = previousFigma;
  assert.match(message, /^NEXA design library synced:/);
  return JSON.parse(message.slice(message.indexOf('{')));
}

test('compiled bundle reflects current token snapshot', () => {
  assert.equal(source.split(marker).length, 2);
  assert.equal(bundle, source.replace(marker, 'const NEXA_TOKENS = ' + JSON.stringify(tokens) + ';'));
  for (const mode of ['Dark', 'Light', 'Protos Nexus']) {
    assert.deepEqual(Object.keys(tokens.colors[mode]), Object.keys(tokens.colors.Dark));
  }
  assert.equal(Object.keys(tokens.colors.Dark).length, 81);
});

test('creates nine component families, binds tokens, then reruns without duplicates', async () => {
  const ctx = fakeFigma();
  const first = await runOnce(ctx.figma);
  assert.equal(first.components, 9);
  assert.equal(ctx.groups.length, 5);
  assert.equal(ctx.variables.length,
    Object.keys(tokens.colors.Dark).length + Object.keys(tokens.spacing).length +
    Object.keys(tokens.radius).length + Object.keys(tokens.fontSize).length +
    Object.keys(tokens.layout).length);
  const colorCollection = ctx.groups.find((entry) => entry.name === 'NEXA / Colors');
  assert.deepEqual(colorCollection.modes.map((entry) => entry.name), ['Dark', 'Light', 'Protos Nexus']);
  assert.equal(ctx.textStyles.length, 6);
  const primaryVar = ctx.variables.find((entry) => entry.name === 'actionPrimary' &&
    entry.variableCollectionId === colorCollection.id);
  assert.ok(primaryVar);
  for (const value of Object.values(primaryVar.valuesByMode)) {
    assert.equal(typeof value.a, 'number', 'COLOR variables must be RGBA, not RGB');
  }
  assert.equal(ctx.effectStyles.length, 4);
  const page = ctx.pages.find((candidate) => candidate.name === 'NEXA · Component Library');
  const families = page.children.filter((candidate) => candidate.type === 'COMPONENT_SET');
  assert.equal(families.length, 9);
  const mapPins = families.find((entry) => entry.name === 'MapPin');
  assert.equal(mapPins.children.length, 9);
  assert.ok(mapPins.children.some((variant) => variant.name === 'Entity=Person, Density=Compact'));
  assert.ok(mapPins.children.some((variant) => variant.name === 'Entity=Event, Density=Selected'));
  const avatars = families.find((entry) => entry.name === 'Avatar');
  assert.equal(avatars.children.length, 5);
  for (const ring of ['None', 'Brand', 'Friend', 'Story', 'Verified']) {
    assert.ok(avatars.children.some((component) => component.name === 'Ring=' + ring));
  }
  const badges = families.find((entry) => entry.name === 'VerificationBadge');
  assert.equal(badges.children.length, 2);
  const partial = badges.children.find((component) => component.name === 'Level=Partial');
  const verified = badges.children.find((component) => component.name === 'Level=ID');
  assert.ok(partial);
  assert.ok(verified);
  assert.equal(partial.children.filter((node) => node.type === 'STAR').length, 0);
  const decagram = verified.children.find((node) => node.type === 'STAR');
  assert.ok(decagram, 'ID verification must have a decagram silhouette');
  assert.equal(decagram.pointCount, 10);
  assert.equal(decagram.innerRadius, 0.8);
  const components = families.flatMap((family) => family.children);
  assert.ok(components.some((component) => Object.hasOwn(component.variables, 'paddingLeft')));
  const second = await runOnce(ctx.figma);
  assert.equal(second.components, 0);
  assert.equal(second.skippedComponents, 9);
  assert.equal(ctx.variables.length, first.variablesCreated);
  assert.equal(page.children.filter((item) => item.type === 'COMPONENT_SET').length, 9);
});

test('Starter plan uses three single-mode theme palettes and reruns idempotently', async () => {
  const ctx = fakeFigma({ maxModes: 1 });
  const first = await runOnce(ctx.figma);
  assert.equal(first.components, 9);
  assert.equal(first.colorThemeStrategy, 'single-mode-collections');
  assert.equal(ctx.groups.length, 7);
  assert.equal(ctx.variables.length, 3 * 81 + 6 + 7 + 6 + 5);

  const collections = ['NEXA / Colors', 'NEXA / Colors / Light', 'NEXA / Colors / Protos Nexus'];
  const modes = ['Dark', 'Light', 'Protos Nexus'];
  for (const [index, collectionName] of collections.entries()) {
    const group = ctx.groups.find((entry) => entry.name === collectionName);
    assert.ok(group, collectionName);
    assert.deepEqual(group.modes.map((entry) => entry.name), [modes[index]]);
    const inGroup = ctx.variables.filter((entry) => entry.variableCollectionId === group.id);
    assert.equal(inGroup.length, 81);
    const example = inGroup.find((entry) => entry.name === 'actionPrimary');
    assert.ok(example);
    const colorValue = example.valuesByMode[group.modes[0].modeId];
    assert.equal(typeof colorValue.r, 'number');
    assert.equal(typeof colorValue.g, 'number');
    assert.equal(typeof colorValue.b, 'number');
    assert.equal(typeof colorValue.a, 'number');
  }

  const second = await runOnce(ctx.figma);
  assert.equal(second.components, 0);
  assert.equal(second.skippedComponents, 9);
  assert.equal(second.variablesCreated, 0);
  assert.equal(ctx.groups.length, 7);
  assert.equal(ctx.variables.length, first.variablesCreated);
  assert.equal(ctx.pages.find((page) => page.name === 'NEXA · Component Library')
    .children.filter((node) => node.type === 'COMPONENT_SET').length, 9);
});

test('full Starter page limit preserves existing work in an isolated section', async () => {
  const ctx = fakeFigma({ maxModes: 1, maxPages: 1 });
  const page = ctx.figma.createPage();
  page.name = 'NEXA — Existing Map';
  const existing = ctx.figma.createRectangle();
  existing.name = 'Existing content — do not modify';
  existing.x = 300; existing.y = 200;
  const originalRight = existing.x + existing.width;

  const first = await runOnce(ctx.figma);
  assert.equal(first.components, 9);
  assert.equal(ctx.pages.length, 1, 'Starter should not need an additional page');

  const section = page.children.find((entry) =>
    entry.type === 'SECTION' && entry.name === 'NEXA · Component Library');
  assert.ok(section);
  assert.ok(section.x > originalRight, 'fallback section should be placed beside existing content');
  assert.equal(section.children.filter((entry) => entry.type === 'COMPONENT_SET').length, 9);
  assert.equal(existing.parent, page);
  assert.equal(existing.name, 'Existing content — do not modify');
  const sectionId = section.id;

  const second = await runOnce(ctx.figma);
  assert.equal(second.components, 0);
  assert.equal(second.skippedComponents, 9);
  assert.equal(second.variablesCreated, 0);
  assert.equal(ctx.pages.length, 1);
  const matchingSections = page.children.filter((entry) =>
    entry.type === 'SECTION' && entry.name === 'NEXA · Component Library');
  assert.equal(matchingSections.length, 1);
  assert.equal(matchingSections[0].id, sectionId);
  assert.equal(section.children.filter((entry) => entry.type === 'COMPONENT_SET').length, 9);
});

test('Starter page fallback remains idempotent after switching current editor page', async () => {
  const ctx = fakeFigma({ maxModes: 1, maxPages: 2 });
  const home = ctx.figma.createPage();
  home.name = 'Home';
  const map = ctx.figma.createPage();
  map.name = 'Map';
  await ctx.figma.setCurrentPageAsync(map);

  const first = await runOnce(ctx.figma);
  assert.equal(first.components, 9);
  assert.equal(home.children.filter((node) => node.type === 'SECTION').length, 1);
  assert.equal(map.children.filter((node) => node.type === 'SECTION').length, 0);

  await ctx.figma.setCurrentPageAsync(map);
  const second = await runOnce(ctx.figma);
  assert.equal(second.components, 0);
  assert.equal(second.skippedComponents, 9);
  assert.equal(second.variablesCreated, 0);
  assert.equal(home.children.filter((node) => node.type === 'SECTION').length, 1);
  assert.equal(map.children.filter((node) => node.type === 'SECTION').length, 0);
});
