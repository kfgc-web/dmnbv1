// ============================================================
//  WAR BRITÂNICO — mapa.js
//  Dados do mapa: 64 territórios em 8 regiões.
//  Gerado a partir do mapa-fonte (.md) e verificado:
//  todas as adjacências são recíprocas (batem dos dois lados).
//  Este arquivo é só DADOS — as regras ficam em motor.js.
// ============================================================

// Cada território: a região a que pertence, se toca o mar (litoral)
// e a lista de vizinhos (terra e mar já juntos — para o jogo, atacar
// por terra ou por uma rota marítima é a mesma coisa).
const TERRITORIOS = {
  "Cornwealas": { regiao: "Westseaxe", litoral: true, vizinhos: ["Defnas"] },
  "Defnas": { regiao: "Westseaxe", litoral: true, vizinhos: ["Cornwealas", "Sumorsaete"] },
  "Sumorsaete": { regiao: "Westseaxe", litoral: true, vizinhos: ["Defnas", "Wintanceaster", "Gleawanceaster", "Tomtun", "Hereford"] },
  "Gleawanceaster": { regiao: "Westseaxe", litoral: false, vizinhos: ["Tomtun", "Wintanceaster", "Lundenburg", "Sumorsaete"] },
  "Wintanceaster": { regiao: "Westseaxe", litoral: true, vizinhos: ["Sumorsaete", "Gleawanceaster", "Suthseaxe"] },
  "Suthseaxe": { regiao: "Westseaxe", litoral: true, vizinhos: ["Wintanceaster", "Lundenburg", "Cent"] },
  "Cent": { regiao: "Westseaxe", litoral: true, vizinhos: ["Eastseaxe", "Lundenburg", "Suthseaxe"] },
  "Eastseaxe": { regiao: "Westseaxe", litoral: true, vizinhos: ["Cent", "Lundenburg", "Grantebrycge", "Suthfolc"] },
  "Lundenburg": { regiao: "Westseaxe", litoral: false, vizinhos: ["Cent", "Eastseaxe", "Suthseaxe", "Gleawanceaster", "Hamtun"] },
  "Northfolc": { regiao: "East Engle", litoral: true, vizinhos: ["Suthfolc", "Grantebrycge", "Medeshamstede"] },
  "Suthfolc": { regiao: "East Engle", litoral: true, vizinhos: ["Eastseaxe", "Grantebrycge", "Northfolc"] },
  "Grantebrycge": { regiao: "East Engle", litoral: false, vizinhos: ["Eastseaxe", "Suthfolc", "Northfolc", "Medeshamstede", "Hamtun"] },
  "Medeshamstede": { regiao: "East Engle", litoral: true, vizinhos: ["Lindcylene", "Ligeraceaster", "Grantebrycge", "Hamtun", "Snotingaham", "Northfolc"] },
  "Hamtun": { regiao: "Mierce", litoral: false, vizinhos: ["Lundenburg", "Grantebrycge", "Medeshamstede", "Ligeraceaster", "Tomtun"] },
  "Tomtun": { regiao: "Mierce", litoral: false, vizinhos: ["Hamtun", "Sumorsaete", "Gleawanceaster", "Hereford", "Northworthig", "Ligeraceaster"] },
  "Hereford": { regiao: "Mierce", litoral: false, vizinhos: ["Sumorsaete", "Gwent", "Powys", "Northworthig", "Legaceaster", "Tomtun"] },
  "Legaceaster": { regiao: "Mierce", litoral: false, vizinhos: ["Hereford", "Gwynedd", "Northworthig", "Doneceaster", "Rippel", "Mameceaster"] },
  "Northworthig": { regiao: "Mierce", litoral: false, vizinhos: ["Tomtun", "Ligeraceaster", "Hereford", "Legaceaster", "Doneceaster", "Snotingaham"] },
  "Doneceaster": { regiao: "Mierce", litoral: false, vizinhos: ["Mameceaster", "Snotingaham", "Northworthig", "Legaceaster"] },
  "Snotingaham": { regiao: "Mierce", litoral: false, vizinhos: ["Mameceaster", "Eoforwic", "Lindcylene", "Medeshamstede", "Ligeraceaster", "Doneceaster", "Northworthig"] },
  "Lindcylene": { regiao: "Mierce", litoral: true, vizinhos: ["Eoforwic", "Medeshamstede", "Snotingaham"] },
  "Ligeraceaster": { regiao: "Mierce", litoral: false, vizinhos: ["Medeshamstede", "Hamtun", "Tomtun", "Northworthig", "Snotingaham"] },
  "Gwynedd": { regiao: "Cymru", litoral: true, vizinhos: ["Powys", "Legaceaster", "Dyflin"] },
  "Powys": { regiao: "Cymru", litoral: true, vizinhos: ["Gwynedd", "Dyfed", "Gwent", "Hereford"] },
  "Dyfed": { regiao: "Cymru", litoral: true, vizinhos: ["Powys", "Gwent"] },
  "Gwent": { regiao: "Cymru", litoral: true, vizinhos: ["Hereford", "Powys", "Dyfed"] },
  "Rippel": { regiao: "Northhymbre", litoral: true, vizinhos: ["Legaceaster", "Mameceaster", "Streoneshalh"] },
  "Mameceaster": { regiao: "Northhymbre", litoral: false, vizinhos: ["Doneceaster", "Legaceaster", "Snotingaham", "Rippel", "Streoneshalh", "Eoforwic"] },
  "Eoforwic": { regiao: "Northhymbre", litoral: true, vizinhos: ["Lindcylene", "Snotingaham", "Mameceaster", "Streoneshalh"] },
  "Streoneshalh": { regiao: "Northhymbre", litoral: true, vizinhos: ["Bebbanburg", "Rippel", "Loncaster", "Mameceaster", "Eoforwic", "Hagustaldesham"] },
  "Bebbanburg": { regiao: "Northhymbre", litoral: true, vizinhos: ["Din Eidyn", "Streoneshalh", "Hagustaldesham", "Mailros"] },
  "Hagustaldesham": { regiao: "Northhymbre", litoral: false, vizinhos: ["Bebbanburg", "Streoneshalh", "Loncaster", "Mailros"] },
  "Din Eidyn": { regiao: "Northhymbre", litoral: true, vizinhos: ["Bebbanburg", "Mailros", "Alt Clut", "Sgáin", "Fothuirtabaicht"] },
  "Loncaster": { regiao: "Northhymbre", litoral: false, vizinhos: ["Streoneshalh", "Hagustaldesham", "Mailros", "Hwiterne"] },
  "Mailros": { regiao: "Northhymbre", litoral: false, vizinhos: ["Bebbanburg", "Hagustaldesham", "Din Eidyn", "Loncaster", "Hwiterne", "Alt Clut"] },
  "Hwiterne": { regiao: "Dál Riata", litoral: true, vizinhos: ["Alt Clut", "Loncaster", "Mailros", "Beannchar"] },
  "Alt Clut": { regiao: "Dál Riata", litoral: true, vizinhos: ["Hwiterne", "Mailros", "Din Eidyn", "Fothuirtabaicht", "Dún Att"] },
  "Daire": { regiao: "Dál Riata", litoral: true, vizinhos: ["Beannchar", "Ard Sratha", "Ráth Bhoth"] },
  "Ard Sratha": { regiao: "Dál Riata", litoral: false, vizinhos: ["Daire", "Ráth Bhoth", "Droim Chliabh", "Cruachan", "Beannchar"] },
  "Beannchar": { regiao: "Dál Riata", litoral: true, vizinhos: ["Daire", "Ard Sratha", "Mainistir Bhuithe", "Hwiterne", "Mön"] },
  "Mön": { regiao: "Dál Riata", litoral: true, vizinhos: ["Beannchar"] },
  "Sgáin": { regiao: "Alba", litoral: true, vizinhos: ["Din Eidyn", "Fothuirtabaicht", "Dún Foithir"] },
  "Fothuirtabaicht": { regiao: "Alba", litoral: false, vizinhos: ["Din Eidyn", "Sgáin", "Dún Att", "Alt Clut", "Dún Foithir", "Inbhir Nis"] },
  "Dún Att": { regiao: "Alba", litoral: true, vizinhos: ["Alt Clut", "Fothuirtabaicht", "Inbhir Nis", "Gleann Comhann"] },
  "Gleann Comhann": { regiao: "Alba", litoral: true, vizinhos: ["Dún Att", "Inbhir Nis", "Apor Crosán"] },
  "Inbhir Nis": { regiao: "Alba", litoral: true, vizinhos: ["Dún Foithir", "Fothuirtabaicht", "Dún Att", "Gleann Comhann", "Apor Crosán"] },
  "Dún Foithir": { regiao: "Alba", litoral: true, vizinhos: ["Sgáin", "Fothuirtabaicht", "Inbhir Nis"] },
  "Apor Crosán": { regiao: "Alba", litoral: true, vizinhos: ["Inbhir Nis", "Gleann Comhann", "Ljóðhús", "Kirkjuvágr"] },
  "Ljóðhús": { regiao: "Alba", litoral: true, vizinhos: ["Apor Crosán"] },
  "Kirkjuvágr": { regiao: "Alba", litoral: true, vizinhos: ["Apor Crosán"] },
  "Ráth Bhoth": { regiao: "Ériu", litoral: true, vizinhos: ["Droim Chliabh", "Daire", "Ard Sratha"] },
  "Droim Chliabh": { regiao: "Ériu", litoral: true, vizinhos: ["Ráth Bhoth", "Ard Sratha", "Cruachan", "Maigh Eo"] },
  "Cruachan": { regiao: "Ériu", litoral: false, vizinhos: ["Ard Sratha", "Mainistir Bhuithe", "Dyflin", "Cluain Mhic Nóis", "Maigh Eo", "Droim Chliabh"] },
  "Mainistir Bhuithe": { regiao: "Ériu", litoral: true, vizinhos: ["Dyflin", "Cruachan", "Beannchar"] },
  "Dyflin": { regiao: "Ériu", litoral: true, vizinhos: ["Achadh Bhó", "Cluain Mhic Nóis", "Cruachan", "Mainistir Bhuithe", "Gwynedd"] },
  "Achadh Bhó": { regiao: "Ériu", litoral: true, vizinhos: ["Cill Chainnigh", "Mungairit", "Inis Cealtra", "Cluain Mhic Nóis", "Dyflin"] },
  "Cill Chainnigh": { regiao: "Ériu", litoral: true, vizinhos: ["Lios Mór", "Mungairit", "Achadh Bhó"] },
  "Lios Mór": { regiao: "Ériu", litoral: true, vizinhos: ["Corcach", "Mungairit", "Cill Chainnigh"] },
  "Corcach": { regiao: "Ériu", litoral: true, vizinhos: ["Lios Mór", "Mungairit", "Inis Faithlinn"] },
  "Mungairit": { regiao: "Ériu", litoral: false, vizinhos: ["Lios Mór", "Corcach", "Inis Faithlinn", "Inis Cealtra", "Achadh Bhó", "Cill Chainnigh"] },
  "Inis Faithlinn": { regiao: "Ériu", litoral: true, vizinhos: ["Inis Cealtra", "Mungairit", "Corcach"] },
  "Inis Cealtra": { regiao: "Ériu", litoral: true, vizinhos: ["Cluain Mhic Nóis", "Achadh Bhó", "Mungairit", "Inis Faithlinn"] },
  "Cluain Mhic Nóis": { regiao: "Ériu", litoral: true, vizinhos: ["Maigh Eo", "Cruachan", "Dyflin", "Achadh Bhó", "Inis Cealtra"] },
  "Maigh Eo": { regiao: "Ériu", litoral: true, vizinhos: ["Droim Chliabh", "Cruachan", "Cluain Mhic Nóis"] },
};

