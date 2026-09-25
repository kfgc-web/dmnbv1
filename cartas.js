/* ============================================================
   DOMINATION: BRITANNIA — cartas.js (o desenho das cartas)
   Só VISUAL: monta o SVG de uma carta (pergaminho, borda trançada,
   faixa com o nome, silhueta do território e o medalhão do símbolo).
   As REGRAS das cartas ficam no motor.js.
   Carregar DEPOIS de mapa.js + desenho.js e ANTES de telas.js.
   ============================================================ */

// Cor da silhueta na carta (um tom mais vivo que o do tabuleiro).
const COR_CARTA_REGIAO = {
  "Ériu": "#3f7a35", "Dál Riata": "#2a7a72", "Alba": "#58509a", "Northhymbre": "#2f6aa0",
  "Mierce": "#9a4a2c", "East Engle": "#9c8a24", "Westseaxe": "#b0741e", "Cymru": "#a0344f",
};
const NOME_SIMBOLO = { espada: "Espada", escudo: "Escudo", navio: "Navio", coringa: "Coringa" };

// Coloca no documento, uma vez só, as texturas e os símbolos usados pelas cartas.
function instalarDefsCartas() {
  if (document.getElementById("ct-defs")) return;
  const box = document.createElement("div");
  box.innerHTML =
    '<svg id="ct-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      '<filter id="ct-papel" x="0" y="0" width="100%" height="100%">' +
        '<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="4" result="n"/>' +
        '<feColorMatrix in="n" type="matrix" values="0 0 0 0 .45  0 0 0 0 .33  0 0 0 0 .15  0 0 0 .22 0" result="m"/>' +
        '<feComposite in="m" in2="SourceGraphic" operator="in" result="grao"/>' +
        '<feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="2" seed="9" result="n2"/>' +
        '<feColorMatrix in="n2" type="matrix" values="0 0 0 0 .5  0 0 0 0 .35  0 0 0 0 .12  0 0 0 .5 -.1" result="manchas"/>' +
        '<feComposite in="manchas" in2="SourceGraphic" operator="in" result="manchas2"/>' +
        '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="manchas2"/><feMergeNode in="grao"/></feMerge>' +
      '</filter>' +
      '<radialGradient id="ct-fundo" cx="50%" cy="45%" r="75%">' +
        '<stop offset="0" stop-color="#f3e6bf"/><stop offset=".7" stop-color="#e2cc92"/><stop offset="1" stop-color="#b8924f"/>' +
      '</radialGradient>' +
      '<pattern id="ct-tranca" width="14" height="10" patternUnits="userSpaceOnUse">' +
        '<rect width="14" height="10" fill="#6b4a1c"/>' +
        '<path d="M-2 8 C3 8 4 2 7 2 C10 2 11 8 16 8" fill="none" stroke="#3a2608" stroke-width="3.6"/>' +
        '<path d="M-2 8 C3 8 4 2 7 2 C10 2 11 8 16 8" fill="none" stroke="#d9b45e" stroke-width="2"/>' +
        '<path d="M-2 2 C3 2 4 8 7 8 C10 8 11 2 16 2" fill="none" stroke="#3a2608" stroke-width="3.6"/>' +
        '<path d="M-2 2 C3 2 4 8 7 8 C10 8 11 2 16 2" fill="none" stroke="#e8c86e" stroke-width="2"/>' +
      '</pattern>' +
      '<pattern id="ct-trancaV" width="10" height="14" patternUnits="userSpaceOnUse">' +
        '<rect width="10" height="14" fill="#6b4a1c"/>' +
        '<path d="M8 -2 C8 3 2 4 2 7 C2 10 8 11 8 16" fill="none" stroke="#3a2608" stroke-width="3.6"/>' +
        '<path d="M8 -2 C8 3 2 4 2 7 C2 10 8 11 8 16" fill="none" stroke="#d9b45e" stroke-width="2"/>' +
        '<path d="M2 -2 C2 3 8 4 8 7 C8 10 2 11 2 16" fill="none" stroke="#3a2608" stroke-width="3.6"/>' +
        '<path d="M2 -2 C2 3 8 4 8 7 C8 10 2 11 2 16" fill="none" stroke="#e8c86e" stroke-width="2"/>' +
      '</pattern>' +
      '<filter id="ct-tinta" x="-10%" y="-10%" width="120%" height="120%">' +
        '<feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="2" seed="2" result="t"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="t" scale="3" result="d"/>' +
        '<feGaussianBlur in="d" stdDeviation="2.5" result="b"/>' +
        '<feFlood flood-color="#3a2608" flood-opacity=".55"/><feComposite in2="b" operator="in" result="sombra"/>' +
        '<feMerge><feMergeNode in="sombra"/><feMergeNode in="d"/></feMerge>' +
      '</filter>' +
      // símbolos minimalistas (silhueta preta, desenhados num quadro 64x64)
      '<g id="ct-espada" fill="#16110a">' +
        '<path d="M32 5 L36 12 L35.5 41 L28.5 41 L28 12 Z"/><rect x="19" y="41" width="26" height="5" rx="2.5"/>' +
        '<rect x="29.5" y="46" width="5" height="10"/><circle cx="32" cy="59" r="4"/>' +
      '</g>' +
      '<g id="ct-escudo">' +
        '<circle cx="32" cy="32" r="24" fill="#16110a"/>' +
        '<circle cx="32" cy="32" r="19.5" fill="none" stroke="#e9dcb4" stroke-width="1.6"/>' +
        '<path d="M32 12.5 V25 M32 39 V51.5 M12.5 32 H25 M39 32 H51.5" stroke="#e9dcb4" stroke-width="1.6"/>' +
        '<circle cx="32" cy="32" r="6.5" fill="#e9dcb4"/><circle cx="32" cy="32" r="3.5" fill="#16110a"/>' +
      '</g>' +
      '<g id="ct-navio" fill="#16110a">' +
        '<rect x="30.5" y="8" width="3" height="32"/><path d="M19 12 H45 L43 33 H21 Z"/>' +
        '<path d="M5 34 C5 30 8 28 10 30 L13 33 L13 38 H51 L51 33 L54 30 C56 28 59 30 59 34 C59 40 55 48 44 49 H20 C9 48 5 40 5 34 Z"/>' +
        '<path d="M59 34 C61 27 60 22 56 20 C58 24 57 27 55 29 Z"/><path d="M5 34 C3 27 4 22 8 20 C6 24 7 27 9 29 Z"/>' +
      '</g>' +
      '<g id="ct-medalhao">' +
        '<circle r="31" fill="url(#ct-tranca)" stroke="#3a2608" stroke-width="1.5"/>' +
        '<circle r="23.5" fill="#f0e3bc" stroke="#3a2608" stroke-width="1.5"/>' +
      '</g>' +
    '</defs></svg>';
  document.body.appendChild(box.firstChild);
}

