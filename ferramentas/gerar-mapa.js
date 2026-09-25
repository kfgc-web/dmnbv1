/* ============================================================
   DOMINATION: BRITANNIA — ferramentas/gerar-mapa.js
   Gera o desenho.js (o mapa "estilo WAR") a partir do litoral real
   (Natural Earth, 1:10m, domínio público) e dos dados de mapa.js.

   NÃO é carregado pelo jogo — só roda no computador, quando o mapa
   precisar ser redesenhado:
       npm i world-atlas@2 topojson-client
       node ferramentas/gerar-mapa.js            (gera desenho.js)
       node ferramentas/gerar-mapa.js --previa   (+ previa-mapa.png)

   Como funciona:
   1. Projeta o litoral da Britânia + Irlanda na tela (1000 x 1300).
   2. "Pinta" a terra em pixels e faz cada território crescer a partir
      das suas ÂNCORAS (pontos reais do mapa), sem nunca encostar num
      território que NÃO é vizinho dele em mapa.js.
   3. Confere que as fronteiras desenhadas batem 100% com as vizinhanças
      por terra de mapa.js (as rotas marítimas viram linhas tracejadas).
   4. Converte os pixels em contornos suaves e grava desenho.js.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const topo = require("topojson-client");
const LAND = require("world-atlas/land-10m.json");

const RAIZ = path.join(__dirname, "..");
const PREVIA = process.argv.includes("--previa");

// ---- dados do jogo (mapa.js) ----
const ctx = {};
new Function("ctx", fs.readFileSync(path.join(RAIZ, "mapa.js"), "utf8") +
  "\nctx.TERRITORIOS = TERRITORIOS; ctx.REGIOES = REGIOES; ctx.ROTAS_MARITIMAS = ROTAS_MARITIMAS;")(ctx);
const { TERRITORIOS, REGIOES, ROTAS_MARITIMAS } = ctx;
const NOMES = Object.keys(TERRITORIOS);
const IDX = {}; NOMES.forEach((n, i) => { IDX[n] = i; });

// ---- tela e projeção (equiretangular com correção de latitude) ----
const W = 1200, H = 1300;
const LAT0 = 54.5, KX = Math.cos(LAT0 * Math.PI / 180);
const BBOX = { lon0: -11, lon1: 2, lat0: 49.8, lat1: 59.45 };

// ÂNCORAS [lat, lon]: de onde cada território "cresce". Mais de uma
// âncora puxa o território para aquele lado (p/ criar as fronteiras
// exigidas pelas vizinhanças do jogo).
const ANCORAS = {
  // Westseaxe
  "Cornwealas": [[50.45, -4.75], [50.2, -5.3]],
  "Defnas": [[50.75, -3.75]],
  "Sumorsaete": [[51.1, -2.8], [51.55, -2.55], [51.85, -2.45]],
  "Gleawanceaster": [[51.8, -1.75], [51.65, -1.0]],
  "Wintanceaster": [[51.06, -1.31], [50.8, -2.2]],
  "Suthseaxe": [[50.92, -0.25]],
  "Cent": [[51.2, 0.85], [51.4, 0.5]],
  "Eastseaxe": [[51.8, 0.55], [51.6, 0.3]],
  "Lundenburg": [[51.5, -0.25], [51.9, -0.5]],
  // East Engle
  "Northfolc": [[52.65, 1.0]],
  "Suthfolc": [[52.2, 1.05]],
  "Grantebrycge": [[52.2, 0.12]],
  "Medeshamstede": [[52.62, -0.2], [52.85, 0.1]],
  // Mierce
  "Hamtun": [[52.25, -0.9], [52.05, -0.7]],
  "Tomtun": [[52.5, -1.8], [52.2, -2.1]],
  "Hereford": [[52.1, -2.75], [52.6, -2.6]],
  "Legaceaster": [[53.1, -2.8], [53.3, -2.0]],
  "Northworthig": [[52.95, -1.6]],
  "Doneceaster": [[53.4, -1.5]],
  "Snotingaham": [[53.05, -1.05], [53.6, -0.95]],
  "Lindcylene": [[53.25, -0.4]],
  "Ligeraceaster": [[52.65, -1.15]],
  // Cymru
  "Gwynedd": [[52.95, -3.95]],
  "Powys": [[52.45, -3.5]],
  "Dyfed": [[51.9, -4.5]],
  "Gwent": [[51.7, -3.2]],
  // Northhymbre
  "Rippel": [[53.8, -2.75]],
  "Mameceaster": [[53.5, -2.2], [53.8, -1.55]],
  "Eoforwic": [[53.85, -0.5], [53.75, -0.9]],
  "Streoneshalh": [[54.3, -1.4]],
  "Bebbanburg": [[55.1, -1.65], [55.55, -1.8]],
  "Hagustaldesham": [[54.85, -2.3]],
  "Din Eidyn": [[55.9, -3.2], [56.0, -3.7]],
  "Loncaster": [[54.5, -3.0], [54.9, -2.95]],
  "Mailros": [[55.45, -2.8], [55.15, -2.8]],
  // Dál Riata
  "Hwiterne": [[54.95, -4.4], [55.0, -3.3]],
  "Alt Clut": [[55.8, -4.3]],
  "Daire": [[55.0, -7.1]],
  "Ard Sratha": [[54.6, -7.3], [54.62, -6.75]],
  "Beannchar": [[54.6, -6.0]],
  "Mön": [[54.23, -4.55]],
  // Alba
  "Sgáin": [[56.45, -3.1], [56.2, -3.1]],
  "Fothuirtabaicht": [[56.3, -4.1], [56.8, -3.8]],
  "Dún Att": [[56.1, -5.3], [56.6, -4.5]],
  "Gleann Comhann": [[56.75, -5.1]],
  "Inbhir Nis": [[57.4, -4.2]],
  "Dún Foithir": [[57.1, -2.4], [57.0, -3.2]],
  "Apor Crosán": [[57.8, -5.2], [58.3, -4.3]],
  "Ljóðhús": [[58.15, -6.5]],
  "Kirkjuvágr": [[58.98, -3.0]],
  // Ériu
  "Ráth Bhoth": [[54.95, -7.9]],
  "Droim Chliabh": [[54.2, -8.5]],
  "Cruachan": [[53.85, -8.2], [53.75, -7.8], [54.3, -7.2], [54.45, -6.72]],
  "Mainistir Bhuithe": [[53.95, -6.6], [54.35, -6.45]],
  "Dyflin": [[53.4, -6.4], [53.55, -7.2]],
  "Achadh Bhó": [[53.0, -7.3], [52.8, -6.25], [52.8, -7.9]],
  "Cill Chainnigh": [[52.6, -7.2], [52.35, -6.6]],
  "Lios Mór": [[52.2, -7.5]],
  "Corcach": [[51.85, -8.6]],
  "Mungairit": [[52.45, -8.4], [52.5, -8.0]],
  "Inis Faithlinn": [[52.05, -9.6]],
  "Inis Cealtra": [[52.85, -9.0], [52.95, -8.3]],
  "Cluain Mhic Nóis": [[53.35, -8.4], [53.3, -9.2]],
  "Maigh Eo": [[53.85, -9.3]],
};

// Lagos de verdade abertos no mapa (centro [lat, lon], raios em graus).
// O Lough Neagh separa quatro territórios que se encontrariam num ponto só.
const LAGOS = [
  { nome: "Lough Neagh", lat: 54.61, lon: -6.42, rLat: 0.14, rLon: 0.13 },
];

// Ilhas sem âncora vão para o território mais próximo — exceto estas regras.
function donoDaIlha(lat, lon) {
  if (lat > 56.7 && lon < -6.1) return "Ljóðhús";        // Hébridas Exteriores
  if (lat > 58.65 && lon > -3.6) return "Kirkjuvágr";     // Órcades
  return null;
}

// ============================================================
// 1. Litoral
// ============================================================
function proj(lon, lat) { return [lon * KX, -lat]; }
const feats = topo.feature(LAND, LAND.objects.land).features;
const aneis = []; // cada polígono: lista de anéis [[lon,lat]...]
for (const f of feats) {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of polys) {
    const ext = p[0];
    const dentro = ext.every(([x, y]) => x > BBOX.lon0 && x < BBOX.lon1 && y > BBOX.lat0 && y < BBOX.lat1);
    if (dentro) aneis.push(p);
  }
}
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
for (const p of aneis) for (const [lon, lat] of p[0]) {
  const [x, y] = proj(lon, lat);
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const MARG = 24;
const ESC = Math.min((W - 2 * MARG) / (maxX - minX), (H - 2 * MARG) / (maxY - minY));
const OX = (W - (maxX - minX) * ESC) / 2 - minX * ESC;
const OY = (H - (maxY - minY) * ESC) / 2 - minY * ESC;
function tela(lon, lat) { const [x, y] = proj(lon, lat); return [x * ESC + OX, y * ESC + OY]; }
function geo(px, py) { return [(px - OX) / ESC / KX, -(py - OY) / ESC]; } // -> [lon, lat]

const poligonos = aneis.map(p => p.map(r => r.map(([lon, lat]) => tela(lon, lat))));

// ============================================================
// 2. Raster da terra (preenchimento par-ímpar no centro do pixel)
// ============================================================
const N = W * H;
const terra = new Uint8Array(N);
for (const poly of poligonos) {
  let y0 = H, y1 = 0;
  for (const r of poly) for (const [, y] of r) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let py = Math.max(0, Math.floor(y0)); py <= Math.min(H - 1, Math.ceil(y1)); py++) {
    const yc = py + 0.5, xs = [];
    for (const r of poly) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xa, ya] = r[i], [xb, yb] = r[j];
      if ((ya > yc) !== (yb > yc)) xs.push(xa + (yc - ya) / (yb - ya) * (xb - xa));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let px = Math.max(0, Math.ceil(xs[k] - 0.5)); px <= Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); px++) terra[py * W + px] = 1;
    }
  }
}
const VIZ4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// componentes (ilhas)
const comp = new Int32Array(N).fill(-1);
const comps = [];
for (let i = 0; i < N; i++) {
  if (!terra[i] || comp[i] >= 0) continue;
  const id = comps.length, pilha = [i], cel = [];
  comp[i] = id;
  while (pilha.length) {
    const c = pilha.pop(); cel.push(c);
    const x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of VIZ4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (terra[n] && comp[n] < 0) { comp[n] = id; pilha.push(n); }
    }
  }
  comps.push(cel);
}

// ============================================================
// 3. Crescimento com restrição de vizinhança
// ============================================================
const VIZ_TERRA = NOMES.map(t => new Set(TERRITORIOS[t].vizinhos
  .filter(v => !ROTAS_MARITIMAS.some(p => (p[0] === t && p[1] === v) || (p[1] === t && p[0] === v)))
  .map(v => IDX[v])));
const podeEncostar = (a, b) => a === b || VIZ_TERRA[a].has(b);

const dono = new Int32Array(N).fill(-1);
const custo = new Float64Array(N).fill(Infinity);
// heap binário simples
const heapC = [], heapV = [];
function push(c, v) {
  heapC.push(c); heapV.push(v);
  let i = heapC.length - 1;
  while (i > 0) { const p = (i - 1) >> 1; if (heapV[p] <= heapV[i]) break;
    [heapC[p], heapC[i]] = [heapC[i], heapC[p]]; [heapV[p], heapV[i]] = [heapV[i], heapV[p]]; i = p; }
}
function pop() {
  const c = heapC[0], v = heapV[0], lc = heapC.pop(), lv = heapV.pop();
  if (heapC.length) { heapC[0] = lc; heapV[0] = lv; let i = 0;
    for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < heapC.length && heapV[l] < heapV[m]) m = l; if (r < heapC.length && heapV[r] < heapV[m]) m = r;
      if (m === i) break; [heapC[m], heapC[i]] = [heapC[i], heapC[m]]; [heapV[m], heapV[i]] = [heapV[i], heapV[m]]; i = m; } }
  return [c, v];
}
const pretendente = new Int32Array(N).fill(-1);
const LAGO = -2;
for (const L of LAGOS) {
  const [cx, cy] = tela(L.lon, L.lat);
  const rx = L.rLon * KX * ESC, ry = L.rLat * ESC;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const c = y * W + x;
    if (terra[c] && ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1) dono[c] = LAGO;
  }
}
function terraMaisProxima(px, py) {
  for (let r = 0; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = Math.round(px) + dx, y = Math.round(py) + dy;
    if (x >= 0 && y >= 0 && x < W && y < H && terra[y * W + x]) return y * W + x;
  }
  throw new Error("âncora longe da terra: " + px + "," + py);
}
const ancorasPx = {};
const compComAncora = new Set();
const compDasAncoras = NOMES.map(() => new Set()); // ilhas "principais" de cada território
NOMES.forEach((t, ti) => {
  if (!ANCORAS[t]) throw new Error("sem âncora: " + t);
  ancorasPx[t] = ANCORAS[t].map(([lat, lon]) => tela(lon, lat));
  for (const [x, y] of ancorasPx[t]) {
    const c = terraMaisProxima(x, y);
    custo[c] = 0; pretendente[c] = ti; push(c, 0); compComAncora.add(comp[c]); compDasAncoras[ti].add(comp[c]);
  }
});
// ilhas sem âncora: inteiras para o dono da regra ou o território mais próximo
comps.forEach((cel, id) => {
  if (compComAncora.has(id)) return;
  let sx = 0, sy = 0; for (const c of cel) { sx += c % W; sy += (c / W) | 0; }
  sx /= cel.length; sy /= cel.length;
  const [lon, lat] = geo(sx, sy);
  let t = donoDaIlha(lat, lon);
  if (!t) { let best = Infinity;
    for (const n of NOMES) for (const [ax, ay] of ancorasPx[n]) { const d = Math.hypot(ax - sx, ay - sy); if (d < best) { best = d; t = n; } } }
  for (const c of cel) dono[c] = IDX[t];
});
// Folga: dois territórios que NÃO são vizinhos no jogo ficam a pelo menos
// FOLGA pixels um do outro — nem na ponta (diagonal) podem se tocar, senão
// parecem vizinhos no desenho.
const FOLGA = 3;
const VIZ8D = [];
for (let dy = -FOLGA; dy <= FOLGA; dy++) for (let dx = -FOLGA; dx <= FOLGA; dx++) if (dx || dy) VIZ8D.push([dx, dy]);
function cabe(c, ti) {
  const x = c % W, y = (c / W) | 0;
  for (const [dx, dy] of VIZ8D) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const n = ny * W + nx;
    if (comp[n] !== comp[c]) continue; // através do mar a água já separa
    const u = dono[n];
    if (u >= 0 && !podeEncostar(ti, u)) return false;
  }
  return true;
}
const VIZ8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
while (heapC.length) {
  const [c, v] = pop();
  if (dono[c] !== -1 || v > custo[c]) continue;
  const ti = pretendente[c];
  if (!cabe(c, ti)) { custo[c] = Infinity; continue; } // outro pode tentar depois
  dono[c] = ti;
  const x = c % W, y = (c / W) | 0;
  for (const [dx, dy, w] of VIZ8) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const n = ny * W + nx;
    if (!terra[n] || dono[n] !== -1) continue;
    if (v + w < custo[n]) { custo[n] = v + w; pretendente[n] = ti; push(n, v + w); }
  }
}
// sobras: tenta encaixar em qualquer vizinho compatível
let mudou = true;
while (mudou) {
  mudou = false;
  for (let c = 0; c < N; c++) {
    if (!terra[c] || dono[c] !== -1) continue;
    const x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of VIZ4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const u = dono[ny * W + nx];
      if (u >= 0 && cabe(c, u)) { dono[c] = u; mudou = true; break; }
    }
  }
}
let lagos = 0;
for (let c = 0; c < N; c++) if (terra[c] && dono[c] < 0) { dono[c] = LAGO; lagos++; }
// Onde quatro territórios se fecham em roda sobra um furinho de 1-2 pixels.
// Ele vira um laguinho visível (raio 4), para as diagonais não parecerem vizinhas.
{
  const visto = new Uint8Array(N);
  for (let c = 0; c < N; c++) {
    if (dono[c] !== LAGO || visto[c]) continue;
    const pilha = [c], cel = []; visto[c] = 1;
    while (pilha.length) {
      const k = pilha.pop(); cel.push(k);
      const x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of VIZ4) { const m = (y + dy) * W + x + dx; if (dono[m] === LAGO && !visto[m]) { visto[m] = 1; pilha.push(m); } }
    }
    if (cel.length > 30) continue; // lago de verdade (Lough Neagh), deixa como está
    let sx = 0, sy = 0; for (const k of cel) { sx += k % W + .5; sy += ((k / W) | 0) + .5; }
    sx /= cel.length; sy /= cel.length;
    const R = 4;
    for (let y = Math.floor(sy - R); y <= Math.ceil(sy + R); y++) for (let x = Math.floor(sx - R); x <= Math.ceil(sx + R); x++) {
      const k = y * W + x;
      if (terra[k] && (x + .5 - sx) ** 2 + (y + .5 - sy) ** 2 <= R * R && dono[k] !== LAGO) { dono[k] = LAGO; lagos++; }
    }
  }
}

// ============================================================
// 4. Conferência: fronteiras desenhadas x vizinhanças do jogo
// ============================================================
const encostam = new Set();
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const a = dono[y * W + x]; if (a < 0) continue;
  if (x + 1 < W) { const b = dono[y * W + x + 1]; if (b >= 0 && b !== a) encostam.add(Math.min(a, b) + "|" + Math.max(a, b)); }
  if (y + 1 < H) { const b = dono[(y + 1) * W + x]; if (b >= 0 && b !== a) encostam.add(Math.min(a, b) + "|" + Math.max(a, b)); }
}
// encontro "na ponta" (diagonal) entre não-vizinhos também conta como sobra
for (let y = 0; y + 1 < H; y++) for (let x = 0; x < W; x++) {
  const a = dono[y * W + x]; if (a < 0) continue;
  for (const dx of [-1, 1]) {
    if (x + dx < 0 || x + dx >= W) continue;
    const b = dono[(y + 1) * W + x + dx];
    if (b >= 0 && b !== a) encostam.add(Math.min(a, b) + "|" + Math.max(a, b));
  }
}
const faltando = [], sobrando = [];
NOMES.forEach((t, a) => VIZ_TERRA[a].forEach(b => { if (a < b && !encostam.has(a + "|" + b)) faltando.push(t + " — " + NOMES[b]); }));
encostam.forEach(k => { const [a, b] = k.split("|").map(Number); if (!VIZ_TERRA[a].has(b)) sobrando.push(NOMES[a] + " — " + NOMES[b]); });
const area = new Array(NOMES.length).fill(0);
for (let c = 0; c < N; c++) if (dono[c] >= 0) area[dono[c]]++;
console.log("escala:", ESC.toFixed(1), "px/grau · pixels de lago:", lagos);
console.log("fronteiras que FALTAM:", faltando.length ? faltando : "nenhuma");
console.log("fronteiras que SOBRAM:", sobrando.length ? sobrando : "nenhuma");
NOMES.forEach((t, i) => { if (area[i] < 900) console.log("  território pequeno:", t, area[i], "px"); });

// ============================================================
// 5. Prévia em PNG (para conferência)
// ============================================================
function png(arquivo, rgb) {
  const linhas = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { linhas[y * (W * 3 + 1)] = 0; rgb.copy(linhas, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (tipo, dados) => { const l = Buffer.alloc(4); l.writeUInt32BE(dados.length);
    const td = Buffer.concat([Buffer.from(tipo), dados]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(arquivo, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(linhas)), chunk("IEND", Buffer.alloc(0))]));
}
if (PREVIA) {
  const rgb = Buffer.alloc(N * 3);
  const cor = NOMES.map((t, i) => { const h = (i * 137.5) % 360; const a = h / 60, f = a - Math.floor(a);
    const s = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][Math.floor(a) % 6];
    return s.map(v => 70 + v * 170); });
  for (let c = 0; c < N; c++) {
    const d = dono[c];
    const v = d === LAGO ? [255, 0, 255] : d >= 0 ? cor[d] : [20, 30, 45];
    rgb[c * 3] = v[0]; rgb[c * 3 + 1] = v[1]; rgb[c * 3 + 2] = v[2];
  }
  for (let y = 0; y + 1 < H; y++) for (let x = 0; x + 1 < W; x++) {
    const c = y * W + x, a = dono[c];
    if (a >= 0 && ((dono[c + 1] >= 0 && dono[c + 1] !== a) || (dono[c + W] >= 0 && dono[c + W] !== a))) rgb.fill(0, c * 3, c * 3 + 3);
  }
  png(path.join(RAIZ, "ferramentas", "previa-mapa.png"), rgb);
}

module.exports = { W, H, N, dono, terra, comp, compDasAncoras, NOMES, IDX, TERRITORIOS, REGIOES, ROTAS_MARITIMAS, poligonos, ancorasPx, LAGO, faltando, sobrando, tela };
if (require.main === module && !faltando.length && !sobrando.length) require("./gerar-desenho.js")(module.exports);
