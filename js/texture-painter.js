// js/texture-painter.js – In-browser 16×16 pixel-art texture editor

const MC_PALETTE = [
  // Whites & Grays
  '#ffffff','#e8e8e8','#c8c8c8','#a0a0a0','#787878','#505050','#282828','#000000',
  // Browns & Earth
  '#d4b896','#c49a6c','#a07850','#8b5e3c','#7c4a28','#5c3010','#3e1f08','#6b3a1f',
  // Greens
  '#aed581','#8bc34a','#4caf50','#2e7d32','#1b5e20','#69f0ae','#00c853','#33691e',
  // Blues
  '#80d8ff','#42a5f5','#2196f3','#1565c0','#0d47a1','#29b6f6','#00b0ff','#01579b',
  // Reds & Orange
  '#ffcdd2','#ef5350','#e53935','#b71c1c','#ff8a65','#ff5722','#d84315','#bf360c',
  // Yellows & Gold
  '#fff9c4','#ffd600','#ffc107','#ff8f00','#ffca28','#ff9800','#e65100','#ff6f00',
  // Purples & Pink
  '#f8bbd0','#ce93d8','#9c27b0','#6a1b9a','#f48fb1','#e91e63','#880e4f','#4a148c',
  // Special / Neon
  '#00e5ff','#1de9b6','#76ff03','#c6ff00','#ff4081','#651fff','#3d5afe','#ff6d00',
];

// Painter state (module-level, one painter at a time)
const painterState = {
  pixels: null,      // Array(256) of hex strings or null (transparent)
  tool: 'pencil',
  color: '#8b5e3c',
  painting: false,
  targetId: null,
  targetType: null,  // 'item' | 'block'
};

// ── Open / Close ───────────────────────────────────────────────────────────

function openTexturePainter(targetId, targetType) {
  painterState.targetId = targetId;
  painterState.targetType = targetType;
  painterState.tool = 'pencil';

  const obj = targetType === 'item' ? getItem(targetId) : targetType === 'entity' ? getEntity(targetId) : getBlock(targetId);
  const existing = obj ? obj.textureDataUrl : null;

  if (existing) {
    loadPixelsFromDataUrl(existing).then(pixels => {
      painterState.pixels = pixels;
      _buildPainterModal();
    });
  } else {
    painterState.pixels = new Array(256).fill(null);
    if (obj) _fillPixelsFromBaseColor(obj.color || '#888888', targetType, obj.itemShape || 'flat');
    _buildPainterModal();
  }
}

function closeTexturePainter() {
  const modal = document.getElementById('tp-modal');
  if (modal) modal.remove();
  painterState.painting = false;
}

// ── Build modal DOM ────────────────────────────────────────────────────────

