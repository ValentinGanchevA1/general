/**
 * Export the canonical React Native design tokens and compile the Figma library
 * plugin. No network calls, runtime eval, or hand-maintained duplicate palette.
 *
 * Usage: node tools/figma/nexa-library/build.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(here, '../../..');
const files = ['brand.ts', 'colors.ts', 'tokens.ts'].map(
  (file) => resolve(repo, 'apps/mobile/src/theme', file),
);
const declarations = new Map();

for (const path of files) {
  const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const node of ast.statements) {
    if (!ts.isVariableStatement(node)) continue;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        declarations.set(declaration.name.text, declaration.initializer);
      }
    }
  }
}

const cache = new Map();
const resolving = new Set();
function evaluate(node) {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) {
    return evaluate(node.expression);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -evaluate(node.operand);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(evaluate);
  if (ts.isPropertyAccessExpression(node)) {
    const parent = evaluate(node.expression);
    if (!Object.hasOwn(parent, node.name.text)) throw new Error('Missing token ' + node.name.text);
    return parent[node.name.text];
  }
  if (ts.isIdentifier(node)) {
    const name = node.text;
    if (cache.has(name)) return cache.get(name);
    if (!declarations.has(name) || resolving.has(name)) throw new Error('Unknown/cyclic constant: ' + name);
    resolving.add(name);
    const result = evaluate(declarations.get(name));
    resolving.delete(name);
    cache.set(name, result);
    return result;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const result = {};
    for (const entry of node.properties) {
      if (ts.isSpreadAssignment(entry)) {
        Object.assign(result, evaluate(entry.expression));
      } else if (ts.isPropertyAssignment(entry)) {
        const key = ts.isIdentifier(entry.name) || ts.isStringLiteral(entry.name)
          ? entry.name.text : null;
        if (!key) throw new Error('Unsupported computed token key');
        result[key] = evaluate(entry.initializer);
      } else if (ts.isShorthandPropertyAssignment(entry)) {
        result[entry.name.text] = evaluate(entry.name);
      } else {
        throw new Error('Unsupported token expression: ' + entry.kind);
      }
    }
    return result;
  }
  throw new Error('Unsupported token expression: ' + ts.SyntaxKind[node.kind]);
}

function get(name) {
  return evaluate(ts.factory.createIdentifier(name));
}

const colors = {
  Dark: get('darkColors'),
  Light: get('lightColors'),
  'Protos Nexus': get('protosNexusColors'),
};
const keys = Object.keys(colors.Dark);
for (const [mode, palette] of Object.entries(colors)) {
  if (JSON.stringify(Object.keys(palette)) !== JSON.stringify(keys)) {
    throw new Error('Color token mismatch for mode ' + mode);
  }
}
const payload = {
  source: 'apps/mobile/src/theme',
  colors,
  brand: get('nexaBrand'),
  spacing: get('spacing'),
  radius: get('radius'),
  fontSize: get('fontSize'),
  layout: get('layout'),
  // Exact buildTheme().shadow defaults plus the legacy FAB token.
  elevation: {
    Dark: { color: colors.Dark.shadowInk, opacity: 0.25, radius: 12, x: 0, y: 4, android: 6 },
    Light: { color: colors.Light.shadowInk, opacity: 0.08, radius: 12, x: 0, y: 4, android: 6 },
    'Protos Nexus': { color: colors['Protos Nexus'].shadowInk, opacity: 0.38, radius: 16, x: 0, y: 4, android: 8 },
    Fab: { color: colors.Dark.actionPrimary, opacity: 0.38, radius: 12, x: 0, y: 4, android: 8 },
  },
};
const source = readFileSync(resolve(here, 'plugin.template.js'), 'utf8');
const marker = '/*__NEXA_TOKEN_PAYLOAD__*/';
if (source.split(marker).length !== 2) throw new Error('Expected exactly one token payload marker');
const compiled = source.replace(marker, 'const NEXA_TOKENS = ' + JSON.stringify(payload) + ';');
const outputs = [
  [resolve(here, 'tokens.json'), JSON.stringify(payload, null, 2) + '\n'],
  [resolve(here, 'code.js'), compiled],
];
const check = process.argv.includes('--check');
let failed = false;
for (const [file, expected] of outputs) {
  if (check) {
    let actual = '';
    try { actual = readFileSync(file, 'utf8'); } catch { /* missing file */ }
    if (actual !== expected) { failed = true; console.error('Out of sync: ' + file); }
  } else {
    writeFileSync(file, expected);
    console.log('Generated ' + file);
  }
}
if (failed) process.exitCode = 1;
else if (check) console.log('Figma tokens and plugin bundle are in sync.');
