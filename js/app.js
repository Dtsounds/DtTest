// app.js – Main application state and UI rendering

// ── STATE ──────────────────────────────────────────────────────────────────

const state = {
  project: {
    name: 'My Addon',
    description: 'A custom Minecraft Bedrock addon',
    author: '',
    namespace: 'myaddon',
    version: [1, 0, 0]
  },
  items: [],
  blocks: [],
  entities: [],
  recipes: [],
  ui: {
    activeTab: 'project',
    editingItem: null,
    editingBlock: null,
    editingEntity: null,
    editingRecipe: null,
    jsonTab: 'bp',
    showJson: true,
    activeCellRow: -1,
    activeCellCol: -1
  }
};

// ── UTILITIES ──────────────────────────────────────────────────────────────

function genId() {
  return 'id_' + Math.random().toString(36).slice(2, 11);
}

function slugify(str) {
  return (str || '').toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';
}

function showToast(msg, type = 'info') {
  const tc = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 2800);
  setTimeout(() => t.remove(), 3100);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── JSON PANEL ─────────────────────────────────────────────────────────────

function toggleJsonPanel() {
  state.ui.showJson = !state.ui.showJson;
  const panel = document.getElementById('json-panel');
  panel.classList.toggle('hidden', !state.ui.showJson);
}

function updateJsonPreview() {
  if (!state.ui.showJson) return;
  const ns = state.project.namespace || 'myaddon';
  const tab = state.ui.activeTab;
  const tabsEl = document.getElementById('json-tabs');
  const outputEl = document.getElementById('json-output');

  let tabs = [];
  let content = '';

  const editingItem = state.items.find(i => i.id === state.ui.editingItem);
  const editingBlock = state.blocks.find(b => b.id === state.ui.editingBlock);
  const editingEntity = state.entities.find(e => e.id === state.ui.editingEntity);
  const editingRecipe = state.recipes.find(r => r.id === state.ui.editingRecipe);

  if (tab === 'project') {
    tabs = ['BP Manifest', 'RP Manifest'];
    const sel = state.ui.jsonTab || 'BP Manifest';
    if (sel === 'RP Manifest') {
      content = JSON.stringify(generateManifestRP(state.project), null, 2);
    } else {
      content = JSON.stringify(generateManifestBP(state.project), null, 2);
    }
  } else if (tab === 'items' && editingItem) {
    tabs = ['Item BP'];
    content = JSON.stringify(generateItemBP(editingItem, ns), null, 2);
  } else if (tab === 'blocks' && editingBlock) {
    tabs = ['Block BP', 'Terrain Texture'];
    const sel = state.ui.jsonTab || 'Block BP';
    if (sel === 'Terrain Texture') {
      content = JSON.stringify(generateTerrainTexture([editingBlock], ns), null, 2);
    } else {
      content = JSON.stringify(generateBlockBP(editingBlock, ns), null, 2);
    }
  } else if (tab === 'entities' && editingEntity) {
    tabs = ['Entity BP'];
    content = JSON.stringify(generateEntityBP(editingEntity, ns), null, 2);
  } else if (tab === 'recipes' && editingRecipe) {
    tabs = ['Recipe BP'];
    const json = generateRecipeBP(editingRecipe, ns);
    content = json ? JSON.stringify(json, null, 2) : '// Fill in recipe details above';
  } else {
    tabsEl.innerHTML = '';
    outputEl.innerHTML = '<span style="color:var(--text-dim)">// Select an element to see its JSON output</span>';
    return;
  }

  // Render tabs
  tabsEl.innerHTML = tabs.map(t =>
    `<div class="json-tab ${(state.ui.jsonTab || tabs[0]) === t ? 'active' : ''}"
          onclick="setJsonTab('${escapeHtml(t)}')">${escapeHtml(t)}</div>`
  ).join('');

  if (!state.ui.jsonTab || !tabs.includes(state.ui.jsonTab)) {
    state.ui.jsonTab = tabs[0];
  }

  outputEl.innerHTML = syntaxHighlight(content);
}

function setJsonTab(tab) {
  state.ui.jsonTab = tab;
  updateJsonPreview();
}

function copyJson() {
  const text = document.getElementById('json-output').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('JSON copied!', 'success'));
}

// ── TAB NAVIGATION ─────────────────────────────────────────────────────────

function switchTab(tab) {
  state.ui.activeTab = tab;
  state.ui.jsonTab = null;

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const active = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (active) active.classList.add('active');

  const main = document.getElementById('main-content');
  switch (tab) {
    case 'project':  renderProject(main); break;
    case 'items':    renderItems(main); break;
    case 'blocks':   renderBlocks(main); break;
    case 'entities': renderEntities(main); break;
    case 'recipes':  renderRecipes(main); break;
    case 'export':   renderExport(main); break;
  }
  updateJsonPreview();
}

function updateBadges() {
  document.getElementById('badge-items').textContent    = state.items.length;
  document.getElementById('badge-blocks').textContent   = state.blocks.length;
  document.getElementById('badge-entities').textContent = state.entities.length;
  document.getElementById('badge-recipes').textContent  = state.recipes.length;
}

// ── PROJECT SETTINGS ───────────────────────────────────────────────────────

function renderProject(container) {
  container.innerHTML = `
<div class="content-area">
  <div class="section-header">
    <span class="section-icon">🗂</span>
    <div>
      <div class="section-title">Project Settings</div>
      <div class="section-subtitle">Configure your addon's global properties</div>
    </div>
  </div>

  <div class="card">
    <div class="form-section">
      <div class="form-section-title">Identity</div>
      <div class="form-grid">
        <div class="form-group">
          <label>Addon Name</label>
          <input type="text" value="${escapeHtml(state.project.name)}"
            oninput="state.project.name=this.value;updateJsonPreview()">
        </div>
        <div class="form-group">
          <label>Namespace <span style="color:var(--text-dim);font-weight:400">(lowercase, no spaces)</span></label>
          <input type="text" value="${escapeHtml(state.project.namespace)}"
            oninput="state.project.namespace=this.value.toLowerCase().replace(/[^a-z0-9_]/g,'');this.value=state.project.namespace;updateJsonPreview()">
          <div class="hint">Used as prefix for all identifiers, e.g. <code>${escapeHtml(state.project.namespace)}:my_item</code></div>
        </div>
        <div class="form-group full">
          <label>Description</label>
          <textarea oninput="state.project.description=this.value;updateJsonPreview()"
            rows="2">${escapeHtml(state.project.description)}</textarea>
        </div>
        <div class="form-group">
          <label>Author</label>
          <input type="text" value="${escapeHtml(state.project.author)}"
            oninput="state.project.author=this.value">
        </div>
        <div class="form-group">
          <label>Version</label>
          <div style="display:flex;gap:8px">
            ${[0,1,2].map(i => `<input type="number" min="0" max="999" value="${state.project.version[i] || 0}"
              oninput="state.project.version[${i}]=parseInt(this.value)||0;updateJsonPreview()"
              style="text-align:center">`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>

  <div style="margin-top:24px">
    <div class="section-title" style="font-size:16px;margin-bottom:14px">Addon Summary</div>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-num">${state.items.length}</div>
        <div class="summary-label">Items</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">${state.blocks.length}</div>
        <div class="summary-label">Blocks</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">${state.entities.length}</div>
        <div class="summary-label">Entities</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">${state.recipes.length}</div>
        <div class="summary-label">Recipes</div>
      </div>
    </div>
  </div>

  <div class="info-box" style="margin-top:8px">
    💡 Start by configuring your namespace above, then use the sidebar to create items, blocks, entities, and recipes.
    When ready, click <strong>Export .mcaddon</strong> in the top-right.
  </div>
</div>`;
}