function _buildPainterModal() {
  const existing = document.getElementById('tp-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tp-modal';
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'z-index:2000';

  overlay.innerHTML = `
<div class="modal" style="max-width:700px;width:98%;max-height:90vh;overflow-y:auto">
  <div class="modal-header">
    <span class="modal-title">🎨 Texture Painter
      <span style="font-size:12px;color:var(--text-dim);font-weight:400;margin-left:8px">16 × 16 pixel art</span>
    </span>
    <button class="close-btn" onclick="closeTexturePainter()">×</button>
  </div>

  <div class="modal-body" style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">

    <!-- ── Canvas ── -->
    <div>
      <canvas id="tp-canvas" width="320" height="320"
        style="display:block;cursor:crosshair;border:2px solid var(--border);
               border-radius:6px;image-rendering:pixelated;touch-action:none"></canvas>
      <div style="margin-top:6px;font-size:11px;color:var(--text-dim);text-align:center">
        Each square = 1 pixel (20× zoom)
      </div>
    </div>

    <!-- ── Controls ── -->
    <div style="flex:1;min-width:210px;display:flex;flex-direction:column;gap:14px">

      <!-- Preview -->
      <div>
        <div class="form-section-title" style="margin-bottom:6px">Preview</div>
        <div style="display:flex;gap:10px;align-items:center">
          <canvas id="tp-preview-64" width="16" height="16"
            style="width:64px;height:64px;border:1px solid var(--border);border-radius:4px;image-rendering:pixelated"></canvas>
          <canvas id="tp-preview-32" width="16" height="16"
            style="width:32px;height:32px;border:1px solid var(--border);border-radius:3px;image-rendering:pixelated"></canvas>
          <canvas id="tp-preview-16" width="16" height="16"
            style="width:16px;height:16px;border:1px solid var(--border);border-radius:2px;image-rendering:pixelated"></canvas>
          <span style="font-size:11px;color:var(--text-muted)">64px&nbsp;&nbsp;32px&nbsp;&nbsp;16px (true size)</span>
        </div>
      </div>

      <!-- Tools -->
      <div>
        <div class="form-section-title" style="margin-bottom:6px">Tools</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button id="tp-tool-pencil" class="btn btn-sm btn-primary"
            onclick="tpSetTool('pencil')" title="Draw pixels">✏ Draw</button>
          <button id="tp-tool-eraser" class="btn btn-sm btn-secondary"
            onclick="tpSetTool('eraser')" title="Erase to transparent">◻ Erase</button>
          <button id="tp-tool-fill" class="btn btn-sm btn-secondary"
            onclick="tpSetTool('fill')" title="Flood-fill region">🪣 Fill</button>
        </div>
      </div>

      <!-- Active color -->
      <div>
        <div class="form-section-title" style="margin-bottom:6px">Active Color</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div id="tp-swatch" style="width:36px;height:36px;background:${painterState.color};
            border:2px solid var(--border);border-radius:4px;flex-shrink:0"></div>
          <input type="color" id="tp-color-input" value="${painterState.color}"
            oninput="tpSetColor(this.value)"
            style="width:44px;height:36px;padding:2px;border:1px solid var(--border);
                   border-radius:4px;background:var(--bg-card);cursor:pointer">
          <code id="tp-color-label" style="font-size:12px;color:var(--text-muted)">${painterState.color}</code>
        </div>
      </div>

      <!-- Palette -->
      <div>
        <div class="form-section-title" style="margin-bottom:6px">
          Palette <span style="font-weight:400;font-size:11px;color:var(--text-dim)">— Minecraft-inspired</span>
        </div>
        <div id="tp-palette" style="display:flex;flex-wrap:wrap;gap:3px;max-width:230px">
          ${MC_PALETTE.map((c,i) => `
            <div data-pi="${i}" title="${c}" onclick="tpSetColor('${c}')"
              style="width:20px;height:20px;background:${c};
                     border:2px solid ${painterState.color===c?'#fff':'var(--border)'};
                     border-radius:3px;cursor:pointer;flex-shrink:0">
            </div>`).join('')}
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn btn-sm btn-secondary" onclick="tpFillFromBaseColor()">
          ↺ Reset from Base Color
        </button>
        <button class="btn btn-sm btn-secondary" onclick="tpClear()">
          🗑 Clear All (transparent)
        </button>
      </div>
    </div>
  </div>

  <!-- Tips -->
  <div class="info-box" style="margin:14px 16px 0;font-size:12px;line-height:1.7">
    <strong>Texture Guidelines:</strong>
    Minecraft textures are <strong>16×16 pixels</strong> — keep your art simple and readable at small sizes.
    <br>
    • <strong>Items:</strong> Draw a flat icon with a clear silhouette. The starter template gives you the right shape — customise colors and details on top.
    <br>
    • <strong>Blocks:</strong> The same texture tiles all 6 faces. Aim for a <em>seamless tile</em> — keep the brightest highlights near the center.
    <br>
    • <strong>Entities:</strong> Yellow outlines show the UV regions for each body part (head, body, limbs). Paint each region to color that part of the 3D model.
    <br>
    • <strong>Colors:</strong> Stick to ~4–8 colors per texture. Dithering (alternating pixels) is great for gradients.
    <br>
    • Hit <strong>Save Texture</strong> to store it. It will be embedded as a real PNG in your exported <code>.mcaddon</code>.
  </div>

  <div class="modal-footer" style="margin-top:14px">
    <button class="btn btn-secondary" onclick="closeTexturePainter()">Cancel</button>
    <button class="btn btn-primary" onclick="tpSave()">💾 Save Texture</button>
  </div>
</div>`;

  document.body.appendChild(overlay);

  const canvas = document.getElementById('tp-canvas');
  _setupCanvasEvents(canvas);
  tpRedraw();
}

// ── Canvas event setup ─────────────────────────────────────────────────────

function _setupCanvasEvents(canvas) {
  function coordsFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 16 / rect.width;
    const scaleY = 16 / rect.height;
    const x = Math.max(0, Math.min(15, Math.floor((e.clientX - rect.left) * scaleX)));
    const y = Math.max(0, Math.min(15, Math.floor((e.clientY - rect.top)  * scaleY)));
    return { x, y };
  }

  function applyTool(e) {
    const { x, y } = coordsFromEvent(e);
    const idx = y * 16 + x;
    if (painterState.tool === 'pencil') {
      painterState.pixels[idx] = painterState.color;
    } else if (painterState.tool === 'eraser') {
      painterState.pixels[idx] = null;
    } else if (painterState.tool === 'fill') {
      _floodFill(x, y);
      painterState.painting = false;
    }
    tpRedraw();
  }

  canvas.addEventListener('mousedown', e => { painterState.painting = true; applyTool(e); });
  canvas.addEventListener('mousemove', e => { if (painterState.painting) applyTool(e); });
  canvas.addEventListener('mouseup',   () => { painterState.painting = false; });
  canvas.addEventListener('mouseleave',() => { painterState.painting = false; });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    painterState.painting = true;
    applyTool(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (painterState.painting) applyTool(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener('touchend', () => { painterState.painting = false; });
}

// ── Redraw ─────────────────────────────────────────────────────────────────

function tpRedraw() {
  const canvas = document.getElementById('tp-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pw = W / 16, ph = H / 16;

  // Checkerboard (transparency indicator)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#bbbbbb' : '#eeeeee';
      ctx.fillRect(x * pw, y * ph, pw, ph);
    }
  }

  // Pixels
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = painterState.pixels[y * 16 + x];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(x * pw, y * ph, pw, ph);
      }
    }
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath(); ctx.moveTo(i * pw, 0); ctx.lineTo(i * pw, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * ph); ctx.lineTo(W, i * ph); ctx.stroke();
  }

  // Entity UV guide overlay
  if (painterState.targetType === 'entity') {
    const entity = getEntity(painterState.targetId);
    const guides = ENTITY_UV_GUIDES[(entity && entity.bodyType) || 'humanoid'] || [];
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,100,0.7)';
    ctx.lineWidth = 1.5;
    ctx.font = `bold ${Math.floor(pw * 0.7)}px monospace`;
    ctx.fillStyle = 'rgba(255,255,100,0.9)';
    for (const g of guides) {
      ctx.strokeRect(g.x * pw, g.y * ph, g.w * pw, g.h * ph);
      ctx.fillText(g.label, g.x * pw + 2, g.y * ph + Math.floor(pw * 0.8));
    }
    ctx.restore();
  }

  _updatePreviews();
}

