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
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'plugin.template.js'), 'utf8');
const bundle = readFileSync(join(here, 'code.js'), 'utf8');
const tokens = JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8'));
const marker = '/*__NEXA_TOKEN_PAYLOAD__*/';

function fakeFigma() {
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
      const page = node('PAGE');
      pages.push(page);
      currentPage ??= page;
      return page;
    },
    async setCurrentPageAsync(page) { currentPage = page; },
    async loadFontAsync() {},
    createComponent: () => node('COMPONENT'),
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
          addMode(newName) { const modeId = id(); this.modes.push({ modeId, name: newName }); return modeId; },
        };
        groups.push(collection);
        return collection;
      },
      createVariable(name, group, type) {
        const variable = {
          id: id(), name, variableCollectionId: group.id, resolvedType: type, valuesByMode: {}, scopes: [],
          setVariableCodeSyntax(platform, syntax) { this.codeSyntax ??= {}; this.codeSyntax[platform] = syntax; },
          setValueForMode(mode, value) { this.valuesByMode[mode] = value; },
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
  vm.runInNewContext(bundle, { figma, console }, { timeout: 5000, filename: 'nexa-figma-plugin.js' });
  const message = await Promise.race([
    finished,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Plugin did not finish')), 5000)),
  ]);
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
  assert.equal(ctx.effectStyles.length, 4);
  const page = ctx.pages.find((candidate) => candidate.name === 'NEXA · Component Library');
  const families = page.children.filter((candidate) => candidate.type === 'COMPONENT_SET');
  assert.equal(families.length, 9);
  const mapPins = families.find((entry) => entry.name === 'MapPin');
  assert.equal(mapPins.children.length, 9);
  assert.ok(mapPins.children.some((variant) => variant.name === 'Entity=Person, Density=Compact'));
  assert.ok(mapPins.children.some((variant) => variant.name === 'Entity=Event, Density=Selected'));
  const components = families.flatMap((family) => family.children);
  assert.ok(components.some((component) => Object.hasOwn(component.variables, 'paddingLeft')));
  const second = await runOnce(ctx.figma);
  assert.equal(second.components, 0);
  assert.equal(second.skippedComponents, 9);
  assert.equal(ctx.variables.length, first.variablesCreated);
  assert.equal(page.children.filter((item) => item.type === 'COMPONENT_SET').length, 9);
});
