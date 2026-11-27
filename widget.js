// meu-dinheiro-widget:v1
// Código público do Scriptable. API, KEY e PAINEL vêm apenas do carregador.
return (async () => {
  const CORES = { fundo: "#f5f2ea", tinta: "#30362d", apagado: "#64675b", oliva: "#526a3b", areia: "#c1bba5" };
  const familia = config.widgetFamily || "medium";
  const acessorio = familia.startsWith("accessory");
  const fm = FileManager.local();
  // Cache privado no iPhone, isolado por painel/conta, sem incluir a chave no nome.
  let hash = 2166136261;
  for (const c of API + "|" + KEY + "|" + PAINEL) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const arquivo = fm.joinPath(fm.documentsDirectory(), "meu-dinheiro-dados-" + hash.toString(16) + ".json");
  const valido = d => !!d && !!d.proximoPagamento && /^\d{4}-\d{2}-\d{2}$/.test(d.proximoPagamento.dia) &&
    Number.isFinite(d.proximoPagamento.entra) && Number.isFinite(d.proximoPagamento.sobra);
  async function buscar() {
    try {
      const q = new Request(API + (API.includes("?") ? "&" : "?") + "k=" + encodeURIComponent(KEY) + "&acao=widget");
      q.timeoutInterval = 15;
      const d = await q.loadJSON();
      if (valido(d)) {
        try { fm.writeString(arquivo, JSON.stringify(d)); } catch (_) { /* Exibir mesmo sem espaço no cache. */ }
        return { d, offline: false };
      }
    } catch (_) { /* Não registrar URLs ou chaves. */ }
    try {
      const d = fm.fileExists(arquivo) ? JSON.parse(fm.readString(arquivo)) : null;
      if (valido(d)) return { d, offline: true };
    } catch (_) { /* Cache ausente ou corrompido. */ }
    return null;
  }
  function nomeHumano(nome) {
    return String(nome || "Conta")
      .replace(/Moto\s*\(BV\)/i, "Moto")
      .replace(/Fatura Nubank\s*\(seguinte\)/i, "Fatura Nubank")
      .replace(/Faculdade parcela 4/i, "Faculdade · parcela de nov")
      .replace(/Faculdade parcela 5/i, "Faculdade · parcela de dez")
      .replace(/Faculdade parcela ([123])\b/i, (_, n) => "Faculdade · parcela de " + ["ago", "set", "out"][n - 1]);
  }
  function contasHumanas(contas) {
    const lista = [];
    for (const c of Array.isArray(contas) ? contas : []) {
      if (!c || !Number.isFinite(c.valor)) continue;
      const bb = c.automatico && /^Empréstimo BB/i.test(c.nome);
      const anterior = lista[lista.length - 1];
      if (bb && anterior && anterior.bb) anterior.valor += c.valor;
      else lista.push({ nome: bb ? "Empréstimos BB" : nomeHumano(c.nome), valor: c.valor, automatico: !!c.automatico, bb });
    }
    return lista;
  }
  const R = n => (n < 0 ? "−" : "") + "R$ " + Math.abs(Math.round(n)).toLocaleString("pt-BR");
  const fracao = (n, total) => total > 0 ? Math.min(1, Math.max(0, n / total)) : 0;
  function dataHumana(iso) {
    const [ano, mes, dia] = iso.split("-").map(Number);
    return { dia, mes, ano, curta: dia + " " + ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][mes - 1] };
  }
  function prazo(iso) {
    const d = dataHumana(iso), hoje = new Date();
    const dias = Math.round((Date.UTC(d.ano, d.mes - 1, d.dia) - Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 864e5);
    return dias === 0 ? "hoje" : dias === 1 ? "amanhã" : dias > 0 ? "em " + dias + " dias" : "há " + -dias + " dias";
  }
  function texto(pai, valor, tamanho, cor = "tinta", numero = false) {
    const t = pai.addText(String(valor));
    t.font = numero ? Font.semiboldRoundedSystemFont(tamanho) : Font.semiboldSystemFont(tamanho);
    t.textColor = acessorio ? Color.white() : new Color(CORES[cor]);
    t.lineLimit = 1;
    t.minimumScaleFactor = numero ? 0.6 : 0.8;
    return t;
  }
  // Fundo areia inteiro; oliva conserva a proporção exata, inclusive 0% e 100%.
  function barra(pai, proporcao, largura, altura = 6, pontoInicial = false) {
    const ctx = new DrawContext();
    ctx.size = new Size(largura, altura); ctx.opaque = false; ctx.respectScreenScale = true;
    const trilho = new Path(); trilho.addRoundedRect(new Rect(0, 0, largura, altura), altura / 2, altura / 2);
    ctx.setFillColor(new Color(CORES.areia)); ctx.addPath(trilho); ctx.fillPath();
    if (proporcao > 0) {
      ctx.setFillColor(new Color(CORES.oliva));
      // Pontas arredondadas só quando cabe: não aumentar uma sobra pequena.
      const fill = new Path(), w = largura * proporcao;
      fill.addRoundedRect(new Rect(0, 0, w, altura), Math.min(altura / 2, w / 2), Math.min(altura / 2, w / 2));
      ctx.addPath(fill); ctx.fillPath();
    } else if (pontoInicial) {
      ctx.setFillColor(new Color(CORES.oliva)); ctx.fillEllipse(new Rect(0, 0, altura, altura));
    }
    const imagem = pai.addImage(ctx.getImage()); imagem.imageSize = new Size(largura, altura);
    return imagem;
  }
  function resumoContas(contas) {
    const nomes = contas.map(c => /^Fatura/i.test(c.nome) ? "fatura" : /^Faculdade/i.test(c.nome) ? "faculdade" : /^Empréstimos BB/.test(c.nome) ? "BB" : c.nome);
    // Duas categorias cabem na tela de bloqueio; a lista completa fica no painel.
    const prioridades = nomes.filter(n => n === "fatura" || n === "faculdade");
    return [...new Set(prioridades.length ? prioridades : nomes)].slice(0, 2).join(" + ") || "sem contas";
  }
  const info = await buscar(), w = new ListWidget();
  w.url = PAINEL;
  // iOS escolhe o momento efetivo; esta é a próxima atualização solicitada.
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  w.setPadding(acessorio ? 0 : 16, acessorio ? 0 : 16, acessorio ? 0 : 16, acessorio ? 0 : 16);
  if (acessorio) w.addAccessoryWidgetBackground = true;
  else w.backgroundColor = new Color(CORES.fundo);
  if (!info) {
    const t = texto(w, "Sem dados do assistente", 13, "apagado"); t.lineLimit = 2;
  } else {
    const p = info.d.proximoPagamento, contas = contasHumanas(p.contas), data = dataHumana(p.dia);
    const valor = R(p.sobra), proporcao = fracao(p.sobra, p.entra);
    const legenda = data.curta + " · " + prazo(p.dia);
    if (familia === "accessoryInline") {
      texto(w, "Sobra " + valor + " · " + String(data.dia).padStart(2, "0") + "/" + String(data.mes).padStart(2, "0"), 13);
    } else if (familia === "accessoryRectangular") {
      texto(w, "Sobra " + valor, 18, "tinta", true);
      w.addSpacer(3); texto(w, data.curta + " · " + resumoContas(contas), 11, "apagado");
    } else if (familia === "accessoryCircular") {
      w.addSpacer();
      const n = texto(w, Math.round(proporcao * 100) + "%", 24, "tinta", true); n.centerAlignText();
      const l = texto(w, "sobra", 10, "oliva"); l.centerAlignText(); w.addSpacer();
    } else {
      const medio = familia === "medium" || familia === "large" || familia === "extraLarge";
      const corpo = w.addStack(); corpo.layoutHorizontally(); corpo.topAlignContent();
      const esquerda = corpo.addStack(); esquerda.layoutVertically();
      const largura = medio ? 124 : 138;
      if (medio) esquerda.size = new Size(largura, 0);
      texto(esquerda, legenda, 13, "apagado"); esquerda.addSpacer(12);
      texto(esquerda, "Sobra", 13, "oliva"); esquerda.addSpacer(1);
      texto(esquerda, valor, 34, "tinta", true); esquerda.addSpacer(12);
      barra(esquerda, proporcao, largura);
      if (info.offline) { esquerda.addSpacer(5); texto(esquerda, "sem internet · dado salvo", 10, "apagado"); }
      if (medio) {
        corpo.addSpacer(16);
        const direita = corpo.addStack(); direita.layoutVertically();
        for (const c of contas.slice(0, 4)) {
          const partes = c.nome.split(" · "), linha = direita.addStack(); linha.layoutHorizontally();
          texto(linha, partes[0], 12); linha.addSpacer(6); linha.addSpacer();
          const t = texto(linha, R(c.valor), 12);
          t.font = Font.mediumMonospacedSystemFont(12); t.rightAlignText();
          if (c.automatico || partes[1]) texto(direita, c.automatico ? "automático" : partes[1], 10, "apagado");
          direita.addSpacer(4);
        }
        const missao = info.d.missao;
        if (missao && Number.isFinite(missao.pct)) {
          direita.addSpacer(3);
          texto(direita, missao.nome + " · " + Math.round(missao.pct) + "%", 11, "oliva");
          direita.addSpacer(4); barra(direita, fracao(missao.pct, 100), 170, 4, true);
        }
      }
      w.addSpacer();
    }
  }
  if (config.runsInWidget || config.runsInAccessoryWidget) Script.setWidget(w);
  else if (familia === "small") await w.presentSmall();
  else if (familia === "accessoryInline") await w.presentAccessoryInline();
  else if (familia === "accessoryRectangular") await w.presentAccessoryRectangular();
  else if (familia === "accessoryCircular") await w.presentAccessoryCircular();
  else await w.presentMedium();
  Script.complete();
  return w;
})();
