/* NEXA Figma development plugin. Generated code.js embeds live mobile tokens. */
/*__NEXA_TOKEN_PAYLOAD__*/

async function main() {
  const pages = figma.root.children;
  let page = pages.find((candidate) => candidate.name === 'NEXA · Component Library');
  if (!page) {
    page = figma.createPage();
    page.name = 'NEXA · Component Library';
  }
  await figma.setCurrentPageAsync(page);
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
  ]);

  function rgb(input) {
    if (input.startsWith('#')) {
      const raw = input.slice(1);
      if (!/^[0-9a-fA-F]{6}$/.test(raw)) throw new Error('Invalid hex: ' + input);
      return { r: parseInt(raw.slice(0, 2), 16) / 255, g: parseInt(raw.slice(2, 4), 16) / 255, b: parseInt(raw.slice(4, 6), 16) / 255 };
    }
    const parsed = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/.exec(input);
    if (!parsed) throw new Error('Unsupported color value: ' + input);
    const result = { r: Number(parsed[1]) / 255, g: Number(parsed[2]) / 255, b: Number(parsed[3]) / 255 };
    if (parsed[4] !== undefined) result.a = Number(parsed[4]);
    return result;
  }

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const existing = await figma.variables.getLocalVariablesAsync();
  const variableByKey = new Map();
  const counts = { variablesCreated: 0, variablesUpdated: 0, textStyles: 0, effects: 0, components: 0, skippedComponents: 0 };

  function collection(name, modes) {
    let found = collections.find((entry) => entry.name === name);
    if (!found) {
      found = figma.variables.createVariableCollection(name);
      collections.push(found);
    }
    for (const [index, mode] of modes.entries()) {
      if (index === 0 && found.modes.length === 1 && found.modes[0].name === 'Mode 1') {
        found.renameMode(found.modes[0].modeId, mode);
      } else if (!found.modes.some((item) => item.name === mode)) {
        found.addMode(mode);
      }
    }
    return found;
  }

  function upsert(name, group, type, values, scopes, cssName) {
    let variable = existing.find((item) => item.variableCollectionId === group.id && item.name === name);
    if (!variable) {
      variable = figma.variables.createVariable(name, group, type);
      existing.push(variable);
      counts.variablesCreated += 1;
    } else {
      if (variable.resolvedType !== type) throw new Error('Token type drift: ' + name);
      counts.variablesUpdated += 1;
    }
    variable.scopes = scopes;
    if (cssName) variable.setVariableCodeSyntax('WEB', 'var(--nexa-' + cssName + ')');
    for (const [mode, value] of Object.entries(values)) {
      const match = group.modes.find((candidate) => candidate.name === mode);
      if (!match) throw new Error('Missing variable mode: ' + mode);
      variable.setValueForMode(match.modeId, type === 'COLOR' ? rgb(value) : value);
    }
    variableByKey.set(group.name + '/' + name, variable);
    return variable;
  }

  const colorModes = Object.keys(NEXA_TOKENS.colors);
  const colorCollection = collection('NEXA / Colors', colorModes);
  const colors = Object.keys(NEXA_TOKENS.colors.Dark);
  for (const name of colors) {
    const modeValues = {};
    for (const mode of colorModes) modeValues[mode] = NEXA_TOKENS.colors[mode][name];
    upsert(name, colorCollection, 'COLOR', modeValues,
      ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR'], 'color-' + name.replace(/[A-Z]/g, (char) => '-' + char.toLowerCase()));
  }

  const numericSpecs = [
    ['NEXA / Spacing', NEXA_TOKENS.spacing, ['GAP']],
    ['NEXA / Radius', NEXA_TOKENS.radius, ['CORNER_RADIUS']],
    ['NEXA / Typography', NEXA_TOKENS.fontSize, ['FONT_SIZE']],
    ['NEXA / Layout', NEXA_TOKENS.layout, ['WIDTH_HEIGHT']],
  ];
  for (const [collectionName, entries, scopes] of numericSpecs) {
    const group = collection(collectionName, ['Base']);
    const prefix = collectionName.split('/')[1].trim().toLowerCase();
    for (const [key, value] of Object.entries(entries)) {
      upsert(key, group, 'FLOAT', { Base: value }, scopes, prefix + '-' + key.replace(/[A-Z]/g, (char) => '-' + char.toLowerCase()));
    }
  }

  const textStyles = await figma.getLocalTextStylesAsync();
  for (const [key, size] of Object.entries(NEXA_TOKENS.fontSize)) {
    const name = 'NEXA / Text / ' + key;
    let style = textStyles.find((candidate) => candidate.name === name);
    if (!style) { style = figma.createTextStyle(); style.name = name; textStyles.push(style); }
    style.fontName = { family: 'Inter', style: key === 'xxl' || key === 'xl' ? 'Semi Bold' : 'Regular' };
    style.fontSize = size;
    style.lineHeight = { unit: 'PIXELS', value: Math.round(size * 1.35) };
    counts.textStyles += 1;
  }

  const effectStyles = await figma.getLocalEffectStylesAsync();
  for (const [mode, effect] of Object.entries(NEXA_TOKENS.elevation)) {
    const name = 'NEXA / Elevation / ' + mode;
    let style = effectStyles.find((candidate) => candidate.name === name);
    if (!style) { style = figma.createEffectStyle(); style.name = name; effectStyles.push(style); }
    style.effects = [{
      type: 'DROP_SHADOW',
      color: Object.assign(rgb(effect.color), { a: effect.opacity }),
      offset: { x: effect.x, y: effect.y }, radius: effect.radius, visible: true, blendMode: 'NORMAL',
    }];
    counts.effects += 1;
  }

  function pigment(name) {
    const color = rgb(NEXA_TOKENS.colors.Dark[name]);
    // Bound COLOR variables can contain alpha; the paint itself must contain RGB only.
    return { type: 'SOLID', color: { r: color.r, g: color.g, b: color.b } };
  }
  function fill(node, name) {
    const variable = variableByKey.get('NEXA / Colors/' + name);
    if (!variable) throw new Error('Unknown color: ' + name);
    node.fills = [figma.variables.setBoundVariableForPaint(
      pigment(name), 'color', variable,
    )];
  }
  function stroke(node, name, width) {
    const variable = variableByKey.get('NEXA / Colors/' + name);
    node.strokes = [figma.variables.setBoundVariableForPaint(
      pigment(name), 'color', variable,
    )];
    node.strokeWeight = width;
  }
  function space(node, field, key) {
    const variable = variableByKey.get('NEXA / Spacing/' + key);
    if (!variable) throw new Error('Missing spacing token: ' + key);
    node[field] = NEXA_TOKENS.spacing[key];
    node.setBoundVariable(field, variable);
  }
  function bindRadius(node, name) {
    const variable = variableByKey.get('NEXA / Radius/' + name);
    if (variable) node.setBoundVariable('cornerRadius', variable);
  }
  function label(parent, value, fontSize, colorName, bold, x, y) {
    const item = figma.createText();
    parent.appendChild(item);
    item.fontName = { family: 'Inter', style: bold ? 'Semi Bold' : 'Regular' };
    item.fontSize = fontSize;
    const sizeToken = Object.entries(NEXA_TOKENS.fontSize).find((entry) => entry[1] === fontSize);
    if (sizeToken) {
      const variable = variableByKey.get('NEXA / Typography/' + sizeToken[0]);
      if (variable) item.setBoundVariable('fontSize', variable);
    }
    item.characters = value;
    item.textAutoResize = 'WIDTH_AND_HEIGHT';
    fill(item, colorName || 'textPrimary');
    if (x !== undefined) item.x = x;
    if (y !== undefined) item.y = y;
    return item;
  }
  function rect(parent, width, height, colorName, radiusName, x, y) {
    const item = figma.createRectangle();
    parent.appendChild(item);
    item.resize(width, height);
    fill(item, colorName);
    if (radiusName) bindRadius(item, radiusName);
    if (x !== undefined) item.x = x;
    if (y !== undefined) item.y = y;
    return item;
  }
  function circle(parent, size, colorName, x, y) {
    const item = figma.createEllipse();
    parent.appendChild(item);
    item.resize(size, size);
    fill(item, colorName);
    item.x = x; item.y = y;
    return item;
  }
  function base(width, height, name, autoLayout) {
    const component = figma.createComponent();
    component.name = name;
    component.resize(width, height);
    component.layoutMode = autoLayout || 'NONE';
    component.clipsContent = false;
    if (autoLayout && autoLayout !== 'NONE') {
      component.primaryAxisAlignItems = 'CENTER';
      component.counterAxisAlignItems = 'CENTER';
      space(component, 'itemSpacing', 'sm');
    }
    component.fills = [];
    return component;
  }
  function textProp(component, text, defaultValue, name) {
    const key = component.addComponentProperty(name || 'Label', 'TEXT', defaultValue);
    text.componentPropertyReferences = { characters: key };
  }
  function setFamily(name, variants, description) {
    const found = page.children.find((node) => node.type === 'COMPONENT_SET' && node.name === name);
    if (found) { counts.skippedComponents += 1; return found; }
    const components = variants.map((variant) => variant.make(variant.name));
    const set = figma.combineAsVariants(components, page);
    set.name = name;
    set.description = description;
    let right = 0; let bottom = 0;
    for (let index = 0; index < set.children.length; index += 1) {
      const child = set.children[index];
      const column = index % 3;
      const row = Math.floor(index / 3);
      child.x = 24 + column * 370;
      child.y = 24 + row * (Math.max(110, child.height) + 45);
      right = Math.max(right, child.x + child.width);
      bottom = Math.max(bottom, child.y + child.height);
    }
    set.resizeWithoutConstraints(right + 24, bottom + 24);
    const number = counts.components;
    set.x = 200 + (number % 2) * 1260;
    set.y = 160 + Math.floor(number / 2) * 820;
    counts.components += 1;
    return set;
  }

  setFamily('Button', ['Primary', 'Secondary', 'Ghost'].flatMap((style) =>
    ['Default', 'Pressed', 'Disabled'].map((state) => ({
      name: 'Style=' + style + ', State=' + state,
      make(name) {
        const c = base(230, 50, name, 'HORIZONTAL');
        bindRadius(c, 'md');
        space(c, 'paddingLeft', 'lg'); space(c, 'paddingRight', 'lg');
        fill(c, state === 'Disabled' ? 'surfaceTertiary' : style === 'Primary' ? 'actionPrimary' : style === 'Secondary' ? 'surfaceSecondary' : 'surfacePrimary');
        if (state === 'Pressed') c.opacity = 0.75;
        if (style !== 'Primary') stroke(c, 'borderDefault', 1);
        const t = label(c, 'Continue', 15, state === 'Disabled' ? 'textDisabled' : style === 'Primary' ? 'onPrimary' : 'textPrimary', true);
        textProp(c, t, 'Continue');
        return c;
      },
    }))), 'Action button · style (Primary / Secondary / Ghost) × state (Default / Pressed / Disabled). Height 50px.');

  setFamily('Input', ['Default', 'Focused', 'Error', 'Disabled'].map((state) => ({
    name: 'State=' + state,
    make(name) {
      const c = base(316, 52, name, 'HORIZONTAL');
      bindRadius(c, 'md');
      space(c, 'paddingLeft', 'lg'); space(c, 'paddingRight', 'lg');
      fill(c, state === 'Disabled' ? 'surfaceTertiary' : 'surfaceSecondary');
      stroke(c, state === 'Error' ? 'danger' : state === 'Focused' ? 'actionPrimary' : 'borderDefault', state === 'Focused' ? 2 : 1);
      const t = label(c, 'Email or phone', 15, 'textTertiary');
      textProp(c, t, 'Email or phone', 'Placeholder');
      return c;
    },
  })), 'Single-line field · Default, Focused, Error, Disabled. Error is a local visual state; validation remains in the app.');

  setFamily('Avatar', ['None', 'Brand', 'Friend', 'Verified'].map((ring) => ({
    name: 'Ring=' + ring,
    make(name) {
      const c = base(72, 72, name, 'NONE');
      if (ring !== 'None') circle(c, 72, ring === 'Friend' ? 'entityFriend' : ring === 'Verified' ? 'verified' : 'primary', 0, 0);
      circle(c, ring === 'None' ? 72 : 64, 'surfaceTertiary', ring === 'None' ? 0 : 4, ring === 'None' ? 0 : 4);
      const t = label(c, 'MA', 22, 'textPrimary', true, 17, 22);
      textProp(c, t, 'MA', 'Initials');
      return c;
    },
  })), 'Avatar ring variants match apps/mobile/src/components/Avatar.tsx. Initials-only specimen; runtime avatar URI remains private.');

  setFamily('VerificationBadge', ['Partial', 'ID'].map((level) => ({
    name: 'Level=' + level,
    make(name) {
      const c = base(32, 32, name, 'NONE');
      circle(c, 27, 'primary', 2, 2);
      label(c, '✓', 18, 'onPrimary', true, 7, 3);
      return c;
    },
  })), 'Verification level: Partial / ID verified. None is intentionally rendered as no badge. ID glyph is schematic; mobile uses check-decagram.');

  // Mirror native NexaEntityMarker: 48dp hit zone and 18/24/34dp visual sizes.
  // No decorative teardrop: users are avatar circles, events four-point stars,
  // listings are square. The map layer owns position and tap behavior.
  setFamily('MapPin', ['Person', 'Event', 'Listing'].flatMap((entity) =>
    ['Compact', 'Standard', 'Selected'].map((density) => ({
      name: 'Entity=' + entity + ', Density=' + density,
      make(name) {
        const c = base(88, 62, name, 'NONE');
        const color = entity === 'Person' ? 'entityPerson' : entity === 'Event' ? 'entityEvent' : 'entityListing';
        const size = density === 'Compact' ? 18 : density === 'Selected' ? 34 : 24;
        const cx = 44;
        const cy = 24;
        if (density === 'Selected') {
          const ring = figma.createEllipse();
          c.appendChild(ring);
          ring.resize(42, 42);
          ring.x = cx - 21;
          ring.y = cy - 21;
          ring.fills = [];
          stroke(ring, 'actionPrimary', 1.5);
        }
        if (entity === 'Person') {
          const avatar = circle(c, size, 'actionSoft', cx - size / 2, cy - size / 2);
          stroke(avatar, color, 2);
          const textSize = Math.max(9, Math.round(size * 0.38));
          const initials = label(c, 'MA', textSize, color, true);
          initials.x = cx - initials.width / 2;
          initials.y = cy - initials.height / 2;
          textProp(c, initials, 'MA', 'Initials');
        } else if (entity === 'Event') {
          const star = figma.createStar();
          c.appendChild(star);
          star.pointCount = 4;
          star.innerRadius = 0.38;
          star.resize(size, size);
          star.x = cx - size / 2;
          star.y = cy - size / 2;
          fill(star, color);
        } else {
          const side = Math.round(size * 0.82);
          const square = rect(c, side, side, 'surfacePrimary', null, cx - side / 2, cy - side / 2);
          square.cornerRadius = Math.max(3, Math.round(size * 0.16));
          stroke(square, color, 2);
          circle(c, 3, color, cx + side / 4 - 1.5, cy - side / 4 - 1.5);
        }
        return c;
      },
    }))), 'Matches native map marker: compact 18dp, standard 24dp, selected 34dp, 48dp hit target. Avatar-first people pins; no private precise location.');

  setFamily('BottomSheet', ['Peek', 'Expanded'].map((state) => ({
    name: 'State=' + state,
    make(name) {
      const c = base(330, state === 'Peek' ? 146 : 270, name, 'VERTICAL');
      fill(c, 'surfacePrimary'); stroke(c, 'borderSubtle', 1);
      bindRadius(c, 'xl');
      space(c, 'paddingTop', 'sm'); space(c, 'paddingLeft', 'xl'); space(c, 'paddingRight', 'xl');
      space(c, 'itemSpacing', 'md'); c.primaryAxisAlignItems = 'MIN';
      rect(c, 46, 5, 'borderStrong', 'pill');
      label(c, 'Nearby activity', 18, 'textPrimary', true);
      label(c, state === 'Peek' ? 'Explore what is happening around you.' : 'People, events and listings in your current map viewport.', 13, 'textSecondary');
      if (state === 'Expanded') {
        rect(c, 286, 64, 'surfaceSecondary', 'card');
        label(c, 'Tap a person, event or listing', 13, 'textPrimary');
      }
      return c;
    },
  })), 'Bottom sheet specimen · Peek / Expanded. Production gesture, safe-area and keyboard interactions belong to @gorhom/bottom-sheet.');

  setFamily('Card', ['Person', 'Event', 'Listing'].map((kind) => ({
    name: 'Kind=' + kind,
    make(name) {
      const c = base(318, 138, name, 'VERTICAL');
      fill(c, 'surfacePrimary'); stroke(c, 'borderDefault', 1);
      bindRadius(c, 'card');
      space(c, 'paddingLeft', 'lg'); space(c, 'paddingRight', 'lg'); space(c, 'paddingTop', 'lg');
      space(c, 'itemSpacing', 'md'); c.primaryAxisAlignItems = 'MIN';
      const t = label(c, kind === 'Person' ? 'Someone nearby' : kind === 'Event' ? 'Coffee meetup' : 'Local listing', 18, 'textPrimary', true);
      textProp(c, t, t.characters, 'Title');
      label(c, kind === 'Person' ? 'Shared interests · Wave' : kind === 'Event' ? 'Today · View details' : 'Offer · Message seller', 13, 'textSecondary');
      return c;
    },
  })), 'Generic content card for nearby people, events and marketplace listings.');

  setFamily('Tabs', ['Active', 'Inactive'].map((state) => ({
    name: 'State=' + state,
    make(name) {
      const c = base(152, 46, name, 'HORIZONTAL');
      fill(c, state === 'Active' ? 'actionMutedBg' : 'surfaceSecondary');
      bindRadius(c, 'pill');
      if (state === 'Active') stroke(c, 'actionBorderSoft', 1);
      const t = label(c, 'Discover', 15, state === 'Active' ? 'actionPrimary' : 'textSecondary', state === 'Active');
      textProp(c, t, 'Discover');
      return c;
    },
  })), 'Single tab primitive · Active / Inactive. Assemble tabs with navigation and screen-reader semantics in React Native.');

  setFamily('SearchBar', ['Default', 'Focused', 'Filled'].map((state) => ({
    name: 'State=' + state,
    make(name) {
      const c = base(320, 52, name, 'HORIZONTAL');
      space(c, 'paddingLeft', 'md'); space(c, 'paddingRight', 'md');
      bindRadius(c, 'pill');
      fill(c, 'surfaceSecondary');
      stroke(c, state === 'Focused' ? 'actionPrimary' : 'borderDefault', state === 'Focused' ? 2 : 1);
      label(c, '⌕', 24, 'textSecondary');
      const t = label(c, state === 'Filled' ? 'Coffee nearby' : 'Search people, events, places', 13, state === 'Filled' ? 'textPrimary' : 'textTertiary');
      textProp(c, t, t.characters, 'Query');
      return c;
    },
  })), 'Viewport-aware discovery search visual. Debounced querying and filter policies belong to application code.');

  figma.viewport.scrollAndZoomIntoView(page.children.filter((node) => node.type === 'COMPONENT_SET'));
  return counts;
}

main().then((summary) => {
  figma.closePlugin('NEXA design library synced: ' + JSON.stringify(summary));
}).catch((error) => {
  console.error(error);
  figma.closePlugin('NEXA library failed: ' + String(error));
});
