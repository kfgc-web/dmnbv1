/* ============================================================
   DOMINATION: BRITANNIA — ferramentas/gerar-desenho.js
   Segunda metade do gerador (chamada por gerar-mapa.js): converte o
   mapa em pixels em contornos vetoriais suaves e grava ../desenho.js.
   Cada trecho de divisa é simplificado UMA vez e usado pelos dois
   territórios que ele separa — assim não sobra fresta entre eles.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

// Onde fica o nome de cada região (no mar, perto dela) — [x, y] na tela.
const ROTULOS_REGIAO = {
  "Westseaxe": [739, 1257],
  "East Engle": [1128, 900],
  "Mierce": [1032, 790],
  "Cymru": [482, 1084],
  "Northhymbre": [905, 535],
  "Dál Riata": [527, 752],
  "Alba": [900, 285],
  "Ériu": [250, 1100],
};

module.exports = function (M) {
  const { W, H, dono, terra, comp, compDasAncoras, NOMES, TERRITORIOS, REGIOES, ROTAS_MARITIMAS, poligonos, LAGO } = M;
  const MAR = -1;

  // ---- 1. cada território avança um pouco pelo mar (fica escondido pelo
  //         recorte do litoral; só serve p/ não sobrar fresta na costa) ----
  const rot = Int32Array.from(dono);
  let fila = [];
  for (let c = 0; c < W * H; c++) if (rot[c] >= 0) fila.push(c);
  for (let passo = 0; passo < 5; passo++) {
    const prox = [];
    for (const c of fila) {
      const x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (rot[n] === MAR) { rot[n] = rot[c]; prox.push(n); }
      }
    }
    fila = prox;
  }
  const L = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? MAR : rot[y * W + x];

  // ---- 2. vértices de junção (3+ rótulos, ou xadrez) ----
  const VW = W + 1;
  function juncao(vx, vy) {
    const a = L(vx - 1, vy - 1), b = L(vx, vy - 1), c = L(vx - 1, vy), d = L(vx, vy);
    const s = new Set([a, b, c, d]);
    if (s.size >= 3) return true;
    if (s.size === 2 && a === d && b === c && a !== b) return true;
    return false;
  }

  // ---- 3. laços de contorno de cada território ----
  function lacos(t) {
    const saida = new Map(); // vértice -> lista de [destino, outroLado]
    const add = (x0, y0, x1, y1, outro) => {
      const k = y0 * VW + x0;
      if (!saida.has(k)) saida.set(k, []);
      saida.get(k).push([y1 * VW + x1, outro]);
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (rot[y * W + x] !== t) continue;
      let o;
      if ((o = L(x, y - 1)) !== t) add(x, y, x + 1, y, o);
      if ((o = L(x + 1, y)) !== t) add(x + 1, y, x + 1, y + 1, o);
      if ((o = L(x, y + 1)) !== t) add(x + 1, y + 1, x, y + 1, o);
      if ((o = L(x - 1, y)) !== t) add(x, y + 1, x, y, o);
    }
    const res = [];
    for (const [ini] of saida) {
      while (saida.has(ini) && saida.get(ini).length) {
        const laco = [], lados = [];
        let v = ini, prev = -1;
        for (;;) {
          const opcoes = saida.get(v);
          if (!opcoes || !opcoes.length) break;
          let i = 0;
          if (opcoes.length > 1 && prev >= 0) {
            // em vértice xadrez, vira à direita (mantém laços separados)
            const dx0 = (v % VW) - (prev % VW), dy0 = ((v / VW) | 0) - ((prev / VW) | 0);
            i = opcoes.findIndex(([d]) => {
              const dx1 = (d % VW) - (v % VW), dy1 = ((d / VW) | 0) - ((v / VW) | 0);
              return dx0 * dy1 - dy0 * dx1 > 0;
            });
            if (i < 0) i = 0;
          }
          const [dest, outro] = opcoes.splice(i, 1)[0];
          laco.push(v); lados.push(outro);
          prev = v; v = dest;
          if (v === ini) break;
        }
        if (laco.length > 2) res.push({ laco, lados });
      }
    }
    return res;
  }

  // ---- 4. simplificação (Douglas-Peucker) + suavização (Chaikin) ----
  const pt = k => [k % VW, (k / VW) | 0];
  function dp(p, tol) {
    if (p.length < 3) return p;
    const manter = new Uint8Array(p.length); manter[0] = manter[p.length - 1] = 1;
    const pilha = [[0, p.length - 1]];
    while (pilha.length) {
      const [i, j] = pilha.pop();
      const [ax, ay] = p[i], [bx, by] = p[j];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      let md = -1, mi = -1;
      for (let k = i + 1; k < j; k++) {
        const d = len === 1 && ax === bx && ay === by ? Math.hypot(p[k][0] - ax, p[k][1] - ay)
          : Math.abs((bx - ax) * (ay - p[k][1]) - (ax - p[k][0]) * (by - ay)) / len;
        if (d > md) { md = d; mi = k; }
      }
      if (md > tol) { manter[mi] = 1; pilha.push([i, mi], [mi, j]); }
    }
    return p.filter((_, i) => manter[i]);
  }
  function chaikin(p, vezes) {
    for (let v = 0; v < vezes; v++) {
      const q = [p[0]];
      for (let i = 0; i + 1 < p.length; i++) {
        const [ax, ay] = p[i], [bx, by] = p[i + 1];
        q.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
      }
      q.push(p[p.length - 1]);
      p = q;
    }
    return p;
  }

  // trechos compartilhados (cache pela forma canônica)
  const cache = new Map();
  const trechos = []; // {pts, a, b} únicos, p/ desenhar divisas
  function trecho(seq, a, b) {
    let inv = seq[0] > seq[seq.length - 1] || (seq[0] === seq[seq.length - 1] && seq[1] > seq[seq.length - 2]);
    const can = inv ? seq.slice().reverse() : seq;
    const chave = can[0] + "," + can[1] + "," + can[can.length - 1] + "," + can.length;
    let pts = cache.get(chave);
    if (!pts) {
      const costa = a < 0 || b < 0;
      pts = chaikin(dp(can.map(pt), costa ? 1.6 : 1.0), 2);
      cache.set(chave, pts);
      trechos.push({ pts, a, b });
    }
    return inv ? pts.slice().reverse() : pts;
  }
  const f1 = v => Math.round(v * 10) / 10;
  const caminho = pts => "M" + pts.map(p => f1(p[0]) + " " + f1(p[1])).join("L");

  const territorios = {};
  NOMES.forEach((nome, t) => {
    let d = "";
    for (const { laco, lados } of lacos(t)) {
      const n = laco.length;
      const js = [];
      for (let i = 0; i < n; i++) {
        const [x, y] = pt(laco[i]);
        if (juncao(x, y) || lados[i] !== lados[(i - 1 + n) % n]) js.push(i);
      }
      let pts = [];
      if (!js.length) {
        // laço sem junção (ilha inteira / lago): fecha sozinho
        const p = laco.concat([laco[0]]);
        pts = trecho(p, t, lados[0]);
      } else {
        for (let k = 0; k < js.length; k++) {
          const i0 = js[k], i1 = js[(k + 1) % js.length];
          const seq = [];
          for (let i = i0; ; i = (i + 1) % n) { seq.push(laco[i]); if (i === i1 && seq.length > 1) break; }
          const p = trecho(seq, t, lados[i0]);
          pts = pts.concat(k ? p.slice(1) : p);
        }
      }
      d += caminho(pts) + "Z";
    }
    territorios[nome] = { d };
  });

  // divisas: dentro da mesma região (finas) e entre regiões (grossas)
  const regiao = t => TERRITORIOS[NOMES[t]].regiao;
  let fronteiras = "", divisas = "", lagos = "";
  for (const { pts, a, b } of trechos) {
    if (a >= 0 && b >= 0) { if (regiao(a) === regiao(b)) fronteiras += caminho(pts); else divisas += caminho(pts); }
    else if (a === LAGO || b === LAGO) lagos += caminho(pts);
  }

  // ---- 5. litoral vetorial (recorte e contorno da costa) ----
  const areaAnel = r => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(s / 2); };
  let terraD = "";
  for (const poly of poligonos) {
    if (areaAnel(poly[0]) < 3) continue;
    for (const r of poly) { const s = dp(r, 0.35); if (s.length >= 3) terraD += caminho(s) + "Z"; }
  }

  // ---- 6. onde vai a peça de cada território (ponto mais "dentro") ----
  const dist = new Float32Array(W * H);
  const INF = 1e9;
  for (let c = 0; c < W * H; c++) dist[c] = dono[c] >= 0 ? INF : 0;
  const same = (c, n) => dono[n] === dono[c];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = y * W + x; if (!dist[c]) continue;
    let m = dist[c];
    if (x > 0) m = Math.min(m, same(c, c - 1) ? dist[c - 1] + 1 : 1);
    if (y > 0) m = Math.min(m, same(c, c - W) ? dist[c - W] + 1 : 1);
    if (x > 0 && y > 0) m = Math.min(m, same(c, c - W - 1) ? dist[c - W - 1] + 1.414 : 1);
    if (x + 1 < W && y > 0) m = Math.min(m, same(c, c - W + 1) ? dist[c - W + 1] + 1.414 : 1);
    if (x === 0 || y === 0) m = Math.min(m, 1);
    dist[c] = m;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const c = y * W + x; if (!dist[c]) continue;
    let m = dist[c];
    if (x + 1 < W) m = Math.min(m, same(c, c + 1) ? dist[c + 1] + 1 : 1);
    if (y + 1 < H) m = Math.min(m, same(c, c + W) ? dist[c + W] + 1 : 1);
    if (x + 1 < W && y + 1 < H) m = Math.min(m, same(c, c + W + 1) ? dist[c + W + 1] + 1.414 : 1);
    if (x > 0 && y + 1 < H) m = Math.min(m, same(c, c + W - 1) ? dist[c + W - 1] + 1.414 : 1);
    dist[c] = m;
  }
  // centro da peça: o ponto mais fundo (a peça + o nome embaixo precisam caber)
  const melhor = NOMES.map(() => [-1, 0, 0]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = y * W + x, t = dono[c]; if (t < 0) continue;
    // o nome fica embaixo da peça: favorece pontos com espaço abaixo
    const abaixo = y + 14 < H ? (dono[c + 14 * W] === t ? dist[c + 14 * W] : 0) : 0;
    const s = Math.min(dist[c], abaixo + 6);
    if (s > melhor[t][0]) melhor[t] = [s, x + 0.5, y + 0.5];
  }
  NOMES.forEach((nome, t) => { territorios[nome].x = f1(melhor[t][1]); territorios[nome].y = f1(melhor[t][2]); });

  // ---- 7. rotas marítimas: linha entre os pontos de costa mais próximos ----
  //         (só a terra "principal" de cada lado — não ilhotas anexadas)
  function costeiros(t) {
    const out = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const c = y * W + x;
      if (dono[c] === t && compDasAncoras[t].has(comp[c]) && (!terra[c - 1] || !terra[c + 1] || !terra[c - W] || !terra[c + W])) out.push([x + 0.5, y + 0.5]);
    }
    return out;
  }
  const rotas = ROTAS_MARITIMAS.map(([a, b]) => {
    const ca = costeiros(NOMES.indexOf(a)), cb = costeiros(NOMES.indexOf(b));
    let best = [Infinity];
    for (const p of ca) for (const q of cb) { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < best[0]) best = [d, p, q]; }
    const [, p, q] = best;
    return [a, b, f1(p[0]), f1(p[1]), f1(q[0]), f1(q[1])];
  });

  // ---- 8. grava desenho.js ----
  const saida = {
    largura: W, altura: H,
    terra: terraD,
    territorios,
    fronteiras, divisas, lagos,
    rotas,
    rotulosRegiao: ROTULOS_REGIAO,
  };
  const js = "/* ============================================================\n" +
    "   DOMINATION: BRITANNIA — desenho.js (o mapa desenhado)\n" +
    "   GERADO AUTOMATICAMENTE por ferramentas/gerar-mapa.js — não editar à mão.\n" +
    "   Litoral: Natural Earth 1:10m (domínio público).\n" +
    "   Carregar DEPOIS de mapa.js e ANTES de telas.js.\n" +
    "   ============================================================ */\n" +
    "const DESENHO = " + JSON.stringify(saida) + ";\n";
  fs.writeFileSync(path.join(__dirname, "..", "desenho.js"), js);
  console.log("desenho.js gravado:", (js.length / 1024).toFixed(0), "KB");
};
