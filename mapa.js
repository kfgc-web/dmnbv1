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
  "Cornualha": { regiao: "Wessex", litoral: true, vizinhos: ["Devon"] },
  "Devon": { regiao: "Wessex", litoral: true, vizinhos: ["Cornualha", "Somerset"] },
  "Somerset": { regiao: "Wessex", litoral: true, vizinhos: ["Devon", "Hampshire", "Gloucester", "Birmingham", "Hereford"] },
  "Gloucester": { regiao: "Wessex", litoral: false, vizinhos: ["Birmingham", "Hampshire", "London", "Somerset"] },
  "Hampshire": { regiao: "Wessex", litoral: true, vizinhos: ["Somerset", "Gloucester", "Sussex"] },
  "Sussex": { regiao: "Wessex", litoral: true, vizinhos: ["Hampshire", "London", "Kent"] },
  "Kent": { regiao: "Wessex", litoral: true, vizinhos: ["Essex", "London", "Sussex"] },
  "Essex": { regiao: "Wessex", litoral: true, vizinhos: ["Kent", "London", "Cambridge", "Suffolk"] },
  "London": { regiao: "Wessex", litoral: false, vizinhos: ["Kent", "Essex", "Sussex", "Gloucester", "Northampton"] },
  "Norfolk": { regiao: "Ânglia Oriental", litoral: true, vizinhos: ["Suffolk", "Cambridge", "Peterborough"] },
  "Suffolk": { regiao: "Ânglia Oriental", litoral: true, vizinhos: ["Essex", "Cambridge", "Norfolk"] },
  "Cambridge": { regiao: "Ânglia Oriental", litoral: false, vizinhos: ["Essex", "Suffolk", "Norfolk", "Peterborough", "Northampton"] },
  "Peterborough": { regiao: "Ânglia Oriental", litoral: true, vizinhos: ["Lincoln", "Leicester", "Cambridge", "Northampton", "Nottingham", "Norfolk"] },
  "Northampton": { regiao: "Mércia", litoral: false, vizinhos: ["London", "Cambridge", "Peterborough", "Leicester", "Birmingham"] },
  "Birmingham": { regiao: "Mércia", litoral: false, vizinhos: ["Northampton", "Somerset", "Gloucester", "Hereford", "Derby", "Leicester"] },
  "Hereford": { regiao: "Mércia", litoral: false, vizinhos: ["Somerset", "Gwent", "Powys", "Derby", "Chester", "Birmingham"] },
  "Chester": { regiao: "Mércia", litoral: false, vizinhos: ["Hereford", "Gwynedd", "Derby", "South York", "Blackpool", "Manchester"] },
  "Derby": { regiao: "Mércia", litoral: false, vizinhos: ["Birmingham", "Leicester", "Hereford", "Chester", "South York", "Nottingham"] },
  "South York": { regiao: "Mércia", litoral: false, vizinhos: ["Manchester", "Nottingham", "Derby", "Chester"] },
  "Nottingham": { regiao: "Mércia", litoral: false, vizinhos: ["Manchester", "East York", "Lincoln", "Peterborough", "Leicester", "South York", "Derby"] },
  "Lincoln": { regiao: "Mércia", litoral: true, vizinhos: ["East York", "Peterborough", "Nottingham"] },
  "Leicester": { regiao: "Mércia", litoral: false, vizinhos: ["Peterborough", "Northampton", "Birmingham", "Derby", "Nottingham"] },
  "Gwynedd": { regiao: "Gales", litoral: true, vizinhos: ["Powys", "Chester", "Dublin"] },
  "Powys": { regiao: "Gales", litoral: true, vizinhos: ["Gwynedd", "Deheubarth", "Gwent", "Hereford"] },
  "Deheubarth": { regiao: "Gales", litoral: true, vizinhos: ["Powys", "Gwent"] },
  "Gwent": { regiao: "Gales", litoral: true, vizinhos: ["Hereford", "Powys", "Deheubarth"] },
  "Blackpool": { regiao: "Northumbria", litoral: true, vizinhos: ["Chester", "Manchester", "North York"] },
  "Manchester": { regiao: "Northumbria", litoral: false, vizinhos: ["South York", "Chester", "Nottingham", "Blackpool", "North York", "East York"] },
  "East York": { regiao: "Northumbria", litoral: true, vizinhos: ["Lincoln", "Nottingham", "Manchester", "North York"] },
  "North York": { regiao: "Northumbria", litoral: true, vizinhos: ["Newcastle", "Blackpool", "Lancashire", "Manchester", "East York", "Alston"] },
  "Newcastle": { regiao: "Northumbria", litoral: true, vizinhos: ["Edimburg", "North York", "Alston", "Hawick"] },
  "Alston": { regiao: "Northumbria", litoral: false, vizinhos: ["Newcastle", "North York", "Lancashire", "Hawick"] },
  "Edimburg": { regiao: "Northumbria", litoral: true, vizinhos: ["Newcastle", "Hawick", "Glascow", "Dundee", "Stirling"] },
  "Lancashire": { regiao: "Northumbria", litoral: false, vizinhos: ["North York", "Alston", "Hawick", "Wigtown"] },
  "Hawick": { regiao: "Northumbria", litoral: false, vizinhos: ["Newcastle", "Alston", "Edimburg", "Lancashire", "Wigtown", "Glascow"] },
  "Wigtown": { regiao: "Dál-Riata", litoral: true, vizinhos: ["Glascow", "Lancashire", "Hawick", "Belfast"] },
  "Glascow": { regiao: "Dál-Riata", litoral: true, vizinhos: ["Wigtown", "Hawick", "Edimburg", "Stirling", "Kilchomann"] },
  "Derry": { regiao: "Dál-Riata", litoral: true, vizinhos: ["Belfast", "Omagh", "Letterkenny"] },
  "Omagh": { regiao: "Dál-Riata", litoral: false, vizinhos: ["Derry", "Letterkenny", "Sligo", "Boyle", "Belfast"] },
  "Belfast": { regiao: "Dál-Riata", litoral: true, vizinhos: ["Derry", "Omagh", "Dundalk", "Wigtown", "Ilha de Mann"] },
  "Ilha de Mann": { regiao: "Dál-Riata", litoral: true, vizinhos: ["Belfast"] },
  "Dundee": { regiao: "Escócia", litoral: true, vizinhos: ["Edimburg", "Stirling", "Aberdeen"] },
  "Stirling": { regiao: "Escócia", litoral: false, vizinhos: ["Edimburg", "Dundee", "Kilchomann", "Glascow", "Aberdeen", "Inverness"] },
  "Kilchomann": { regiao: "Escócia", litoral: true, vizinhos: ["Glascow", "Stirling", "Inverness", "Glencoe"] },
  "Glencoe": { regiao: "Escócia", litoral: true, vizinhos: ["Kilchomann", "Inverness", "Gairloch"] },
  "Inverness": { regiao: "Escócia", litoral: true, vizinhos: ["Aberdeen", "Stirling", "Kilchomann", "Glencoe", "Gairloch"] },
  "Aberdeen": { regiao: "Escócia", litoral: true, vizinhos: ["Dundee", "Stirling", "Inverness"] },
  "Gairloch": { regiao: "Escócia", litoral: true, vizinhos: ["Inverness", "Glencoe", "Stornoway", "Kirkwall"] },
  "Stornoway": { regiao: "Escócia", litoral: true, vizinhos: ["Gairloch"] },
  "Kirkwall": { regiao: "Escócia", litoral: true, vizinhos: ["Gairloch"] },
  "Letterkenny": { regiao: "Irlanda", litoral: true, vizinhos: ["Sligo", "Derry", "Omagh"] },
  "Sligo": { regiao: "Irlanda", litoral: true, vizinhos: ["Letterkenny", "Omagh", "Boyle", "Castlebar"] },
  "Boyle": { regiao: "Irlanda", litoral: false, vizinhos: ["Omagh", "Dundalk", "Dublin", "Athlone", "Castlebar", "Sligo"] },
  "Dundalk": { regiao: "Irlanda", litoral: true, vizinhos: ["Dublin", "Boyle", "Belfast"] },
  "Dublin": { regiao: "Irlanda", litoral: true, vizinhos: ["Portlaoise", "Athlone", "Boyle", "Dundalk", "Gwynedd"] },
  "Portlaoise": { regiao: "Irlanda", litoral: true, vizinhos: ["Kilkenny", "Limerick", "Ennis", "Athlone", "Dublin"] },
  "Kilkenny": { regiao: "Irlanda", litoral: true, vizinhos: ["Waterford", "Limerick", "Portlaoise"] },
  "Waterford": { regiao: "Irlanda", litoral: true, vizinhos: ["Cork", "Limerick", "Kilkenny"] },
  "Cork": { regiao: "Irlanda", litoral: true, vizinhos: ["Waterford", "Limerick", "Killarney"] },
  "Limerick": { regiao: "Irlanda", litoral: false, vizinhos: ["Waterford", "Cork", "Killarney", "Ennis", "Portlaoise", "Kilkenny"] },
  "Killarney": { regiao: "Irlanda", litoral: true, vizinhos: ["Ennis", "Limerick", "Cork"] },
  "Ennis": { regiao: "Irlanda", litoral: true, vizinhos: ["Athlone", "Portlaoise", "Limerick", "Killarney"] },
  "Athlone": { regiao: "Irlanda", litoral: true, vizinhos: ["Castlebar", "Boyle", "Dublin", "Portlaoise", "Ennis"] },
  "Castlebar": { regiao: "Irlanda", litoral: true, vizinhos: ["Sligo", "Boyle", "Athlone"] },
};