function _updatePreviews() {
  for (const id of ['tp-preview-64', 'tp-preview-32', 'tp-preview-16']) {
    const c = document.getElementById(id);
    if (!c) continue;
    const ctx = c.getContext('2d');
    // Checkerboard
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#bbbbbb' : '#eeeeee';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Pixels
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const col = painterState.pixels[y * 16 + x];
        if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
      }
    }
  }
}

// ── Tool actions ───────────────────────────────────────────────────────────

function tpSetTool(tool) {
  painterState.tool = tool;
  for (const t of ['pencil', 'eraser', 'fill']) {
    const btn = document.getElementById(`tp-tool-${t}`);
    if (btn) btn.className = `btn btn-sm ${t === tool ? 'btn-primary' : 'btn-secondary'}`;
  }
}

function tpSetColor(color) {
  painterState.color = color;
  const swatch = document.getElementById('tp-swatch');
  const input  = document.getElementById('tp-color-input');
  const label  = document.getElementById('tp-color-label');
  if (swatch) swatch.style.background = color;
  if (input)  input.value = color;
  if (label)  label.textContent = color;

  // Update palette highlight
  const palette = document.getElementById('tp-palette');
  if (palette) {
    palette.querySelectorAll('div[data-pi]').forEach((el, i) => {
      el.style.borderColor = MC_PALETTE[i] === color ? '#ffffff' : 'var(--border)';
    });
  }

  // Switch to pencil if eraser was active
  if (painterState.tool === 'eraser') tpSetTool('pencil');
}

