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
    // Pre-fill from base color
    if (obj) _fillPixelsFromBaseColor(obj.color || '#888888', targetType);
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
    • <strong>Items:</strong> Draw a flat icon with a clear silhouette. Use transparent edges (Erase tool) to define the shape. Strong colors and high contrast read best.
    <br>
    • <strong>Blocks:</strong> The same texture tiles all 6 faces. Aim for a <em>seamless tile</em> — keep the brightest highlights near the center. A 2-tone checkerboard shading gives a classic block feel.
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
  _fillPixelsFromBaseColor(color, t);
  tpRedraw();
}

function _fillPixelsFromBaseColor(color, type) {
  const pixels = painterState.pixels;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = y * 16 + x;
      if (type === 'block') {
        // Blocky quad-shading (mimic export.js placeholder)
        const dark = (x < 8 && y < 8) || (x >= 8 && y >= 8);
        pixels[idx] = dark ? _shadeHex(color, -45) : _shadeHex(color, 30);
      } else if (type === 'entity') {
        // Solid skin base with subtle top-highlight
        pixels[idx] = y <= 1 ? _shadeHex(color, 40) : y >= 14 ? _shadeHex(color, -40) : color;
      } else {
        // Item: flat with highlighted top-left edge, dark bottom-right
        if (x === 0 || y === 0 || x === 15 || y === 15) {
          pixels[idx] = null;
        } else if (x <= 1 || y <= 1) {
          pixels[idx] = _shadeHex(color, 70);
        } else if (x >= 14 || y >= 14) {
          pixels[idx] = _shadeHex(color, -70);
        } else {
          pixels[idx] = color;
        }
      }
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
