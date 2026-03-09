// export.js – ZIP/mcaddon creation using JSZip

// Generate a 16x16 solid-color PNG blob via canvas
async function makeTexturePng(hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  // Base color
  ctx.fillStyle = hexColor || '#888888';
  ctx.fillRect(0, 0, 16, 16);

  // Simple shading to give a blocky look
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 0, 8, 8);
  ctx.fillRect(8, 8, 8, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(8, 0, 8, 8);
  ctx.fillRect(0, 8, 8, 8);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

// Generate a simple item icon (flat colored square with border)
async function makeItemTexturePng(hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = hexColor || '#a0a0a0';
  ctx.fillRect(1, 1, 14, 14);

  // Lighten top-left, darken bottom-right for depth
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(1, 1, 14, 2);
  ctx.fillRect(1, 1, 2, 14);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(1, 13, 14, 2);
  ctx.fillRect(13, 1, 2, 14);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

// Paint UV islands for a given body type onto a canvas context
function _paintUVIslands(ctx, base, bodyType) {
  const dark  = 'rgba(0,0,0,0.25)';
  const light = 'rgba(255,255,255,0.18)';
  ctx.fillStyle = base;

  if (bodyType === 'quadruped' || bodyType === 'bird') {
    // 64x32 layout: head, body, 4 legs
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = dark;
    ctx.fillRect(0, 16, 64, 16);
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, 64, 4);
  } else if (bodyType === 'slime') {
    // 64x32 cube layout
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = dark;
    ctx.fillRect(0, 16, 64, 16);
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, 64, 4);
  } else {
    // humanoid / undead / bat → 64x64 Steve UV layout
    ctx.fillRect(0,  0, 32, 16);  // head
    ctx.fillRect(16, 16, 24, 16); // body
    ctx.fillRect(40, 16, 16, 16); // right arm
    ctx.fillRect(0,  16, 16, 16); // right leg
    ctx.fillRect(32, 48, 16, 16); // left arm
    ctx.fillRect(16, 48, 16, 16); // left leg
    ctx.fillStyle = dark;
    ctx.fillRect(0, 8, 32, 8);
    ctx.fillRect(16, 24, 24, 8);
    ctx.fillRect(40, 24, 16, 8);
    ctx.fillRect(0,  24, 16, 8);
    ctx.fillRect(32, 56, 16, 8);
    ctx.fillRect(16, 56, 16, 8);
    ctx.fillStyle = light;
    ctx.fillRect(0,  0,  32, 2);
    ctx.fillRect(16, 16, 24, 2);
    ctx.fillRect(40, 16, 16, 2);
    ctx.fillRect(0,  16, 16, 2);
  }
}