// Cada região: o bônus de exércitos por turno (se você dominá-la
// inteira) e a lista dos seus territórios.
const REGIOES = {
  "Wessex": { bonus: 5, territorios: ["Cornualha", "Devon", "Somerset", "Gloucester", "Hampshire", "Sussex", "Kent", "Essex", "London"] },
  "Ânglia Oriental": { bonus: 3, territorios: ["Norfolk", "Suffolk", "Cambridge", "Peterborough"] },
  "Mércia": { bonus: 6, territorios: ["Northampton", "Birmingham", "Hereford", "Chester", "Derby", "South York", "Nottingham", "Lincoln", "Leicester"] },
  "Gales": { bonus: 3, territorios: ["Gwynedd", "Powys", "Deheubarth", "Gwent"] },
  "Northumbria": { bonus: 5, territorios: ["Blackpool", "Manchester", "East York", "North York", "Newcastle", "Alston", "Edimburg", "Lancashire", "Hawick"] },
  "Dál-Riata": { bonus: 4, territorios: ["Wigtown", "Glascow", "Derry", "Omagh", "Belfast", "Ilha de Mann"] },
  "Escócia": { bonus: 5, territorios: ["Dundee", "Stirling", "Kilchomann", "Glencoe", "Inverness", "Aberdeen", "Gairloch", "Stornoway", "Kirkwall"] },
  "Irlanda": { bonus: 7, territorios: ["Letterkenny", "Sligo", "Boyle", "Dundalk", "Dublin", "Portlaoise", "Kilkenny", "Waterford", "Cork", "Limerick", "Killarney", "Ennis", "Athlone", "Castlebar"] },
};

// As 5 rotas marítimas (quais já estão dentro de "vizinhos"; esta lista
// só MARCA quais ligações são por mar, p/ a futura regra de combate naval).
const ROTAS_MARITIMAS = [
  ["Belfast", "Ilha de Mann"],
  ["Belfast", "Wigtown"],
  ["Dublin", "Gwynedd"],
  ["Gairloch", "Kirkwall"],
  ["Gairloch", "Stornoway"],
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