// Cada região: o bônus de exércitos por turno (se você dominá-la
// inteira) e a lista dos seus territórios.
const REGIOES = {
  "Westseaxe": { bonus: 5, territorios: ["Cornwealas", "Defnas", "Sumorsaete", "Gleawanceaster", "Wintanceaster", "Suthseaxe", "Cent", "Eastseaxe", "Lundenburg"] },
  "East Engle": { bonus: 3, territorios: ["Northfolc", "Suthfolc", "Grantebrycge", "Medeshamstede"] },
  "Mierce": { bonus: 6, territorios: ["Hamtun", "Tomtun", "Hereford", "Legaceaster", "Northworthig", "Doneceaster", "Snotingaham", "Lindcylene", "Ligeraceaster"] },
  "Cymru": { bonus: 3, territorios: ["Gwynedd", "Powys", "Dyfed", "Gwent"] },
  "Northhymbre": { bonus: 5, territorios: ["Rippel", "Mameceaster", "Eoforwic", "Streoneshalh", "Bebbanburg", "Hagustaldesham", "Din Eidyn", "Loncaster", "Mailros"] },
  "Dál Riata": { bonus: 4, territorios: ["Hwiterne", "Alt Clut", "Daire", "Ard Sratha", "Beannchar", "Mön"] },
  "Alba": { bonus: 5, territorios: ["Sgáin", "Fothuirtabaicht", "Dún Att", "Gleann Comhann", "Inbhir Nis", "Dún Foithir", "Apor Crosán", "Ljóðhús", "Kirkjuvágr"] },
  "Ériu": { bonus: 7, territorios: ["Ráth Bhoth", "Droim Chliabh", "Cruachan", "Mainistir Bhuithe", "Dyflin", "Achadh Bhó", "Cill Chainnigh", "Lios Mór", "Corcach", "Mungairit", "Inis Faithlinn", "Inis Cealtra", "Cluain Mhic Nóis", "Maigh Eo"] },
};

// As 5 rotas marítimas (quais já estão dentro de "vizinhos"; esta lista
// só MARCA quais ligações são por mar, p/ a futura regra de combate naval).
const ROTAS_MARITIMAS = [
  ["Beannchar", "Mön"],
  ["Beannchar", "Hwiterne"],
  ["Dyflin", "Gwynedd"],
  ["Apor Crosán", "Kirkjuvágr"],
  ["Apor Crosán", "Ljóðhús"],
];

// ---- atalhos de consulta (usados pelo motor) ----
function regiaoDe(t)            { return TERRITORIOS[t] && TERRITORIOS[t].regiao; }
function vizinhosDe(t)          { return (TERRITORIOS[t] && TERRITORIOS[t].vizinhos) || []; }
function territoriosDaRegiao(r) { return (REGIOES[r] && REGIOES[r].territorios) || []; }
function bonusDaRegiao(r)       { return (REGIOES[r] && REGIOES[r].bonus) || 0; }
function ehLigacaoMaritima(a, b) {
  return ROTAS_MARITIMAS.some(function (par) {
    return (par[0] === a && par[1] === b) || (par[0] === b && par[1] === a);
  });
}