// Caixa (x, y, largura, altura) de um caminho "M x yL x y...Z" do desenho.js.
const _caixaTerr = {};
function caixaDoTerritorio(t) {
  if (_caixaTerr[t]) return _caixaTerr[t];
  const nums = DESENHO.territorios[t].d.match(/-?\d+(\.\d+)?/g).map(Number);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]);
    y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]);
  }
  return (_caixaTerr[t] = [x0, y0, x1 - x0, y1 - y0]);
}

// Ícone do símbolo sozinho (para listas pequenas), em SVG.
function iconeSimbolo(s, tam) {
  if (s === "coringa") {
    return '<svg class="ct-icone" viewBox="0 0 64 64" width="' + tam + '" height="' + tam + '">' +
      '<g transform="translate(0 2) scale(.5)"><use href="#ct-espada"/></g>' +
      '<g transform="translate(32 2) scale(.5)"><use href="#ct-escudo"/></g>' +
      '<g transform="translate(16 32) scale(.5)"><use href="#ct-navio"/></g></svg>';
  }
  return '<svg class="ct-icone" viewBox="0 0 64 64" width="' + tam + '" height="' + tam + '"><use href="#ct-' + s + '"/></svg>';
}

// A carta inteira em SVG. carta = { t: território ou null, s: símbolo }.
function desenharCarta(carta) {
  const moldura =
    '<rect x="3" y="3" width="244" height="394" rx="16" fill="url(#ct-fundo)" filter="url(#ct-papel)" stroke="#8a6a36" stroke-width="2"/>' +
    '<rect x="16" y="16" width="218" height="10" fill="url(#ct-tranca)"/>' +
    '<rect x="16" y="354" width="218" height="10" fill="url(#ct-tranca)"/>' +
    '<rect x="16" y="26" width="10" height="328" fill="url(#ct-trancaV)"/>' +
    '<rect x="224" y="26" width="10" height="328" fill="url(#ct-trancaV)"/>' +
    '<rect x="16" y="16" width="218" height="348" fill="none" stroke="#3a2608" stroke-width="1.2"/>' +
    '<rect x="26" y="26" width="198" height="328" fill="none" stroke="#3a2608" stroke-width="1"/>';
  let miolo;
  if (carta.s === "coringa") {
    const med = function (x, y, s) {
      return '<g transform="translate(' + x + ' ' + y + ')"><use href="#ct-medalhao" transform="scale(1.25)"/>' +
        '<g transform="translate(-24 -24) scale(.75)"><use href="#ct-' + s + '"/></g></g>';
    };
    miolo =
      '<text x="125" y="60" text-anchor="middle" font-family="Cinzel,Georgia,serif" font-size="15" font-weight="700" letter-spacing="2" fill="#1f160a">DOMINATION</text>' +
      '<text x="125" y="76" text-anchor="middle" font-family="Cinzel,Georgia,serif" font-size="11" letter-spacing="4" fill="#3a2a14">BRITANNIA</text>' +
      med(160, 125, "espada") + med(90, 205, "navio") + med(160, 285, "escudo");
  } else {
    const t = carta.t, reg = TERRITORIOS[t].regiao, cx = caixaDoTerritorio(t), m = 8;
    miolo =
      '<path d="M40 44 Q125 36 214 44 L214 92 Q125 84 40 92 Z" fill="#f6ecd0" stroke="#8a6a36" stroke-width="1.2"/>' +
      '<path d="M40 44 C28 44 28 64 40 64 C48 64 48 54 40 54" fill="#e6d3a2" stroke="#8a6a36" stroke-width="1.2"/>' +
      '<path d="M214 72 C226 72 226 92 214 92 C206 92 206 82 214 82" fill="#e6d3a2" stroke="#8a6a36" stroke-width="1.2"/>' +
      '<text x="127" y="67" text-anchor="middle" font-family="Georgia,serif" font-size="' + (t.length > 15 ? 14 : t.length > 12 ? 17 : 21) +
        '" font-weight="700" fill="#1f160a">' + t + '</text>' +
      '<line x1="72" y1="74" x2="182" y2="74" stroke="#8a6a36" stroke-width="1"/>' +
      '<text x="127" y="86" text-anchor="middle" font-family="Georgia,serif" font-size="10.5" letter-spacing="1" fill="#3a2a14">' + reg + '</text>' +
      '<svg x="40" y="104" width="170" height="200" viewBox="' + (cx[0] - m) + ' ' + (cx[1] - m) + ' ' + (cx[2] + 2 * m) + ' ' + (cx[3] + 2 * m) + '">' +
        '<path d="' + DESENHO.territorios[t].d + '" fill="' + COR_CARTA_REGIAO[reg] + '" filter="url(#ct-tinta)"/></svg>' +
      '<g transform="translate(125 330)"><use href="#ct-medalhao"/><g transform="translate(-19 -19) scale(.6)"><use href="#ct-' + carta.s + '"/></g></g>';
  }
  return '<svg class="carta" viewBox="0 0 250 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
    (carta.t ? carta.t + ", " + NOME_SIMBOLO[carta.s] : "Coringa") + '">' + moldura + miolo + '</svg>';
}
