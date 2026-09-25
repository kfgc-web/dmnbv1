/* ============================================================
   DOMINATION: BRITANNIA — ferramentas/gerar-icones.js
   Gera os ícones do app (PNG) a partir de icones/icone-fonte.webp
   (a arte do escudo, 1254×1254, fundo quase preto).

   Uso (na raiz do repositório):
       npm i playwright        (uma vez; usa o Chromium para redimensionar)
       node ferramentas/gerar-icones.js

   Gera em icones/:
     icone-192.png / icone-512.png       — ícone normal (arte inteira)
     maskable-192.png / maskable-512.png — Android corta em círculo: a arte
                                           entra menor (80%) para nada sumir
     apple-touch-icon.png (180)          — iPhone/iPad
     favicon-32.png                      — aba do navegador
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PASTA = path.join(__dirname, "..", "icones");
const FONTE = path.join(PASTA, "icone-fonte.webp");
const FUNDO = "#07090d"; // mesma cor do fundo da arte
const SAIDAS = [
  ["icone-192.png", 192, 1], ["icone-512.png", 512, 1],
  ["maskable-192.png", 192, 0.8], ["maskable-512.png", 512, 0.8],
  ["apple-touch-icon.png", 180, 0.94], ["favicon-32.png", 32, 1],
];

(async function () {
  const exe = ["/opt/pw-browsers/chromium"].find(function (c) { return fs.existsSync(c); });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const p = await browser.newPage();
  const src = "data:image/webp;base64," + fs.readFileSync(FONTE).toString("base64");
  for (const [nome, tam, escala] of SAIDAS) {
    const b64 = await p.evaluate(async function (a) {
      const img = new Image(); img.src = a.src; await img.decode();
      const c = document.createElement("canvas"); c.width = c.height = a.tam;
      const x = c.getContext("2d");
      x.fillStyle = a.fundo; x.fillRect(0, 0, a.tam, a.tam);
      x.imageSmoothingQuality = "high";
      const lado = a.tam * a.escala, m = (a.tam - lado) / 2;
      x.drawImage(img, m, m, lado, lado);
      return c.toDataURL("image/png").split(",")[1];
    }, { src: src, tam: tam, escala: escala, fundo: FUNDO });
    fs.writeFileSync(path.join(PASTA, nome), Buffer.from(b64, "base64"));
    console.log("gravado icones/" + nome);
  }
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