function tpClear() {
  painterState.pixels = new Array(256).fill(null);
  tpRedraw();
}

function tpFillFromBaseColor() {
  const t = painterState.targetType;
  const obj = t === 'item' ? getItem(painterState.targetId)
            : t === 'entity' ? getEntity(painterState.targetId)
            : getBlock(painterState.targetId);
  const color = (obj && obj.color) ? obj.color : '#888888';
  const shape = (obj && obj.itemShape) ? obj.itemShape : 'flat';
  _fillPixelsFromBaseColor(color, t, shape);
  tpRedraw();
}

// ── Item shape templates ────────────────────────────────────────────────────
// Each template is 16 rows of 16 chars: 0=transparent 1=base 2=light 3=dark 4=darker
const ITEM_TEMPLATES = {
  flat: [
    '0111111111111110',
    '1222222222222221',
    '1211111111111121',
    '1211111111111121',
    '1211111111111121',
    '1211111111111121',
    '1211111111111121',
    '1211111111111121',
    '1211111111111121',
    '1211111111111121',
    '1211111111111121',
    '1211111111111121',
    '1211111111111121',
    '1211111111111121',
    '1333333333333331',
    '0133333333333310',
  ],
  sword: [
    '0000000000000021',
    '0000000000000120',
    '0000000000001200',
    '0000000000012000',
    '0000000000120000',
    '0000000001200000',
    '0000000012000000',
    '0000034412000000',
    '0000001200000000',
    '0000012000000000',
    '0000120000000000',
    '0001200000000000',
    '0012000000000000',
    '0034000000000000',
    '0300000000000000',
    '0000000000000000',
  ],
  dagger: [
    '0000000000002100',
    '0000000000012000',
    '0000000000120000',
    '0000000001200000',
    '0000000012000000',
    '0000000120000000',
    '0000001200000000',
    '0000012000000000',
    '0000120000000000',
    '0003400000000000',
    '0030000000000000',
    '0300000000000000',
    '3000000000000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ],
  pickaxe: [
    '0000000000000000',
    '0000001244310000',
    '0000012433100000',
    '0000124331000000',
    '0001243312000000',
    '0002433120000000',
    '0024331200440000',
    '0043312004400000',
    '0001200044000000',
    '0000120440000000',
    '0000014400000000',
    '0000044000000000',
    '0000440000000000',
    '0004400000000000',
    '0044000000000000',
    '0000000000000000',
  ],
  axe: [
    '0000000000000000',
    '0000000002110000',
    '0000000021220000',
    '0000000212220000',
    '0000002122110000',
    '0000021221100000',
    '0000212211000000',
    '0002122200000000',
    '0021222000000000',
    '0001100000000000',
    '0011000000000000',
    '0110000000000000',
    '1100000000000000',
    '3400000000000000',
    '0000000000000000',
    '0000000000000000',
  ],
  shovel: [
    '0000000021200000',
    '0000000213200000',
    '0000002132000000',
    '0000002132000000',
    '0000002132000000',
    '0000002132000000',
    '0000002132000000',
    '0000001210000000',
    '0000000120000000',
    '0000000120000000',
    '0000000120000000',
    '0000000120000000',
    '0000000340000000',
    '0000000340000000',
    '0000000000000000',
    '0000000000000000',
  ],
  bow: [
    '0000000000001100',
    '0000000000112000',
    '0000000001100000',
    '0001100011000000',
    '0001100110000000',
    '0000001100000000',
    '0000011000000000',
    '0000110000000000',
    '0001100000000000',
    '0001100000000000',
    '0001100000110000',
    '0000110001100000',
    '0000011011000000',
    '0000001110000000',
    '0000000100000000',
    '0000000000000000',
  ],
  arrow: [
    '0000000000000021',
    '0000000000000213',
    '0000000000002130',
    '0000000000021300',
    '0000000000213000',
    '0000000002130000',
    '0000000021300000',
    '0000000213000000',
    '0000002130000000',
    '0000021300000000',
    '0000213000000000',
    '0002130000000000',
    '0013000000000000',
    '0320000000000000',
    '3200000000000000',
    '0000000000000000',
  ],
  potion: [
    '0000001100000000',
    '0000011100000000',
    '0000034400000000',
    '0000344400000000',
    '0002222220000000',
    '0022222222000000',
    '0222222222200000',
    '0221212121200000',
    '0222222222200000',
    '0222222222200000',
    '0222222222200000',
    '0222121212200000',
    '0222222222200000',
    '0022222222000000',
    '0002222220000000',
    '0000000000000000',
  ],
  food: [
    '0000022200000000',
    '0000213220000000',
    '0002132222200000',
    '0021322222320000',
    '0013222222230000',
    '0132222222223000',
    '0132222222223000',
    '0132222222223000',
    '0132222222223000',
    '0132222222223000',
    '0013222222230000',
    '0001322222300000',
    '0000132223000000',
    '0000013230000000',
    '0000001300000000',
    '0000000000000000',
  ],
  gem: [
    '0000012221000000',
    '0000123432100000',
    '0001234443210000',
    '0012344444321000',
    '0123444444432100',
    '0134444444443100',
    '0034444444443000',
    '0013444444430000',
    '0001344444300000',
    '0000134444300000',
    '0000013443000000',
    '0000001430000000',
    '0000000300000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ],
  shield: [
    '0012222222210000',
    '0122222222221000',
    '0122222222221000',
    '0122222222221000',
    '0122222222221000',
    '0122232232221000',
    '0122322232221000',
    '0122232232221000',
    '0012222222210000',
    '0001222222100000',
    '0000122221000000',
    '0000012210000000',
    '0000001100000000',
    '0000000000000000',
    '0000000000000000',
    '0000000000000000',
  ],
  staff: [
    '0000002222000000',
    '0000022322200000',
    '0000223222200000',
    '0000222232000000',
    '0000022200000000',
    '0000002100000000',
    '0000021000000000',
    '0000210000000000',
    '0002100000000000',
    '0021000000000000',
    '0210000000000000',
    '2100000000000000',
    '3400000000000000',
    '4300000000000000',
    '0000000000000000',
    '0000000000000000',
  ],
};

// ── Entity UV region guides (scaled to 16×16 painter) ──────────────────────
// Draws faint labeled outlines to show where each body-part UV maps
const ENTITY_UV_GUIDES = {
  humanoid: [
    { label:'Head',  x:2, y:0, w:5, h:4 },
    { label:'Body',  x:3, y:5, w:5, h:5 },
    { label:'R.Arm', x:9, y:5, w:3, h:5 },
    { label:'R.Leg', x:0, y:5, w:3, h:5 },
    { label:'L.Arm', x:7, y:12,w:3, h:4 },
    { label:'L.Leg', x:3, y:12,w:3, h:4 },
  ],
  undead: [
    { label:'Head',  x:2, y:0, w:5, h:4 },
    { label:'Body',  x:3, y:5, w:5, h:5 },
    { label:'R.Arm', x:9, y:5, w:3, h:5 },
    { label:'R.Leg', x:0, y:5, w:3, h:5 },
    { label:'L.Arm', x:7, y:12,w:3, h:4 },
    { label:'L.Leg', x:3, y:12,w:3, h:4 },
  ],
  quadruped: [
    { label:'Head',  x:0, y:0, w:6, h:3 },
    { label:'Body',  x:6, y:3, w:8, h:5 },
    { label:'Leg 1', x:0, y:5, w:2, h:6 },
    { label:'Leg 2', x:2, y:5, w:2, h:6 },
    { label:'Leg 3', x:4, y:5, w:2, h:6 },
    { label:'Leg 4', x:6, y:5, w:2, h:6 },
  ],
  bird: [
    { label:'Head',  x:0, y:0, w:5, h:3 },
    { label:'Body',  x:5, y:2, w:7, h:6 },
    { label:'Wing L',x:1, y:5, w:3, h:6 },
    { label:'Wing R',x:1, y:11,w:3, h:5 },
    { label:'Leg',   x:5, y:9, w:2, h:5 },
    { label:'Beak',  x:12,y:0, w:3, h:3 },
  ],
  slime: [
    { label:'Outer', x:0, y:0, w:8, h:8 },
    { label:'Inner', x:8, y:0, w:8, h:8 },
  ],
  bat: [
    { label:'Body',  x:0, y:0, w:6, h:5 },
    { label:'Head',  x:6, y:0, w:5, h:4 },
    { label:'Wing',  x:0, y:6, w:16,h:6 },
  ],
};

function _fillPixelsFromBaseColor(color, type, shape) {
  const pixels = painterState.pixels;

  if (type === 'block') {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dark = (x < 8 && y < 8) || (x >= 8 && y >= 8);
        pixels[y * 16 + x] = dark ? _shadeHex(color, -45) : _shadeHex(color, 30);
      }
    }
    return;
  }

  if (type === 'entity') {
    for (let i = 0; i < 256; i++) pixels[i] = color;
    return;
  }

  // Item — use shape template
  const tpl = ITEM_TEMPLATES[shape] || ITEM_TEMPLATES.flat;
  const L = _shadeHex(color, 70);
  const D = _shadeHex(color, -55);
  const DK = _shadeHex(color, -90);
  const map = { '0': null, '1': color, '2': L, '3': D, '4': DK };
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      pixels[y * 16 + x] = map[tpl[y][x]] ?? null;
    }
  }
}