// ── ITEMS ──────────────────────────────────────────────────────────────────

function newItem() {
  const ns = state.project.namespace || 'myaddon';
  const item = {
    id: genId(),
    identifier: `${ns}:new_item`,
    displayName: 'New Item',
    category: 'Items',
    maxStackSize: 64,
    isWeapon: false,
    damage: 5,
    durability: 250,
    isFood: false,
    nutrition: 4,
    saturationModifier: 'normal',
    canAlwaysEat: false,
    isFoil: false,
    isGlint: false,
    isThrowable: false,
    handEquipped: false,
    color: '#a07850',
    itemShape: 'flat'
  };
  state.items.push(item);
  state.ui.editingItem = item.id;
  updateBadges();
  renderItems(document.getElementById('main-content'));
}

function deleteItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  if (state.ui.editingItem === id) state.ui.editingItem = null;
  updateBadges();
  renderItems(document.getElementById('main-content'));
}

function renderItems(container) {
  const editing = state.items.find(i => i.id === state.ui.editingItem);

  container.innerHTML = `
<div class="content-area">
  <div class="section-header">
    <span class="section-icon">🗡</span>
    <div>
      <div class="section-title">Items</div>
      <div class="section-subtitle">Create custom items — tools, food, weapons, and more</div>
    </div>
    <button class="btn btn-primary" style="margin-left:auto" onclick="newItem()">+ Add Item</button>
  </div>

  ${state.items.length === 0 ? `
    <div class="empty-state">
      <div class="empty-state-icon">🗡</div>
      <div class="empty-state-title">No items yet</div>
      <div class="empty-state-desc">Create custom swords, food, potions, and more.</div>
      <button class="btn btn-primary" onclick="newItem()">+ Create First Item</button>
    </div>` : `
  <div class="element-list">
    ${state.items.map(item => `
    <div class="element-card ${state.ui.editingItem === item.id ? 'active' : ''}"
         onclick="state.ui.editingItem='${item.id}';renderItems(document.getElementById('main-content'));updateJsonPreview()">
      <div class="element-icon" style="background:${escapeHtml(item.color || '#a0a0a0')}20;border-color:${escapeHtml(item.color || '#a0a0a0')}60;overflow:hidden;padding:0">
        ${item.textureDataUrl
          ? `<img src="${item.textureDataUrl}" width="100%" height="100%" style="image-rendering:pixelated;display:block">`
          : (item.isFood ? '🍖' : item.isWeapon ? '⚔' : item.isThrowable ? '🪃' : '📦')}
      </div>
      <div class="element-info">
        <div class="element-name">${escapeHtml(item.displayName)}</div>
        <div class="element-id">${escapeHtml(item.identifier)}</div>
      </div>
      <div class="element-actions">
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteItem('${item.id}')">✕</button>
      </div>
    </div>`).join('')}
  </div>`}

  ${editing ? renderItemEditor(editing) : ''}
</div>`;

  updateJsonPreview();
}