async function makeEntityTexturePng(hexColor, bodyType) {
  const is32h = bodyType === 'quadruped' || bodyType === 'bird' || bodyType === 'slime';
  const canvas = document.createElement('canvas');
  canvas.width  = 64;
  canvas.height = is32h ? 32 : 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  _paintUVIslands(ctx, hexColor || '#888888', bodyType || 'humanoid');
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

// Convert a data URL to a Blob
async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function exportAddon(state) {
  const ns = (state.project.namespace || 'myaddon').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const name = (state.project.name || 'MyAddon').replace(/[^a-zA-Z0-9 _-]/g, '');

  showToast('Generating addon files…', 'info');

  const zip = new JSZip();
  const bp = zip.folder(`${name}_BP`);
  const rp = zip.folder(`${name}_RP`);

  // ── Behavior Pack ────────────────────────────────────────────────────────

  bp.file('manifest.json', JSON.stringify(generateManifestBP(state.project), null, 2));

  // Items
  if (state.items.length > 0) {
    const itemsDir = bp.folder('items');
    for (const item of state.items) {
      const shortId = item.identifier.includes(':')
        ? item.identifier.split(':')[1]
        : item.identifier;
      const json = generateItemBP(item, ns);
      if (json) itemsDir.file(`${shortId}.json`, JSON.stringify(json, null, 2));
    }
  }

  // Blocks
  if (state.blocks.length > 0) {
    const blocksDir = bp.folder('blocks');
    for (const block of state.blocks) {
      const shortId = block.identifier.includes(':')
        ? block.identifier.split(':')[1]
        : block.identifier;
      const json = generateBlockBP(block, ns);
      if (json) blocksDir.file(`${shortId}.json`, JSON.stringify(json, null, 2));
    }
  }

  // Entities
  if (state.entities.length > 0) {
    const entDir = bp.folder('entities');
    for (const entity of state.entities) {
      const shortId = entity.identifier.includes(':')
        ? entity.identifier.split(':')[1]
        : entity.identifier;
      const json = generateEntityBP(entity, ns);
      if (json) entDir.file(`${shortId}.json`, JSON.stringify(json, null, 2));
    }
  }

  // Recipes
  if (state.recipes.length > 0) {
    const recDir = bp.folder('recipes');
    for (const recipe of state.recipes) {
      const shortId = recipe.identifier.includes(':')
        ? recipe.identifier.split(':')[1]
        : recipe.identifier;
      const json = generateRecipeBP(recipe, ns);
      if (json) recDir.file(`${shortId}.json`, JSON.stringify(json, null, 2));
    }
  }

  // ── Resource Pack ─────────────────────────────────────────────────────────

  rp.file('manifest.json', JSON.stringify(generateManifestRP(state.project), null, 2));

  // Entity RP definitions (client entity JSON + textures)
  if (state.entities.length > 0) {
    const rpEntDir = rp.folder('entity');
    const entTexDir = rp.folder('textures').folder('entity');
    for (const entity of state.entities) {
      const id = entity.identifier.includes(':') ? entity.identifier : `${ns}:${entity.identifier}`;
      const texName = id.replace(':', '_');
      const shortId = id.includes(':') ? id.split(':')[1] : id;

      const clientJson = generateEntityClientEntity(entity, ns);
      rpEntDir.file(`${shortId}.json`, JSON.stringify(clientJson, null, 2));

      let blob;
      if (entity.textureDataUrl) {
        // Upscale the 16×16 painted texture to the correct entity skin resolution
        const is32h = entity.bodyType === 'quadruped' || entity.bodyType === 'bird' || entity.bodyType === 'slime';
        const tw = 64, th = is32h ? 32 : 64;
        blob = await new Promise(resolve => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = tw; c.height = th;
            const ctx = c.getContext('2d');
            ctx.imageSmoothingEnabled = false; // pixelated upscale
            ctx.drawImage(img, 0, 0, tw, th);
            c.toBlob(resolve, 'image/png');
          };
          img.src = entity.textureDataUrl;
        });
      } else {
        blob = await makeEntityTexturePng(entity.color || '#888888', entity.bodyType || 'humanoid');
      }
      entTexDir.file(`${texName}.png`, blob);
    }
  }

  // Item RP definitions (required for items to register in 1.20+)
  if (state.items.length > 0) {
    const rpItemsDir = rp.folder('items');
    for (const item of state.items) {
      const shortId = item.identifier.includes(':')
        ? item.identifier.split(':')[1]
        : item.identifier;
      const json = generateItemRP(item, ns);
      if (json) rpItemsDir.file(`${shortId}.json`, JSON.stringify(json, null, 2));
    }
  }

  const texDir = rp.folder('textures');
  const itemTexDir = texDir.folder('items');
  const blockTexDir = texDir.folder('blocks');

  // Item textures – use painted texture if available, else generate placeholder
  for (const item of state.items) {
    const id = item.identifier.includes(':') ? item.identifier : `${ns}:${item.identifier}`;
    const texName = id.replace(':', '_');
    const blob = item.textureDataUrl
      ? await dataUrlToBlob(item.textureDataUrl)
      : await makeItemTexturePng(item.color || '#a0a0a0');
    itemTexDir.file(`${texName}.png`, blob);
  }

  // Block textures – use painted texture if available, else generate placeholder
  for (const block of state.blocks) {
    const id = block.identifier.includes(':') ? block.identifier : `${ns}:${block.identifier}`;
    const texName = id.replace(':', '_');
    const blob = block.textureDataUrl
      ? await dataUrlToBlob(block.textureDataUrl)
      : await makeTexturePng(block.color || '#888888');
    blockTexDir.file(`${texName}.png`, blob);
  }

  // Atlas descriptors
  if (state.blocks.length > 0) {
    texDir.file('terrain_texture.json',
      JSON.stringify(generateTerrainTexture(state.blocks, ns), null, 2));
  }
  if (state.items.length > 0) {
    texDir.file('item_texture.json',
      JSON.stringify(generateItemTexture(state.items, ns), null, 2));
  }

  // Language file
  const lang = generateLangFile(state.items, state.blocks, state.entities, ns);
  if (lang) {
    const textsDir = rp.folder('texts');
    textsDir.file('en_US.lang', lang);
    textsDir.file('languages.json', JSON.stringify(['en_US'], null, 2));
  }

  // pack_icon.png (simple green square placeholder)
  const iconCanvas = document.createElement('canvas');
  iconCanvas.width = 128; iconCanvas.height = 128;
  const iconCtx = iconCanvas.getContext('2d');
  iconCtx.fillStyle = '#1a1a1a';
  iconCtx.fillRect(0, 0, 128, 128);
  iconCtx.fillStyle = '#4caf50';
  iconCtx.font = 'bold 72px serif';
  iconCtx.textAlign = 'center';
  iconCtx.textBaseline = 'middle';
  iconCtx.fillText('⛏', 64, 64);
  const iconBlob = await new Promise(r => iconCanvas.toBlob(r, 'image/png'));
  bp.file('pack_icon.png', iconBlob);
  rp.file('pack_icon.png', iconBlob);

  // ── Download ─────────────────────────────────────────────────────────────

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.mcaddon`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  showToast(`✓ Downloaded ${name}.mcaddon`, 'success');
}

function doExport() {
  const total = state.items.length + state.blocks.length +
                state.entities.length + state.recipes.length;
  if (total === 0) {
    showToast('Add at least one item, block, entity, or recipe first!', 'error');
    return;
  }
  exportAddon(state).catch(err => {
    console.error(err);
    showToast('Export failed: ' + err.message, 'error');
  });
}