function _floodFill(startX, startY) {
  const pixels = painterState.pixels;
  const fillColor = painterState.tool === 'eraser' ? null : painterState.color;
  const targetColor = pixels[startY * 16 + startX];
  if (targetColor === fillColor) return;

  const stack = [[startX, startY]];
  const visited = new Set();
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || x > 15 || y < 0 || y > 15) continue;
    const key = y * 16 + x;
    if (visited.has(key)) continue;
    if (pixels[key] !== targetColor) continue;
    visited.add(key);
    pixels[key] = fillColor;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
}

// ── Save ───────────────────────────────────────────────────────────────────

function tpSave() {
  const dataUrl = _pixelsToDataUrl();
  const t = painterState.targetType;
  const obj = t === 'item' ? getItem(painterState.targetId)
            : t === 'entity' ? getEntity(painterState.targetId)
            : getBlock(painterState.targetId);
  if (obj) {
    obj.textureDataUrl = dataUrl;
    showToast('✓ Texture saved!', 'success');
  }
  closeTexturePainter();
  const mc = document.getElementById('main-content');
  if (t === 'item') renderItems(mc);
  else if (t === 'entity') renderEntities(mc);
  else renderBlocks(mc);
}

function _pixelsToDataUrl() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const col = painterState.pixels[y * 16 + x];
      if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
    }
  }
  return c.toDataURL('image/png');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function loadPixelsFromDataUrl(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 16, 16);
      const d = ctx.getImageData(0, 0, 16, 16).data;
      const pixels = [];
      for (let i = 0; i < 256; i++) {
        const r = d[i*4], g = d[i*4+1], b = d[i*4+2], a = d[i*4+3];
        if (a < 10) pixels.push(null);
        else {
          pixels.push(`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`);
        }
      }
      resolve(pixels);
    };
    img.src = dataUrl;
  });
}

function _shadeHex(hex, amount) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const clamp = v => Math.max(0, Math.min(255, v + amount));
  const r = clamp(parseInt(m[1], 16));
  const g = clamp(parseInt(m[2], 16));
  const b = clamp(parseInt(m[3], 16));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