function renderItemEditor(item) {
  return `
<div class="editor-panel">
  <div class="editor-panel-header">
    <span class="editor-panel-title">✏ Editing: ${escapeHtml(item.displayName)}</span>
    <div style="display:flex;gap:8px">
      <button class="btn btn-secondary btn-sm" onclick="state.ui.editingItem=null;renderItems(document.getElementById('main-content'))">Done</button>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title">Identity</div>
    <div class="form-grid">
      <div class="form-group">
        <label>Display Name</label>
        <input type="text" value="${escapeHtml(item.displayName)}"
          oninput="getItem('${item.id}').displayName=this.value;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Identifier</label>
        <input type="text" value="${escapeHtml(item.identifier)}"
          oninput="getItem('${item.id}').identifier=this.value;updateJsonPreview()"
          placeholder="${escapeHtml(state.project.namespace)}:my_item">
        <div class="hint">Format: namespace:snake_case_name</div>
      </div>
      <div class="form-group">
        <label>Category</label>
        <select onchange="getItem('${item.id}').category=this.value;updateJsonPreview()">
          ${['Items','Nature','Equipment','Construction','Command'].map(c =>
            `<option ${item.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Max Stack Size</label>
        <input type="number" min="1" max="64" value="${item.maxStackSize}"
          oninput="getItem('${item.id}').maxStackSize=parseInt(this.value)||1;updateJsonPreview()">
      </div>
      <div class="form-group full">
        <label>Texture</label>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${item.textureDataUrl
            ? `<img src="${item.textureDataUrl}" width="32" height="32"
                 style="image-rendering:pixelated;border:1px solid var(--border);border-radius:4px"
                 title="Custom texture">`
            : `<div style="width:32px;height:32px;background:${item.color||'#a07850'};
                 border:1px solid var(--border);border-radius:4px;flex-shrink:0" title="Base color preview"></div>`}
          <button class="btn btn-sm btn-secondary" onclick="openTexturePainter('${item.id}','item')">
            🎨 ${item.textureDataUrl ? 'Edit Texture' : 'Paint Texture'}
          </button>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="color" value="${item.color || '#a07850'}"
              oninput="getItem('${item.id}').color=this.value;renderItems(document.getElementById('main-content'))"
              title="Base color (used for placeholder if no custom texture)">
            <span style="font-size:11px;color:var(--text-muted)">Base color</span>
          </div>
        </div>
        <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:12px;color:var(--text-muted)">Starter template:</span>
          <select style="font-size:12px"
            onchange="getItem('${item.id}').itemShape=this.value">
            ${[
              ['flat',    '⬜ Flat square'],
              ['sword',   '🗡 Sword'],
              ['dagger',  '🔪 Dagger / Knife'],
              ['pickaxe', '⛏ Pickaxe'],
              ['axe',     '🪓 Axe'],
              ['shovel',  '🕳 Shovel'],
              ['bow',     '🏹 Bow'],
              ['arrow',   '↗ Arrow'],
              ['potion',  '🧪 Potion bottle'],
              ['food',    '🍎 Food / round'],
              ['gem',     '💎 Gem / diamond'],
              ['shield',  '🛡 Shield'],
              ['staff',   '🪄 Staff / wand'],
            ].map(([v,l]) => `<option value="${v}" ${(item.itemShape||'flat')===v?'selected':''}>${l}</option>`).join('')}
          </select>
          <button class="btn btn-sm btn-secondary" onclick="getItem('${item.id}').itemShape=this.previousElementSibling.value;openTexturePainter('${item.id}','item')">
            Apply &amp; Open Painter
          </button>
        </div>
        <div class="hint" style="margin-top:6px">
          Choose a starter template shape, then open the painter to customise every pixel.
        </div>
      </div>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title">Properties</div>
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Weapon / Tool</div>
        <div class="toggle-desc">Adds damage and durability properties</div>
      </div>
      <label class="toggle"><input type="checkbox" ${item.isWeapon?'checked':''}
        onchange="getItem('${item.id}').isWeapon=this.checked;renderItems(document.getElementById('main-content'))">
        <span class="toggle-slider"></span></label>
    </div>
    ${item.isWeapon ? `
    <div class="sub-form form-grid">
      <div class="form-group">
        <label>Attack Damage</label>
        <input type="number" min="0" value="${item.damage}"
          oninput="getItem('${item.id}').damage=parseInt(this.value)||0;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Durability</label>
        <input type="number" min="0" value="${item.durability}"
          oninput="getItem('${item.id}').durability=parseInt(this.value)||0;updateJsonPreview()">
      </div>
    </div>` : ''}

    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Food</div>
        <div class="toggle-desc">Makes item edible with hunger restore</div>
      </div>
      <label class="toggle"><input type="checkbox" ${item.isFood?'checked':''}
        onchange="getItem('${item.id}').isFood=this.checked;renderItems(document.getElementById('main-content'))">
        <span class="toggle-slider"></span></label>
    </div>
    ${item.isFood ? `
    <div class="sub-form">
      <div class="form-grid">
        <div class="form-group">
          <label>Nutrition</label>
          <input type="number" min="0" max="20" value="${item.nutrition}"
            oninput="getItem('${item.id}').nutrition=parseInt(this.value)||0;updateJsonPreview()">
        </div>
        <div class="form-group">
          <label>Saturation</label>
          <select onchange="getItem('${item.id}').saturationModifier=this.value;updateJsonPreview()">
            ${['poor','low','normal','good','max','supernatural'].map(s =>
              `<option ${item.saturationModifier===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="toggle-row" style="padding-top:8px">
        <div class="toggle-info"><div class="toggle-label">Can Always Eat</div>
          <div class="toggle-desc">Eat even when hunger bar is full</div></div>
        <label class="toggle"><input type="checkbox" ${item.canAlwaysEat?'checked':''}
          onchange="getItem('${item.id}').canAlwaysEat=this.checked;updateJsonPreview()">
          <span class="toggle-slider"></span></label>
      </div>
    </div>` : ''}

    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Enchantment Glint</div>
        <div class="toggle-desc">Shows the enchanted/foil glimmer effect</div>
      </div>
      <label class="toggle"><input type="checkbox" ${item.isGlint?'checked':''}
        onchange="getItem('${item.id}').isGlint=this.checked;updateJsonPreview()">
        <span class="toggle-slider"></span></label>
    </div>

    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Hand Equipped</div>
        <div class="toggle-desc">Item is held as a tool (shown sideways)</div>
      </div>
      <label class="toggle"><input type="checkbox" ${item.handEquipped?'checked':''}
        onchange="getItem('${item.id}').handEquipped=this.checked;updateJsonPreview()">
        <span class="toggle-slider"></span></label>
    </div>

    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Throwable</div>
        <div class="toggle-desc">Can be thrown like a snowball</div>
      </div>
      <label class="toggle"><input type="checkbox" ${item.isThrowable?'checked':''}
        onchange="getItem('${item.id}').isThrowable=this.checked;updateJsonPreview()">
        <span class="toggle-slider"></span></label>
    </div>
  </div>
</div>`;
}

function getItem(id)   { return state.items.find(i => i.id === id); }
function getBlock(id)  { return state.blocks.find(b => b.id === id); }
function getEntity(id) { return state.entities.find(e => e.id === id); }
function getRecipe(id) { return state.recipes.find(r => r.id === id); }

// ── BLOCKS ─────────────────────────────────────────────────────────────────

function newBlock() {
  const ns = state.project.namespace || 'myaddon';
  const block = {
    id: genId(),
    identifier: `${ns}:new_block`,
    displayName: 'New Block',
    category: 'Construction',
    hardness: 1.5,
    resistance: 6.0,
    friction: 0.6,
    isFlammable: false,
    flamOdds: 5,
    burnOdds: 20,
    mapColor: '#888888',
    lightEmission: 0,
    lightDampening: 15,
    isTransparent: false,
    color: '#888888'
  };
  state.blocks.push(block);
  state.ui.editingBlock = block.id;
  updateBadges();
  renderBlocks(document.getElementById('main-content'));
}

function deleteBlock(id) {
  state.blocks = state.blocks.filter(b => b.id !== id);
  if (state.ui.editingBlock === id) state.ui.editingBlock = null;
  updateBadges();
  renderBlocks(document.getElementById('main-content'));
}

function renderBlocks(container) {
  const editing = state.blocks.find(b => b.id === state.ui.editingBlock);
  container.innerHTML = `
<div class="content-area">
  <div class="section-header">
    <span class="section-icon">🟫</span>
    <div>
      <div class="section-title">Blocks</div>
      <div class="section-subtitle">Create custom placeable blocks with unique properties</div>
    </div>
    <button class="btn btn-primary" style="margin-left:auto" onclick="newBlock()">+ Add Block</button>
  </div>

  ${state.blocks.length === 0 ? `
    <div class="empty-state">
      <div class="empty-state-icon">🟫</div>
      <div class="empty-state-title">No blocks yet</div>
      <div class="empty-state-desc">Create glowing ores, hard materials, decorative blocks and more.</div>
      <button class="btn btn-primary" onclick="newBlock()">+ Create First Block</button>
    </div>` : `
  <div class="element-list">
    ${state.blocks.map(block => `
    <div class="element-card ${state.ui.editingBlock === block.id ? 'active' : ''}"
         onclick="state.ui.editingBlock='${block.id}';renderBlocks(document.getElementById('main-content'));updateJsonPreview()">
      <div class="element-icon" style="background:${escapeHtml(block.color)}40;border-color:${escapeHtml(block.color)}80;overflow:hidden;padding:0">
        ${block.textureDataUrl
          ? `<img src="${block.textureDataUrl}" width="100%" height="100%" style="image-rendering:pixelated;display:block">`
          : '🟫'}
      </div>
      <div class="element-info">
        <div class="element-name">${escapeHtml(block.displayName)}</div>
        <div class="element-id">${escapeHtml(block.identifier)}</div>
      </div>
      <div class="element-actions">
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteBlock('${block.id}')">✕</button>
      </div>
    </div>`).join('')}
  </div>`}

  ${editing ? renderBlockEditor(editing) : ''}
</div>`;
  updateJsonPreview();
}

function renderBlockEditor(block) {
  return `
<div class="editor-panel">
  <div class="editor-panel-header">
    <span class="editor-panel-title">✏ Editing: ${escapeHtml(block.displayName)}</span>
    <button class="btn btn-secondary btn-sm" onclick="state.ui.editingBlock=null;renderBlocks(document.getElementById('main-content'))">Done</button>
  </div>

  <div class="form-section">
    <div class="form-section-title">Identity</div>
    <div class="form-grid">
      <div class="form-group">
        <label>Display Name</label>
        <input type="text" value="${escapeHtml(block.displayName)}"
          oninput="getBlock('${block.id}').displayName=this.value;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Identifier</label>
        <input type="text" value="${escapeHtml(block.identifier)}"
          oninput="getBlock('${block.id}').identifier=this.value;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Category</label>
        <select onchange="getBlock('${block.id}').category=this.value;updateJsonPreview()">
          ${['Construction','Nature','Items','Equipment'].map(c =>
            `<option ${block.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Texture</label>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${block.textureDataUrl
            ? `<img src="${block.textureDataUrl}" width="32" height="32"
                 style="image-rendering:pixelated;border:1px solid var(--border);border-radius:4px"
                 title="Custom texture">`
            : `<div style="width:32px;height:32px;background:${block.color||'#888888'};
                 border:1px solid var(--border);border-radius:4px;flex-shrink:0" title="Base color preview"></div>`}
          <button class="btn btn-sm btn-secondary" onclick="openTexturePainter('${block.id}','block')">
            🎨 ${block.textureDataUrl ? 'Edit Texture' : 'Paint Texture'}
          </button>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="color" value="${block.color || '#888888'}"
              oninput="getBlock('${block.id}').color=this.value;getBlock('${block.id}').mapColor=this.value;renderBlocks(document.getElementById('main-content'))"
              title="Base color (used for map color and placeholder)">
            <span style="font-size:11px;color:var(--text-muted)">Base / map color</span>
          </div>
        </div>
        <div class="hint" style="margin-top:6px">
          Paint a 16×16 pixel-art tile. The same texture appears on all 6 faces of the block.
          Keep it tileable — avoid strong directional gradients at the edges.
        </div>
      </div>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title">Physical Properties</div>
    <div class="form-grid">
      <div class="form-group">
        <label>Hardness <span style="font-weight:400;color:var(--text-dim)">(mining time)</span></label>
        <input type="number" min="0" max="3600" step="0.5" value="${block.hardness}"
          oninput="getBlock('${block.id}').hardness=parseFloat(this.value)||0;updateJsonPreview()">
        <div class="hint">0 = instant | 1.5 = stone | 50 = obsidian-like | -1 = indestructible</div>
      </div>
      <div class="form-group">
        <label>Explosion Resistance</label>
        <input type="number" min="0" max="3600" step="0.5" value="${block.resistance}"
          oninput="getBlock('${block.id}').resistance=parseFloat(this.value)||0;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Friction (0–1)</label>
        <div class="range-row">
          <input type="range" min="0" max="1" step="0.05" value="${block.friction}"
            oninput="getBlock('${block.id}').friction=parseFloat(this.value);this.nextElementSibling.textContent=parseFloat(this.value).toFixed(2);updateJsonPreview()">
          <span class="range-value">${parseFloat(block.friction).toFixed(2)}</span>
        </div>
      </div>
      <div class="form-group">
        <label>Light Emission (0–15)</label>
        <div class="range-row">
          <input type="range" min="0" max="15" step="1" value="${block.lightEmission}"
            oninput="getBlock('${block.id}').lightEmission=parseInt(this.value);this.nextElementSibling.textContent=this.value;updateJsonPreview()">
          <span class="range-value">${block.lightEmission}</span>
        </div>
      </div>
      <div class="form-group">
        <label>Light Dampening (0–15)</label>
        <div class="range-row">
          <input type="range" min="0" max="15" step="1" value="${block.lightDampening}"
            oninput="getBlock('${block.id}').lightDampening=parseInt(this.value);this.nextElementSibling.textContent=this.value;updateJsonPreview()">
          <span class="range-value">${block.lightDampening}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title">Behavior</div>
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Flammable</div>
        <div class="toggle-desc">Block can catch fire and burn</div>
      </div>
      <label class="toggle"><input type="checkbox" ${block.isFlammable?'checked':''}
        onchange="getBlock('${block.id}').isFlammable=this.checked;renderBlocks(document.getElementById('main-content'))">
        <span class="toggle-slider"></span></label>
    </div>
    ${block.isFlammable ? `
    <div class="sub-form form-grid">
      <div class="form-group">
        <label>Catch Fire Chance (0–100)</label>
        <input type="number" min="0" max="100" value="${block.flamOdds}"
          oninput="getBlock('${block.id}').flamOdds=parseInt(this.value)||0;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Burn Chance (0–100)</label>
        <input type="number" min="0" max="100" value="${block.burnOdds}"
          oninput="getBlock('${block.id}').burnOdds=parseInt(this.value)||0;updateJsonPreview()">
      </div>
    </div>` : ''}

    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Transparent</div>
        <div class="toggle-desc">Uses blend render method (for glass-like blocks)</div>
      </div>
      <label class="toggle"><input type="checkbox" ${block.isTransparent?'checked':''}
        onchange="getBlock('${block.id}').isTransparent=this.checked;updateJsonPreview()">
        <span class="toggle-slider"></span></label>
    </div>
  </div>
</div>`;
}

// ── ENTITIES ───────────────────────────────────────────────────────────────

function newEntity() {
  const ns = state.project.namespace || 'myaddon';
  const entity = {
    id: genId(),
    identifier: `${ns}:new_entity`,
    displayName: 'New Entity',
    health: 20,
    movementSpeed: 0.25,
    isHostile: false,
    attackDamage: 3,
    isSpawnable: true,
    isTameable: false,
    swimsInWater: false,
    collisionWidth: 0.6,
    collisionHeight: 1.8,
    dropsXP: 0,
    knockbackResist: 0,
    color: '#888888',
    color2: '#444444',
    textureDataUrl: null,
    bodyType: 'humanoid'
  };
  state.entities.push(entity);
  state.ui.editingEntity = entity.id;
  updateBadges();
  renderEntities(document.getElementById('main-content'));
}

function deleteEntity(id) {
  state.entities = state.entities.filter(e => e.id !== id);
  if (state.ui.editingEntity === id) state.ui.editingEntity = null;
  updateBadges();
  renderEntities(document.getElementById('main-content'));
}

function renderEntities(container) {
  const editing = state.entities.find(e => e.id === state.ui.editingEntity);
  container.innerHTML = `
<div class="content-area">
  <div class="section-header">
    <span class="section-icon">🐾</span>
    <div>
      <div class="section-title">Entities</div>
      <div class="section-subtitle">Create custom mobs — hostile, passive, or tameable</div>
    </div>
    <button class="btn btn-primary" style="margin-left:auto" onclick="newEntity()">+ Add Entity</button>
  </div>

  ${state.entities.length === 0 ? `
    <div class="empty-state">
      <div class="empty-state-icon">🐾</div>
      <div class="empty-state-title">No entities yet</div>
      <div class="empty-state-desc">Create custom mobs with unique behaviors and stats.</div>
      <button class="btn btn-primary" onclick="newEntity()">+ Create First Entity</button>
    </div>` : `
  <div class="element-list">
    ${state.entities.map(ent => `
    <div class="element-card ${state.ui.editingEntity === ent.id ? 'active' : ''}"
         onclick="state.ui.editingEntity='${ent.id}';renderEntities(document.getElementById('main-content'));updateJsonPreview()">
      <div class="element-icon" style="background:${escapeHtml(ent.color || '#888888')}20;border-color:${escapeHtml(ent.color || '#888888')}60;overflow:hidden;padding:0">
        ${ent.textureDataUrl
          ? `<img src="${ent.textureDataUrl}" width="100%" height="100%" style="image-rendering:pixelated;display:block">`
          : (ent.isHostile ? '👹' : ent.isTameable ? '🐕' : '🐄')}
      </div>
      <div class="element-info">
        <div class="element-name">${escapeHtml(ent.displayName)}</div>
        <div class="element-id">${escapeHtml(ent.identifier)}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        ${ent.isHostile ? '<span class="tag tag-red">Hostile</span>' : ent.isTameable ? '<span class="tag tag-green">Tameable</span>' : '<span class="tag tag-blue">Passive</span>'}
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteEntity('${ent.id}')">✕</button>
      </div>
    </div>`).join('')}
  </div>`}

  ${editing ? renderEntityEditor(editing) : ''}
</div>`;
  updateJsonPreview();
}

function renderEntityEditor(entity) {
  return `
<div class="editor-panel">
  <div class="editor-panel-header">
    <span class="editor-panel-title">✏ Editing: ${escapeHtml(entity.displayName)}</span>
    <button class="btn btn-secondary btn-sm" onclick="state.ui.editingEntity=null;renderEntities(document.getElementById('main-content'))">Done</button>
  </div>

  <div class="form-section">
    <div class="form-section-title">Identity</div>
    <div class="form-grid">
      <div class="form-group">
        <label>Display Name</label>
        <input type="text" value="${escapeHtml(entity.displayName)}"
          oninput="getEntity('${entity.id}').displayName=this.value;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Identifier</label>
        <input type="text" value="${escapeHtml(entity.identifier)}"
          oninput="getEntity('${entity.id}').identifier=this.value;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Body Type</label>
        <select onchange="getEntity('${entity.id}').bodyType=this.value;updateJsonPreview();renderEntities(document.getElementById('main-content'))">
          ${[
            ['humanoid','👤 Humanoid (Steve/zombie shape)'],
            ['undead',  '💀 Undead (zombie geometry)'],
            ['quadruped','🐄 Quadruped (pig/cow/horse)'],
            ['bird',    '🐦 Bird (chicken shape)'],
            ['slime',   '🟩 Slime / Cube'],
            ['bat',     '🦇 Bat (small flying)'],
          ].map(([v,l]) => `<option value="${v}" ${entity.bodyType===v?'selected':''}>${l}</option>`).join('')}
        </select>
        <div class="hint">Controls the 3D skeleton used to render the entity in-game. Change this before painting the texture so the UV guide matches.</div>
      </div>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title">Stats</div>
    <div class="form-grid">
      <div class="form-group">
        <label>Max Health</label>
        <input type="number" min="1" max="2048" value="${entity.health}"
          oninput="getEntity('${entity.id}').health=parseInt(this.value)||20;updateJsonPreview()">
        <div class="hint">Zombie=20, Wither=600, Warden=500</div>
      </div>
      <div class="form-group">
        <label>Movement Speed</label>
        <input type="number" min="0" max="10" step="0.05" value="${entity.movementSpeed}"
          oninput="getEntity('${entity.id}').movementSpeed=parseFloat(this.value)||0.25;updateJsonPreview()">
        <div class="hint">Player=0.1, Zombie=0.23, Horse=0.338</div>
      </div>
      <div class="form-group">
        <label>XP Dropped on Death</label>
        <input type="number" min="0" value="${entity.dropsXP}"
          oninput="getEntity('${entity.id}').dropsXP=parseInt(this.value)||0;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Knockback Resistance (0–1)</label>
        <input type="number" min="0" max="1" step="0.1" value="${entity.knockbackResist}"
          oninput="getEntity('${entity.id}').knockbackResist=parseFloat(this.value)||0;updateJsonPreview()">
      </div>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title">Collision Box</div>
    <div class="form-grid form-grid-3">
      <div class="form-group">
        <label>Width</label>
        <input type="number" min="0.1" max="16" step="0.1" value="${entity.collisionWidth}"
          oninput="getEntity('${entity.id}').collisionWidth=parseFloat(this.value)||0.6;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Height</label>
        <input type="number" min="0.1" max="16" step="0.1" value="${entity.collisionHeight}"
          oninput="getEntity('${entity.id}').collisionHeight=parseFloat(this.value)||1.8;updateJsonPreview()">
      </div>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title">Behavior</div>
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Hostile</div>
        <div class="toggle-desc">Attacks players on sight</div>
      </div>
      <label class="toggle"><input type="checkbox" ${entity.isHostile?'checked':''}
        onchange="getEntity('${entity.id}').isHostile=this.checked;renderEntities(document.getElementById('main-content'))">
        <span class="toggle-slider"></span></label>
    </div>
    ${entity.isHostile ? `
    <div class="sub-form">
      <div class="form-group">
        <label>Attack Damage</label>
        <input type="number" min="0" value="${entity.attackDamage}"
          oninput="getEntity('${entity.id}').attackDamage=parseInt(this.value)||3;updateJsonPreview()">
      </div>
    </div>` : ''}

    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Tameable</div>
        <div class="toggle-desc">Can be tamed by the player with bones</div>
      </div>
      <label class="toggle"><input type="checkbox" ${entity.isTameable?'checked':''}
        onchange="getEntity('${entity.id}').isTameable=this.checked;updateJsonPreview()">
        <span class="toggle-slider"></span></label>
    </div>

    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Naturally Spawnable</div>
        <div class="toggle-desc">Can appear in the world naturally (requires spawn rules)</div>
      </div>
      <label class="toggle"><input type="checkbox" ${entity.isSpawnable?'checked':''}
        onchange="getEntity('${entity.id}').isSpawnable=this.checked;updateJsonPreview()">
        <span class="toggle-slider"></span></label>
    </div>

    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-label">Swims in Water</div>
        <div class="toggle-desc">Doesn't avoid water paths</div>
      </div>
      <label class="toggle"><input type="checkbox" ${entity.swimsInWater?'checked':''}
        onchange="getEntity('${entity.id}').swimsInWater=this.checked;updateJsonPreview()">
        <span class="toggle-slider"></span></label>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title">Texture</div>
    <div class="form-group full">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        ${entity.textureDataUrl
          ? `<img src="${entity.textureDataUrl}" width="32" height="32"
               style="image-rendering:pixelated;border:1px solid var(--border);border-radius:4px"
               title="Custom texture">`
          : `<div style="width:32px;height:32px;background:${entity.color||'#888888'};
               border:1px solid var(--border);border-radius:4px;flex-shrink:0" title="Base color preview"></div>`}
        <button class="btn btn-sm btn-secondary" onclick="openTexturePainter('${entity.id}','entity')">
          🎨 ${entity.textureDataUrl ? 'Edit Texture' : 'Paint Texture'}
        </button>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="color" value="${entity.color || '#888888'}"
            oninput="getEntity('${entity.id}').color=this.value;renderEntities(document.getElementById('main-content'))"
            title="Base skin color (used for placeholder if no custom texture)">
          <span style="font-size:11px;color:var(--text-muted)">Base color</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="color" value="${entity.color2 || '#444444'}"
            oninput="getEntity('${entity.id}').color2=this.value"
            title="Spawn egg overlay color">
          <span style="font-size:11px;color:var(--text-muted)">Spawn egg spots</span>
        </div>
      </div>
      <div class="hint" style="margin-top:6px">
        Paint a 16×16 pixel-art texture. The painter shows a faint UV guide matching your chosen body type so you know which pixels map to which body part.
      </div>
    </div>
  </div>
</div>`;
}

// ── RECIPES ────────────────────────────────────────────────────────────────

function newRecipe() {
  const ns = state.project.namespace || 'myaddon';
  const recipe = {
    id: genId(),
    identifier: `${ns}:new_recipe`,
    type: 'shaped',
    pattern: [['','',''],['','',''],['','','']],
    ingredients: [],
    input: '',
    result: '',
    resultCount: 1,
    smeltingType: 'furnace'
  };
  state.recipes.push(recipe);
  state.ui.editingRecipe = recipe.id;
  updateBadges();
  renderRecipes(document.getElementById('main-content'));
}

function deleteRecipe(id) {
  state.recipes = state.recipes.filter(r => r.id !== id);
  if (state.ui.editingRecipe === id) state.ui.editingRecipe = null;
  updateBadges();
  renderRecipes(document.getElementById('main-content'));
}

function renderRecipes(container) {
  const editing = state.recipes.find(r => r.id === state.ui.editingRecipe);
  container.innerHTML = `
<div class="content-area">
  <div class="section-header">
    <span class="section-icon">⚒</span>
    <div>
      <div class="section-title">Recipes</div>
      <div class="section-subtitle">Define crafting, smelting, and shapeless recipes</div>
    </div>
    <button class="btn btn-primary" style="margin-left:auto" onclick="newRecipe()">+ Add Recipe</button>
  </div>

  ${state.recipes.length === 0 ? `
    <div class="empty-state">
      <div class="empty-state-icon">⚒</div>
      <div class="empty-state-title">No recipes yet</div>
      <div class="empty-state-desc">Define how players craft your custom items and blocks.</div>
      <button class="btn btn-primary" onclick="newRecipe()">+ Create First Recipe</button>
    </div>` : `
  <div class="element-list">
    ${state.recipes.map(rec => `
    <div class="element-card ${state.ui.editingRecipe === rec.id ? 'active' : ''}"
         onclick="state.ui.editingRecipe='${rec.id}';renderRecipes(document.getElementById('main-content'));updateJsonPreview()">
      <div class="element-icon">
        ${rec.type==='smelting' ? '🔥' : rec.type==='shapeless' ? '🎲' : '⚒'}
      </div>
      <div class="element-info">
        <div class="element-name">${escapeHtml(rec.identifier)}</div>
        <div class="element-id">→ ${escapeHtml(rec.result || 'no result')}  ×${rec.resultCount}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="tag ${rec.type==='smelting'?'tag-orange':rec.type==='shapeless'?'tag-blue':'tag-green'}">${rec.type}</span>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteRecipe('${rec.id}')">✕</button>
      </div>
    </div>`).join('')}
  </div>`}

  ${editing ? renderRecipeEditor(editing) : ''}
</div>`;
  updateJsonPreview();
}

function renderRecipeEditor(recipe) {
  const gridHtml = recipe.pattern.map((row, ri) =>
    row.map((cell, ci) => {
      const display = cell ? (cell.length > 12 ? '…' + cell.slice(-10) : cell) : '';
      return `
      <div class="crafting-cell ${cell ? 'has-item' : ''}"
           onclick="openCellPopup(${ri},${ci},'${recipe.id}',event)"
           title="${escapeHtml(cell || 'Click to set item')}">
        <div class="cell-display">${escapeHtml(display)}</div>
      </div>`;
    }).join('')
  ).join('');

  const resultDisplay = recipe.result
    ? (recipe.result.length > 14 ? recipe.result.slice(0,12)+'…' : recipe.result)
    : '';

  const shapelessIng = (recipe.ingredients || []).map((ing, i) => `
    <div class="ingredient-tag">
      <span>${escapeHtml(ing)}</span>
      <span class="remove-ing" onclick="removeIngredient('${recipe.id}',${i})">×</span>
    </div>`).join('');

  return `
<div class="editor-panel">
  <div class="editor-panel-header">
    <span class="editor-panel-title">✏ Editing Recipe</span>
    <button class="btn btn-secondary btn-sm" onclick="state.ui.editingRecipe=null;renderRecipes(document.getElementById('main-content'))">Done</button>
  </div>

  <div class="form-section">
    <div class="form-section-title">Identity</div>
    <div class="form-grid">
      <div class="form-group">
        <label>Recipe Identifier</label>
        <input type="text" value="${escapeHtml(recipe.identifier)}"
          oninput="getRecipe('${recipe.id}').identifier=this.value;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Type</label>
        <select onchange="getRecipe('${recipe.id}').type=this.value;renderRecipes(document.getElementById('main-content'))">
          ${['shaped','shapeless','smelting'].map(t =>
            `<option ${recipe.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title">
      ${recipe.type === 'shaped' ? 'Crafting Grid' :
        recipe.type === 'shapeless' ? 'Ingredients' : 'Smelting'}
    </div>

    ${recipe.type === 'shaped' ? `
    <div class="recipe-container">
      <div class="crafting-grid">
        ${gridHtml}
      </div>
      <div class="craft-arrow">→</div>
      <div class="result-slot">
        <div class="crafting-cell ${recipe.result ? 'has-item' : ''}"
             onclick="openResultPopup('${recipe.id}',event)"
             title="${escapeHtml(recipe.result || 'Click to set result')}">
          <div class="cell-display">${escapeHtml(resultDisplay)}</div>
        </div>
      </div>
    </div>
    <div class="hint" style="margin-top:10px">Click any cell to set an ingredient (e.g. <code>minecraft:stick</code>, <code>minecraft:diamond</code>)</div>
    <div style="margin-top:10px;display:flex;gap:10px;align-items:center">
      <label style="text-transform:none;letter-spacing:0;font-size:13px;color:var(--text-muted)">Result count:</label>
      <input type="number" min="1" max="64" value="${recipe.resultCount}"
        style="width:80px"
        oninput="getRecipe('${recipe.id}').resultCount=parseInt(this.value)||1;updateJsonPreview()">
    </div>` : ''}

    ${recipe.type === 'shapeless' ? `
    <div class="shapeless-ingredients">
      ${shapelessIng || '<span style="color:var(--text-dim);font-size:12px">No ingredients yet</span>'}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <input type="text" id="ing-input" placeholder="e.g. minecraft:stick"
        style="flex:1" onkeydown="if(event.key==='Enter')addIngredient('${recipe.id}')">
      <button class="btn btn-secondary btn-sm" onclick="addIngredient('${recipe.id}')">Add</button>
    </div>
    <div style="margin-top:14px;display:flex;gap:10px;align-items:center">
      <label style="text-transform:none;letter-spacing:0;font-size:13px;color:var(--text-muted)">Result item:</label>
      <input type="text" value="${escapeHtml(recipe.result)}" placeholder="namespace:item"
        style="flex:1"
        oninput="getRecipe('${recipe.id}').result=this.value;updateJsonPreview()">
      <label style="text-transform:none;letter-spacing:0;font-size:13px;color:var(--text-muted)">×</label>
      <input type="number" min="1" max="64" value="${recipe.resultCount}"
        style="width:60px"
        oninput="getRecipe('${recipe.id}').resultCount=parseInt(this.value)||1;updateJsonPreview()">
    </div>` : ''}

    ${recipe.type === 'smelting' ? `
    <div class="form-grid">
      <div class="form-group">
        <label>Furnace Type</label>
        <select onchange="getRecipe('${recipe.id}').smeltingType=this.value;updateJsonPreview()">
          ${['furnace','smoker','blast_furnace','campfire'].map(t =>
            `<option ${recipe.smeltingType===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Input Item</label>
        <input type="text" value="${escapeHtml(recipe.input)}" placeholder="e.g. minecraft:iron_ore"
          oninput="getRecipe('${recipe.id}').input=this.value;updateJsonPreview()">
      </div>
      <div class="form-group">
        <label>Output Item</label>
        <input type="text" value="${escapeHtml(recipe.result)}" placeholder="e.g. minecraft:iron_ingot"
          oninput="getRecipe('${recipe.id}').result=this.value;updateJsonPreview()">
      </div>
    </div>` : ''}
  </div>
</div>`;
}

// ── RECIPE HELPERS ─────────────────────────────────────────────────────────

let activeCellRecipeId = null;
let activeCellTarget = null; // 'grid-ri-ci' or 'result'

function openCellPopup(ri, ci, recipeId, event) {
  event.stopPropagation();
  const recipe = getRecipe(recipeId);
  if (!recipe) return;
  activeCellRecipeId = recipeId;
  activeCellTarget = `grid-${ri}-${ci}`;

  const popup = document.getElementById('cell-popup');
  popup.classList.remove('hidden');
  document.getElementById('cell-input').value = recipe.pattern[ri][ci] || '';

  const rect = event.target.closest('.crafting-cell').getBoundingClientRect();
  popup.style.left = (rect.right + 8) + 'px';
  popup.style.top = rect.top + 'px';
  document.getElementById('cell-input').focus();
  document.getElementById('cell-input').select();
}

function openResultPopup(recipeId, event) {
  event.stopPropagation();
  const recipe = getRecipe(recipeId);
  if (!recipe) return;
  activeCellRecipeId = recipeId;
  activeCellTarget = 'result';

  const popup = document.getElementById('cell-popup');
  popup.classList.remove('hidden');
  document.getElementById('cell-input').value = recipe.result || '';

  const rect = event.target.closest('.crafting-cell').getBoundingClientRect();
  popup.style.left = (rect.right + 8) + 'px';
  popup.style.top = rect.top + 'px';
  document.getElementById('cell-input').focus();
  document.getElementById('cell-input').select();
}

function confirmCell() {
  if (!activeCellRecipeId) return;
  const recipe = getRecipe(activeCellRecipeId);
  if (!recipe) return;
  const val = document.getElementById('cell-input').value.trim();

  if (activeCellTarget === 'result') {
    recipe.result = val;
  } else if (activeCellTarget && activeCellTarget.startsWith('grid-')) {
    const [, ri, ci] = activeCellTarget.split('-').map(Number);
    recipe.pattern[ri][ci] = val;
  }

  closePopup();
  renderRecipes(document.getElementById('main-content'));
}

function clearCell() {
  if (!activeCellRecipeId) return;
  const recipe = getRecipe(activeCellRecipeId);
  if (!recipe) return;

  if (activeCellTarget === 'result') {
    recipe.result = '';
  } else if (activeCellTarget && activeCellTarget.startsWith('grid-')) {
    const [, ri, ci] = activeCellTarget.split('-').map(Number);
    recipe.pattern[ri][ci] = '';
  }

  closePopup();
  renderRecipes(document.getElementById('main-content'));
}

function closePopup() {
  document.getElementById('cell-popup').classList.add('hidden');
  activeCellRecipeId = null;
  activeCellTarget = null;
}

function addIngredient(recipeId) {
  const input = document.getElementById('ing-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  const recipe = getRecipe(recipeId);
  if (!recipe) return;
  if (!recipe.ingredients) recipe.ingredients = [];
  recipe.ingredients.push(val);
  input.value = '';
  renderRecipes(document.getElementById('main-content'));
}

function removeIngredient(recipeId, index) {
  const recipe = getRecipe(recipeId);
  if (!recipe || !recipe.ingredients) return;
  recipe.ingredients.splice(index, 1);
  renderRecipes(document.getElementById('main-content'));
}

// ── EXPORT SECTION ─────────────────────────────────────────────────────────

function renderExport(container) {
  const ns = state.project.namespace || 'myaddon';
  const name = state.project.name || 'MyAddon';
  const total = state.items.length + state.blocks.length +
                state.entities.length + state.recipes.length;

  container.innerHTML = `
<div class="content-area">
  <div class="section-header">
    <span class="section-icon">📦</span>
    <div>
      <div class="section-title">Export Addon</div>
      <div class="section-subtitle">Download your mod as a ready-to-install .mcaddon file</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-num">${state.items.length}</div>
      <div class="summary-label">Items</div>
    </div>
    <div class="summary-card">
      <div class="summary-num">${state.blocks.length}</div>
      <div class="summary-label">Blocks</div>
    </div>
    <div class="summary-card">
      <div class="summary-num">${state.entities.length}</div>
      <div class="summary-label">Entities</div>
    </div>
    <div class="summary-card">
      <div class="summary-num">${state.recipes.length}</div>
      <div class="summary-label">Recipes</div>
    </div>
  </div>

  ${total === 0 ? `<div class="warn-box" style="margin-bottom:20px">
    ⚠ Your addon is empty. Add some items, blocks, entities, or recipes before exporting.
  </div>` : ''}

  <div class="export-grid">
    <div class="export-card">
      <div class="export-card-icon">⬇</div>
      <div class="export-card-title">${escapeHtml(name)}.mcaddon</div>
      <div class="export-card-desc">
        Downloads a complete <code>.mcaddon</code> package containing both the
        Behavior Pack and Resource Pack. Double-click on Windows/Android to auto-import
        into Minecraft Bedrock.
      </div>
      <button class="btn btn-primary btn-lg" onclick="doExport()" ${total===0?'disabled':''}>
        ⬇ Download .mcaddon
      </button>
    </div>

    <div class="export-card">
      <div class="export-card-icon">📖</div>
      <div class="export-card-title">Install Guide</div>
      <div class="export-card-desc">
        Step-by-step instructions for installing on Windows, Android, and iOS.
        Learn how to apply your addon to a specific world.
      </div>
      <button class="btn btn-blue btn-lg" onclick="showInstallModal()">
        📖 View Install Guide
      </button>
    </div>
  </div>

  <div class="card" style="margin-top:8px">
    <div class="card-header">
      <div class="card-title">📁 What's included in the export</div>
    </div>
    <div style="font-family:'Courier New',monospace;font-size:12px;color:var(--text-muted);line-height:2">
      <span style="color:var(--teal)">${escapeHtml(name)}.mcaddon</span><br>
      ├── <span style="color:var(--green)">${escapeHtml(name)}_BP/</span><br>
      │   ├── manifest.json<br>
      │   ├── pack_icon.png<br>
      ${state.items.length > 0 ? `│   ├── items/  <span style="color:var(--text-dim)">(${state.items.length} file${state.items.length!==1?'s':''})</span><br>` : ''}
      ${state.blocks.length > 0 ? `│   ├── blocks/  <span style="color:var(--text-dim)">(${state.blocks.length} file${state.blocks.length!==1?'s':''})</span><br>` : ''}
      ${state.entities.length > 0 ? `│   ├── entities/  <span style="color:var(--text-dim)">(${state.entities.length} file${state.entities.length!==1?'s':''})</span><br>` : ''}
      ${state.recipes.length > 0 ? `│   └── recipes/  <span style="color:var(--text-dim)">(${state.recipes.length} file${state.recipes.length!==1?'s':''})</span><br>` : '│   └── (no content yet)<br>'}
      └── <span style="color:var(--blue)">${escapeHtml(name)}_RP/</span><br>
      &nbsp;&nbsp;&nbsp;&nbsp;├── manifest.json<br>
      &nbsp;&nbsp;&nbsp;&nbsp;├── pack_icon.png<br>
      ${state.items.length > 0 ? `&nbsp;&nbsp;&nbsp;&nbsp;├── textures/items/  <span style="color:var(--text-dim)">(placeholder PNGs)</span><br>` : ''}
      ${state.blocks.length > 0 ? `&nbsp;&nbsp;&nbsp;&nbsp;├── textures/blocks/  <span style="color:var(--text-dim)">(placeholder PNGs)</span><br>` : ''}
      &nbsp;&nbsp;&nbsp;&nbsp;└── texts/en_US.lang
    </div>
  </div>

  <div class="info-box" style="margin-top:16px">
    🎨 <strong>Textures:</strong> Auto-generated 16×16 colored placeholders are included.
    To use custom pixel art, open the exported <code>.mcaddon</code> (rename to <code>.zip</code>),
    and replace the PNG files in <code>_RP/textures/</code> with your own 16×16 images.
  </div>
</div>`;
}

// ── MODALS ─────────────────────────────────────────────────────────────────

function showInstallModal() {
  document.getElementById('install-modal').classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function setInstallTab(tab) {
  document.querySelectorAll('.install-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.install-content').forEach(el => el.classList.remove('active'));
  const tabEl = document.querySelector(`.install-tab[onclick*="${tab}"]`);
  const contentEl = document.getElementById(`tab-${tab}`);
  if (tabEl) tabEl.classList.add('active');
  if (contentEl) contentEl.classList.add('active');
}

// ── KEYBOARD & GLOBAL EVENTS ────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closePopup();
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
  }
  if (e.key === 'Enter' && !document.getElementById('cell-popup').classList.contains('hidden')) {
    confirmCell();
  }
});

document.addEventListener('click', e => {
  const popup = document.getElementById('cell-popup');
  if (!popup.classList.contains('hidden') && !popup.contains(e.target)) {
    closePopup();
  }
});

// ── INIT ───────────────────────────────────────────────────────────────────

(function init() {
  switchTab('project');
  updateBadges();
  updateJsonPreview();
})();
