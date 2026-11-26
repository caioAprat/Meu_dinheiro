// Apresentação apenas: os saldos precisos vêm do assistente.
function nomeHumano(nome) {
  return String(nome || "Conta")
    .replace(/Moto\s*\(BV\)/i, "Moto")
    .replace(/Fatura Nubank\s*\(seguinte\)/i, "Fatura Nubank")
    .replace(/Faculdade parcela 4/i, "Faculdade · parcela de nov")
    .replace(/Faculdade parcela 5/i, "Faculdade · parcela de dez")
    .replace(/Faculdade parcela ([123])\b/i, (_, n) => "Faculdade · parcela de " + ["ago", "set", "out"][n - 1]);
}
function etapasPagamento(p) {
  const etapas = [];
  for (const conta of p.contas || []) {
    const bb = conta.automatico && /^Empréstimo BB/i.test(conta.nome),
      anterior = etapas.at(-1);
    if (
      bb &&
      anterior?.bb &&
      anterior.cabe === conta.cabe &&
      !!anterior.pago === !!conta.pago
    ) {
      anterior.valor += conta.valor;
      anterior.restaDepois = conta.restaDepois;
      anterior.originais.push(conta);
    } else
      etapas.push({
        ...conta,
        bb,
        originais: [conta],
        nome: bb ? "Empréstimos BB" : nomeHumano(conta.nome),
      });
  }
  return etapas;
}
function fracaoSaldo(valor, entrada) {
  return entrada > 0 ? Math.min(1, Math.max(0, valor / entrada)) : 0;
}
function barraMordida(saldo, antes, entrada) {
  return `<div class="trilho" aria-hidden="true"><i class="areia" style="transform:scaleX(${fracaoSaldo(antes, entrada)})"></i><i class="oliva" style="transform:scaleX(${fracaoSaldo(saldo, entrada)})"></i></div>`;
}
function notaConta(c) {
  if (c.seSobrar)
    return c.cabe === false ? "se sobrar · não cabe" : "se sobrar";
  if (c.automatico) return "automático";
  if (c.fechaEm)
    return (
      "compras no crédito até " + dm(c.fechaEm) + " ainda entram nesta fatura"
    );
  return c.aviso || "";
}
function contasResumidas(p) {
  const itens = etapasPagamento(p),
    parcelas = itens.filter((c) => /^Faculdade · parcela [123]$/.test(c.nome));
  if (parcelas.length < 2) return itens;
  return [
    {
      nome: "Faculdade",
      valor: parcelas.reduce((s, c) => s + c.valor, 0),
      nota: parcelas.length + " parcelas",
    },
    ...itens.filter((c) => !parcelas.includes(c)),
  ];
}
function telaPagamento(p, futuros, missoes) {
  const dias = diasAte(p.dia),
    prazo =
      dias === 0
        ? "hoje"
        : dias === 1
          ? "amanhã"
          : dias > 0
            ? "em " + dias + " dias"
            : "há " + Math.abs(dias) + " dias";
  const fontes = [];
  if (p.salario) fontes.push("salário " + R(p.salario.valor));
  for (const e of p.extras || [])
    fontes.push(esc(/^13º/.test(e.nome) ? "13º" : e.nome) + " " + R(e.valor));
  const conta = p.saldoAntes
    ? '<span class="fonte-conta">+ ' + R(p.saldoAntes) + " na conta</span>"
    : "";
  let antes = p.entra;
  const etapas = etapasPagamento(p)
    .map((c) => {
      const nome = /^Faculdade · parcela de /i.test(c.nome)
        ? "Faculdade"
        : c.nome;
      const nota = nome === "Faculdade" ? c.nome.split(" · ")[1] : notaConta(c);
      const barra = barraMordida(c.restaDepois, antes, p.entra),
        anterior = antes;
      antes = c.restaDepois;
      return `<div class="etapa" data-saldo="${Number(c.restaDepois)}" data-antes="${Number(anterior)}" data-valor="${Number(c.valor)}" data-desconta="${c.cabe !== false && !c.pago}"><div class="etapa-texto"><strong><span>− ${esc(nome)}</span><span>${R(c.valor)}</span></strong>${nota ? "<small>" + esc(nota) + "</small>" : ""}</div>${barra}</div>`;
    })
    .join("");
  const lista = futuros
    .map(
      (f) =>
        `<article class="pagamento-card"><h3>${mesAno(f.dia)}</h3><p class="entrada-futura">entra ${R(f.entra)}</p>${barraMordida(f.sobra, f.entra, f.entra)}<div class="contas-futuras">${contasResumidas(
          f,
        )
          .map(
            (c) =>
              `<div class="conta-futura"><div><span>${esc(c.nome.replace("Faculdade · parcela de dez", "Parcela de dez"))}</span><span>${R(c.valor)}</span></div>${c.nota || c.seSobrar ? "<small>" + esc(c.nota || notaConta(c)) + "</small>" : ""}</div>`,
          )
          .join(
            "",
          )}</div><p class="sobra-futura">${f.sobra < 0 ? "falta" : "sobra"} ${R(Math.abs(f.sobra))}</p></article>`,
    )
    .join("");
  const m = missoes?.ativa,
    ate =
      futuros[0]?.dia ||
      (p.ate
        ? new Date(dt(p.ate).getTime() + 864e5).toISOString().slice(0, 10)
        : null);
  return `<section class="cascata" aria-labelledby="proximo-titulo"><h2 id="proximo-titulo">Próximo pagamento · ${mesAno(p.dia)} · ${prazo}</h2><div class="degraus"><div class="etapa entrada"><strong>Entra ${R(p.entra)}</strong><small>${fontes.join(" + ")}${conta}</small>${barraMordida(p.entra, p.entra, p.entra)}</div>${etapas}</div><div class="resultado"><span id="saldoRotulo">Sobra</span><button id="repetir-cascata" aria-label="Sobra ${R(p.sobra)}. Repetir animação do pagamento"><span id="saldoNumero" aria-hidden="true">${estruturaNumero(p)}</span></button><i class="pouso" aria-hidden="true"></i><small class="resultado-prazo">${p.dias ? "para " + Number(p.dias) + " dias" : "após estas contas"}${ate ? " · até " + mesAno(ate) : ""}${p.sobra < 0 ? " · falta cobrir" : ""}</small></div>${futuros.length ? '<a class="proxima-secao" href="#proximos">Próximos pagamentos ' + icone("arrow-right") + "</a>" : ""}</section>
  ${lista ? `<section class="futuros" id="proximos" aria-labelledby="futuros-titulo"><div class="topo-secao"><p>Meu dinheiro</p><button data-acao="atualizar" aria-label="Atualizar dados do banco">${icone("rotate-cw")}</button></div><h2 id="futuros-titulo">Próximos pagamentos</h2><div class="faixa-pagamentos" tabindex="0" role="region" aria-label="Pagamentos futuros; deslize ou use as setas do teclado">${lista}</div><div class="paginacao" aria-label="Páginas dos próximos pagamentos">${Array.from({ length: Math.ceil(futuros.length / 2) }, (_, i) => `<button class="bolinha ${i === 0 ? "selecionada" : ""}" data-pagina="${i}" aria-label="Ver página ${i + 1}" aria-current="${i === 0 ? "true" : "false"}"><i></i></button>`).join("")}</div></section>` : ""}
  ${m ? `<section class="missao-atual" aria-labelledby="missao-titulo"><h2 id="missao-titulo">${esc(m.nome)} <span>${Number(m.pct)}%</span></h2><div class="barra-missao" role="progressbar" aria-label="${esc(m.nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(m.pct)}"><i style="transform:scaleX(${fracaoSaldo(m.pct, 100)})"></i></div><p>${R(m.pago)} de ${R(m.total)}${m.prazo ? " · fecha em " + mesAno(m.prazo) : ""}</p>${(missoes.fila || []).map((x) => '<p class="depois">depois: ' + esc(x.nome) + " · " + R(x.total) + "</p>").join("")}</section>` : ""}<a class="link-contas" href="#todas-contas">Todas as contas ${icone("chevron-down")}</a>`;
}
function todasContas(pagamentos, D) {
  const chaves = new Set();
  const grupos = pagamentos
    .map(
      (p) =>
        `<section class="grupo-contas"><h3>Pago com o salário de ${mesAno(p.dia)}</h3>${
          etapasPagamento(p)
            .map((c) => {
              c.originais.forEach((o) => {
                if (o.chave) chaves.add(o.chave);
              });
              return linhaConta(c, p.dia);
            })
            .join("") || '<p class="pequeno">Nenhuma conta neste pagamento.</p>'
        }</section>`,
    )
    .join("");
  const extras = [
    ...(D.eventos || [])
      .filter((e) => e.chave && e.valor < 0)
      .map((e) => ({ ...e, valor: -e.valor, vence: e.dia })),
    ...(D.missoes || []).flatMap((m) =>
      (m.parcelas || []).map((c) => ({
        ...c,
        nome: c.chave?.split("|")[0] || m.nome,
        vence: c.dia,
      })),
    ),
    ...(D.atrasadas || []),
  ];
  const outras = extras.filter((c) => {
    if (!c.chave || chaves.has(c.chave)) return false;
    chaves.add(c.chave);
    return true;
  });
  return `<section id="todas-contas" class="todas-contas" aria-labelledby="contas-titulo"><div class="contas-cabecalho"><div><h2 id="contas-titulo">Todas as contas</h2><p>Organizadas por pagamento</p></div><details class="menu-ferramentas"><summary aria-label="Abrir ferramentas das contas">${icone("ellipsis")}</summary><div class="menu-opcoes"><button data-acao="atualizar">Atualizar</button><button data-acao="marcar">Marcar conta paga</button><button data-ferramenta="banco">Dados do banco</button><button data-ferramenta="historico">Histórico e ferramentas</button></div></details></div>${grupos}${outras.length ? '<section class="grupo-contas"><h3>Outras contas e parcelas pagas</h3>' + outras.map((c) => linhaConta({ ...c, originais: [c] }, c.vence || c.dia)).join("") + "</section>" : ""}</section>`;
}
function linhaConta(c, dia) {
  const originais = c.originais || [c],
    pago = !!c.pago;
  const acoes = originais
    .filter((o) => o.chave && !o.pago)
    .map(
      (o) =>
        `<button class="paguei" data-pagar="${esc(o.chave)}" data-rotulo="Marcar paga" aria-label="Marcar ${esc(nomeHumano(o.nome))} de ${mesAno(dia)} como paga">Marcar paga</button>`,
    )
    .join("");
  const estado = pago
    ? "pago"
    : c.automatico
      ? "automático"
      : c.seSobrar
        ? notaConta(c)
        : "a pagar";
  return `<div class="conta-linha"><span class="conta-estado" aria-hidden="true">${pago ? icone("check") : ""}</span><div class="conta-conteudo"><div class="conta-nome"><span>${esc(nomeHumano(c.nome))}</span><span>${R(c.valor)}</span></div><p>${mesAno(dia)} · ${estado}</p>${c.fechaEm ? "<p>compras até " + dm(c.fechaEm) + " ainda entram</p>" : ""}${acoes ? '<div class="acoes-conta">' + acoes + "</div>" : ""}</div></div>`;
}
// Ícones Lucide: o traço herda os tokens de texto.
function icone(nome) {
  const caminhos = {
    "arrow-right": '<path d="M5 12h14m-7-7 7 7-7 7"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    ellipsis:
      '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  };
  caminhos["rotate-cw"] =
    '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>';
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    caminhos[nome] +
    "</svg>"
  );
}
// Uma tabela e uma origem document.timeline para toda a coreografia (ms).
const TEMPOS_CASCATA = Object.freeze({
  abertura: 600, conta: 1100, destaque: 150, voo: 450,
  digito: 500, intervaloDigito: 80, sumirCasa: 300, final: 700,
});
function valoresCascata(p) {
  return [p.entra, ...etapasPagamento(p).filter(c => c.cabe !== false && !c.pago).map(c => c.restaDepois)];
}
function casasNumero(valor) {
  const texto = R(valor), casas = { moeda: "R$\u00a0", sinal: texto.startsWith("−") ? "−" : "" };
  let posicao = 0;
  for (const char of [...texto.replace(/^−?R\$\s*/, "")].reverse()) {
    if (/\d/.test(char)) casas["d" + posicao++] = char;
    else casas["p" + posicao] = char;
  }
  return casas;
}
function medirJanelasNumero(numero) {
  return document.fonts.ready.then(() => {
    if (!numero.isConnected) return;
    const estilo = getComputedStyle(numero), prova = document.createElement("span");
    Object.assign(prova.style, {
      position: "absolute", visibility: "hidden", whiteSpace: "pre",
      fontFamily: estilo.fontFamily, fontSize: estilo.fontSize,
      fontWeight: estilo.fontWeight, fontStyle: estilo.fontStyle,
      fontVariantNumeric: "tabular-nums", letterSpacing: "0px",
    });
    document.body.append(prova);
    // Nesta fonte 1ch difere algumas frações de px do avanço tabular real.
    const larguras = [..."0123456789"].map(d => {
      prova.textContent = d;
      return prova.getBoundingClientRect().width;
    });
    prova.remove();
    numero.style.setProperty("--largura-digito", Math.max(...larguras) / parseFloat(estilo.fontSize) + "em");
  });
}
// Os mesmos nós existem no primeiro quadro, no repouso e em reduced-motion.
function estruturaNumero(p) {
  const valores = valoresCascata(p), estados = valores.map(casasNumero), final = casasNumero(p.sobra);
  const chaves = [...new Set(estados.flatMap(Object.keys).concat(Object.keys(final)))];
  const ordem = k => k === "sinal" ? 10000 : k === "moeda" ? 9999 : Number(k.slice(1)) * 2 + (k[0] === "p" ? -1 : 0);
  chaves.sort((a,b) => ordem(b) - ordem(a));
  return '<span class="numero-trilho">' + chaves.map(k => {
    const digito = k[0] === "d", char = final[k] || "", largura = digito ? "var(--largura-digito, 1ch)" : "auto";
    return `<span class="numero-casa ${digito ? "digito" : "numero-sinal"}" data-casa="${k}" style="width:${char ? largura : "0px"};opacity:${char ? 1 : 0}">${digito ? '<span class="digito-rolo">' + estados.concat(final).map(e => '<span>' + (e[k] || "0") + '</span>').join("") + '</span>' : esc(char || estados.find(e => e[k])?.[k] || "")}</span>`;
  }).join("") + '</span>';
}
let ultimaCascata = "", pararCascata = () => {};
function animarPagamento(p, repetir = false) {
  pararCascata();
  const numero = $("saldoNumero");
  if (!numero) return;
  const botao = $("repetir-cascata"), raiz = numero.closest(".cascata"),
    movimento = matchMedia("(prefers-reduced-motion: reduce)"),
    chave = JSON.stringify([p.dia, p.entra, p.sobra, p.contas]),
    deveAnimar = (repetir || ultimaCascata !== chave) && !movimento.matches;
  ultimaCascata = chave;
  botao.onclick = () => animarPagamento(p, true);
  const linhas = [...raiz.querySelectorAll('.etapa[data-desconta="true"]')],
    valores = valoresCascata(p), estados = valores.map(casasNumero),
    casas = [...numero.querySelectorAll(".numero-casa")],
    trilhoNumero = numero.firstElementChild,
    animacoes = new Set(), temporarios = [], t = TEMPOS_CASCATA;
  let cancelado = false, preparado = false, centroFinal = 0;
  const scrollInicial = scrollY;
  // Atualiza só estilos, nunca substitui o número por texto/innerHTML.
  function mostrar(estado, indice) {
    casas.forEach(casa => {
      const k = casa.dataset.casa, char = estado[k];
      casa.style.width = char ? (k[0] === "d" ? "var(--largura-digito, 1ch)" : "auto") : "0px";
      casa.style.opacity = char ? "1" : "0";
      const rolo = casa.firstElementChild;
      if (rolo) rolo.style.transform = `translateY(-${indice * 1.35}em)`;
    });
  }
  function fim() {
    if (cancelado) return;
    cancelado = true;
    animacoes.forEach(a => a.cancel());
    temporarios.forEach(e => e.remove());
    raiz.classList.remove("animando");
    linhas.forEach(l => l.classList.remove("etapa-ativa"));
    mostrar(casasNumero(p.sobra), estados.length);
    numero.style.opacity = preparado ? "1" : "0";
    trilhoNumero.style.transform = `translateX(-${centroFinal}em)`;
    numero.dataset.valor = String(p.sobra);
    numero.dataset.formatado = R(p.sobra);
    movimento.removeEventListener("change", reduzir);
    window.removeEventListener("scroll", rolar);
    window.removeEventListener("resize", fim);
  }
  const reduzir = () => { if (movimento.matches) fim(); };
  const rolar = () => { if (Math.abs(scrollY - scrollInicial) > 40) fim(); };
  pararCascata = fim;
  numero.style.opacity = "0";
  const pronto = medirJanelasNumero(numero).then(() => {
    preparado = true;
    if (cancelado || !deveAnimar || !linhas.length) numero.style.opacity = "1";
  });
  if (!deveAnimar || !linhas.length) {
    mostrar(casasNumero(p.sobra), estados.length);
    numero.dataset.valor = String(p.sobra);
    numero.dataset.formatado = R(p.sobra);
    return;
  }
  mostrar(estados[0], 0);
  numero.style.opacity = "0";
  numero.dataset.valor = String(p.entra);
  numero.dataset.formatado = R(p.entra);
  movimento.addEventListener("change", reduzir);
  window.addEventListener("scroll", rolar, { passive: true });
  window.addEventListener("resize", fim);
  // A fonte real precisa estar pronta antes de medir as janelas tabulares.
  pronto.then(() => {
    if (cancelado || !numero.isConnected) return;
    const fonte = getComputedStyle(numero), em = parseFloat(fonte.fontSize);
    // Mede a largura REAL de cada símbolo com o mesmo estilo do número.
    const medidas = casas.map(casa => {
      const k = casa.dataset.casa;
      casa.style.width = k[0] === "d" ? "var(--largura-digito, 1ch)" : "auto";
      return casa.getBoundingClientRect().width;
    });
    const largura = estado => casas.reduce((s,c,i) => s + (estado[c.dataset.casa] ? medidas[i] : 0), 0),
      maior = Math.max(...estados.map(largura), largura(casasNumero(p.sobra)));
    centroFinal = (maior - largura(casasNumero(p.sobra))) / 2 / em;
    numero.style.width = maior / em + "em";
    numero.style.height = "1.08em";
    mostrar(estados[0], 0);
    trilhoNumero.style.transform = `translateX(-${(maior - largura(estados[0])) / 2 / em}em)`;
    numero.dataset.valor = String(p.entra);
    numero.dataset.formatado = R(p.entra);
    raiz.classList.add("animando");
    // Todas as leituras de geometria precedem a criação dos efeitos.
    const r = raiz.getBoundingClientRect(), n = numero.getBoundingClientRect(),
      barras = linhas.map(l => l.querySelector(".trilho").getBoundingClientRect()),
      ultimoImpacto = t.abertura + (linhas.length - 1) * t.conta + t.destaque + t.voo,
      fimDigitos = ultimoImpacto + t.digito + Math.max(0, Object.keys(estados.at(-1)).filter(k => k[0] === "d").length - 1) * t.intervaloDigito,
      total = fimDigitos + t.final, origem = document.timeline.currentTime;
    raiz.dataset.duracao = String(total);
    const animar = (el, frames, opcoes) => {
      const a = el.animate(frames, { fill: "both", ...opcoes });
      a.startTime = origem;
      animacoes.add(a);
      return a;
    };
    const marco = (ms, fn) => {
      // Efeito vazio: um marco no MESMO relógio; sem timers de coreografia.
      const a = animar(raiz, [], { delay: ms, duration: 1 });
      a.finished.then(() => { if (!cancelado && numero.isConnected) fn(); }).catch(() => {});
    };
    numero.style.opacity = "1";
    animar(numero, [{ opacity: 0 }, { opacity: 1 }], { duration: t.abertura, easing: "ease-out" });
    animar(raiz.querySelector(".entrada .oliva"), [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: t.abertura, easing: "ease-out" });
    // A entrada usa os mesmos nós do repouso; apenas a opacidade muda na abertura.
    linhas.forEach((linha, i) => {
      const inicio = t.abertura + i * t.conta, soltar = inicio + t.destaque, impacto = soltar + t.voo,
        antes = fracaoSaldo(Number(linha.dataset.antes), p.entra), saldo = fracaoSaldo(Number(linha.dataset.saldo), p.entra), b = barras[i];
      marco(inicio, () => { linhas.forEach(l => l.classList.toggle("etapa-ativa", l === linha)); });
      animar(linha.querySelector(".oliva"), [{ transform: `scaleX(${antes})` }, { transform: `scaleX(${saldo})` }], { delay: soltar, duration: t.voo, easing: "cubic-bezier(.2,.8,.2,1)" });
      const pedaco = document.createElement("i"), w = Math.max(3, b.width * (antes - saldo)),
        left = b.left - r.left + b.width * saldo, top = b.top - r.top,
        corredor = r.width + 7, dx = corredor - left - w / 2,
        dy = n.top - r.top + n.height * .65 - top;
      pedaco.className = "pedaco";
      pedaco.setAttribute("aria-hidden", "true");
      Object.assign(pedaco.style, { left: left + "px", top: top + "px", width: w + "px", height: b.height + "px" });
      raiz.append(pedaco); temporarios.push(pedaco);
      // Vai pelo corredor lateral, longe das linhas seguintes e do rótulo Sobra.
      animar(pedaco, [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px,0) scale(.04)`, opacity: 1, offset: .35 },
        { transform: `translate(${dx}px,${dy}px) scale(.04)`, opacity: 1, offset: .85 },
        { transform: `translate(${dx - 10}px,${dy}px) scale(.01)`, opacity: 0 },
      ], { delay: soltar, duration: t.voo, easing: "linear" });
      rolarDigitos(casas, estados[i], estados[i+1], i+1, medidas, impacto, animar);
      const etiqueta = document.createElement("span");
      etiqueta.className = "abatimento-voador";
      etiqueta.textContent = "− " + R(Number(linha.dataset.valor));
      etiqueta.setAttribute("aria-hidden", "true");
      // Alinha à quina superior direita. O limite da tela mantém a etiqueta
      // imediatamente acima da quina quando não há espaço lateral no celular.
      Object.assign(etiqueta.style, { right: Math.max(0, r.right - n.right - 6) + "px", top: n.top - r.top - 18 + "px" });
      raiz.append(etiqueta);temporarios.push(etiqueta);
      animar(etiqueta, [
        { opacity: 0, transform: "translateY(0)" },
        { opacity: 1, transform: "translateY(-3px)", offset: .18 },
        { opacity: 0, transform: "translateY(-12px)" },
      ], { delay: impacto, duration: t.digito, easing: "ease-out" });
      marco(impacto, () => { numero.dataset.valor = linha.dataset.saldo; numero.dataset.formatado = R(Number(linha.dataset.saldo)); });
    });
    const prazo = raiz.querySelector(".resultado-prazo"), pouso = raiz.querySelector(".pouso");
    animar(prazo, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { delay: fimDigitos, duration: t.final, easing: "ease-out" });
    animar(pouso, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { delay: fimDigitos, duration: t.final, easing: "ease-out" });
    animar(trilhoNumero, [
      { transform: `translateX(-${(maior - largura(estados[0])) / 2 / em}em)` },
      { transform: `translateX(-${(maior - largura(estados.at(-1))) / 2 / em}em)` },
    ], { delay: fimDigitos, duration: t.final, easing: "cubic-bezier(.2,.8,.2,1)" });
    animar(numero, [{ transform: "scale(1)" }, { transform: "scale(1.025)", offset: .3 }, { transform: "scale(1)" }], { delay: fimDigitos, duration: t.final, easing: "ease-out" });
    // Mantém a caixa máxima até no estado final: o cancelamento não muda layout.
    const relogio = animar(raiz, [], { duration: total });
    relogio.finished.then(fim).catch(() => {});
  });
}
function rolarDigitos(casas, de, para, indice, medidas, impacto, animar) {
  const t = TEMPOS_CASCATA;
  casas.forEach((casa, i) => {
    const k = casa.dataset.casa, rolo = casa.firstElementChild;
    if (rolo) animar(rolo, [
      { transform: `translateY(-${(indice - 1) * 1.35}em)` },
      { transform: `translateY(-${indice * 1.35}em)` },
    ], { delay: impacto + Number(k.slice(1)) * t.intervaloDigito, duration: t.digito, fill: "forwards", easing: "cubic-bezier(.2,.8,.2,1)", composite: "replace" });
    if (!!de[k] !== !!para[k]) animar(casa, [
      { width: (de[k] ? medidas[i] : 0) + "px", opacity: de[k] ? 1 : 0 },
      { width: (para[k] ? medidas[i] : 0) + "px", opacity: para[k] ? 1 : 0 },
    ], { delay: impacto, duration: t.sumirCasa, fill: "forwards", easing: "ease-out" });
  });
}

function ligarPaginas() {
  const faixa = document.querySelector(".faixa-pagamentos");
  if (!faixa) return;
  const botoes = [...document.querySelectorAll("[data-pagina]")],
    pagina = () => Math.round(faixa.scrollLeft / (faixa.clientWidth + 10));
  faixa.addEventListener(
    "scroll",
    () =>
      botoes.forEach((b, j) => {
        b.classList.toggle("selecionada", j === pagina());
        b.setAttribute("aria-current", String(j === pagina()));
      }),
    { passive: true },
  );
  const ir = (i) =>
    faixa.scrollTo({
      left: i * (faixa.clientWidth + 10),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  botoes.forEach((b) => (b.onclick = () => ir(Number(b.dataset.pagina))));
  faixa.onkeydown = (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      ir(
        Math.max(
          0,
          Math.min(
            botoes.length - 1,
            pagina() + (e.key === "ArrowRight" ? 1 : -1),
          ),
        ),
      );
    }
  };
}
