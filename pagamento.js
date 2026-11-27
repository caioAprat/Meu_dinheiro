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
// Integra a física a 240 Hz e reamostra 60 posições. Velocidade inicial zero;
// só encerra após 50ms dentro de 0,2% / 0,02 unidades/s do repouso.
function mola({ rigidez, amortecimento, massa = 1 }) {
  const dt = 1 / 240, amostras = [0];
  let x = 0, v = 0, estavel = 0;
  for (let i = 1; i <= 2400; i++) {
    v += (rigidez * (1 - x) - amortecimento * v) / massa * dt;
    x += v * dt;
    amostras.push(x);
    estavel = Math.abs(1 - x) < .002 && Math.abs(v) < .02 ? estavel + 1 : 0;
    if (estavel >= 12) break;
  }
  const pontos = Array.from({ length: 60 }, (_, i) => {
    const t = i / 59 * (amostras.length - 1), a = Math.floor(t);
    return i === 59 ? 1 : amostras[a] + (amostras[Math.min(a + 1, amostras.length - 1)] - amostras[a]) * (t - a);
  });
  const linear = "linear(" + pontos.map(n => n.toFixed(5)).join(",") + ")";
  return Object.freeze({ rigidez, amortecimento, massa, pontos,
    duracao: Math.round((amostras.length - 1) * dt * 1000),
    easing: CSS.supports("animation-timing-function", linear) ? linear : "cubic-bezier(.22,0,.24,1)",
  });
}
const MOLAS_CASCATA = Object.freeze({
  suave: mola({ rigidez: 170, amortecimento: 26 }),
  quique: mola({ rigidez: 260, amortecimento: 18 }),
  digito: mola({ rigidez: 210, amortecimento: 22 }),
});
// Uma origem document.timeline; a conta seguinte começa a 60% da anterior.
const TEMPOS_CASCATA = Object.freeze({
  abertura: MOLAS_CASCATA.suave.duracao, primeira: 220, destaque: 120, voo: 800,
  conta: Math.round(.6 * (120 + 800 + MOLAS_CASCATA.digito.duracao + 105)),
  digito: MOLAS_CASCATA.digito.duracao, intervaloDigito: 35,
  sumirCasa: MOLAS_CASCATA.suave.duracao, final: MOLAS_CASCATA.quique.duracao,
  sobreporFinal: 280,
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
    const estilo = getComputedStyle(numero), chave = [estilo.fontFamily, estilo.fontSize, estilo.fontWeight, estilo.fontStyle].join("|");
    if (numero.dataset.fonteMedida === chave) return;
    const prova = document.createElement("span");
    Object.assign(prova.style, {
      position: "absolute", visibility: "hidden", whiteSpace: "pre",
      fontFamily: estilo.fontFamily, fontSize: estilo.fontSize,
      fontWeight: estilo.fontWeight, fontStyle: estilo.fontStyle,
      fontVariantNumeric: "tabular-nums", letterSpacing: "0px",
    });
    const glifos = [..."0123456789"].map(d => {
      const el = document.createElement("span");
      el.textContent = d;
      prova.append(el);
      return el;
    });
    document.body.append(prova);
    // Nesta fonte 1ch difere algumas frações de px do avanço tabular real.
    const larguras = glifos.map(el => el.getBoundingClientRect().width);
    prova.remove();
    numero.style.setProperty("--largura-digito", Math.max(...larguras) / parseFloat(estilo.fontSize) + "em");
    numero.dataset.fonteMedida = chave;
  });
}
// Os mesmos nós existem no primeiro quadro, no repouso e em reduced-motion.
function estruturaNumero(p) {
  const valores = valoresCascata(p), estados = valores.map(casasNumero), final = casasNumero(p.sobra);
  const chaves = [...new Set(estados.flatMap(Object.keys).concat(Object.keys(final)))];
  const ordem = k => k === "sinal" ? 10000 : k === "moeda" ? 9999 : Number(k.slice(1)) * 2 + (k[0] === "p" ? -1 : 0);
  chaves.sort((a,b) => ordem(b) - ordem(a));
  return '<span class="numero-pulso"><span class="numero-trilho">' + chaves.map(k => {
    const digito = k[0] === "d", char = final[k] || "", largura = digito ? "var(--largura-digito, 1ch)" : "auto";
    return `<span class="numero-casa ${digito ? "digito" : "numero-sinal"}" data-casa="${k}" style="width:${char ? largura : "0px"};opacity:${char ? 1 : 0}">${digito ? '<span class="digito-rolo">' + estados.concat(final).map(e => '<span>' + (e[k] || "0") + '</span>').join("") + '</span>' : esc(char || estados.find(e => e[k])?.[k] || "")}</span>`;
  }).join("") + '</span></span>';
}
function transformacaoCasa(casas, medidas, estado, indice) {
  const deslocamento = casas.slice(indice + 1).reduce((s, casa, j) =>
    s + (estado[casa.dataset.casa] ? 0 : medidas[indice + 1 + j]), 0);
  return "translateX(" + deslocamento + "px) scaleX(" + (estado[casas[indice].dataset.casa] ? 1 : 0) + ")";
}
let ultimaCascata = "", pararCascata = () => {};
function animarPagamento(p, repetir = false) {
  const numero = $("saldoNumero");
  if (!numero) return;
  // Captura ANTES de cancelar: replay retoma os pixels atuais sem passar pelo final.
  const retomada = pararCascata(repetir === true) || null;
  const botao = $("repetir-cascata"), raiz = numero.closest(".cascata"),
    movimento = matchMedia("(prefers-reduced-motion: reduce)"),
    chave = JSON.stringify([p.dia, p.entra, p.sobra, p.contas]),
    deveAnimar = (repetir || ultimaCascata !== chave) && !movimento.matches,
    linhas = [...raiz.querySelectorAll('.etapa[data-desconta="true"]')],
    valores = valoresCascata(p), estados = valores.map(casasNumero),
    casas = [...numero.querySelectorAll(".numero-casa")], trilhoNumero = numero.querySelector(".numero-trilho"), pulso = numero.firstElementChild,
    animacoes = new Set(), temporarios = [], bases = retomada?.bases || new Map(),
    t = TEMPOS_CASCATA, suave = MOLAS_CASCATA.suave, quique = MOLAS_CASCATA.quique,
    prefixo = retomada && deveAnimar ? suave.duracao : 0;
  let cancelado = false, preparado = !!retomada, centroFinal = 0;
  const scrollInicial = scrollY;
  ultimaCascata = chave;
  botao.onclick = () => animarPagamento(p, true);
  function mostrar(estado, indice) {
    casas.forEach(casa => {
      const k = casa.dataset.casa, char = estado[k];
      casa.style.width = char ? (k[0] === "d" ? "var(--largura-digito, 1ch)" : "auto") : "0px";
      casa.style.opacity = char ? "1" : "0";
      if (casa.firstElementChild) casa.firstElementChild.style.transform = "translateY(-"+indice*1.35+"em)";
    });
  }
  function fim(preservar = false) {
    if (cancelado) return;
    const guardar = preservar === true && preparado && raiz.classList.contains("animando"), estilos = new Map();
    if (guardar) for (const [el, props] of bases) {
      const css = getComputedStyle(el);
      // Larguras são fixas no FLIP: não serializá-las para keyframes de replay.
      // A serialização CSS arredonda e faria a casa perder 1/64px.
      estilos.set(el, Object.fromEntries([...props.keys()].filter(k => k !== "width").map(k => [k, css[k]])));
    }
    cancelado = true;
    animacoes.forEach(a => a.cancel());
    for (const [el, props] of bases) for (const [k, v] of props) {
      if (!(guardar && k === "width")) el.style[k] = v;
    }
    raiz.classList.remove("animando");
    movimento.removeEventListener("change", reduzir);
    window.removeEventListener("scroll", rolar);
    window.removeEventListener("resize", fim);
    if (guardar) {
      for (const [el, props] of estilos) Object.assign(el.style, props);
      return { estilos, bases, temporarios };
    }
    temporarios.forEach(e => e.remove());
    retomada?.temporarios.forEach(e => e.remove());
    mostrar(casasNumero(p.sobra), estados.length);
    numero.style.opacity = preparado ? "1" : "0";
    numero.style.transform = "";
    numero.style.color = "";
    trilhoNumero.style.transform = "translateX(-"+centroFinal+"em)";
    numero.dataset.valor = String(p.sobra);
    numero.dataset.formatado = R(p.sobra);
  }
  const reduzir = () => { if (movimento.matches) fim(); };
  const rolar = () => { if (Math.abs(scrollY - scrollInicial) > 40) fim(); };
  pararCascata = fim;
  if (!retomada) numero.style.opacity = "0";
  const pronto = medirJanelasNumero(numero).then(() => {
    preparado = true;
    if (cancelado || !deveAnimar || !linhas.length) numero.style.opacity = "1";
  });
  if (!deveAnimar || !linhas.length) {
    fim();
    return;
  }
  if (!retomada) {
    mostrar(estados[0], 0);
    numero.dataset.valor = String(p.entra);
    numero.dataset.formatado = R(p.entra);
  }
  movimento.addEventListener("change", reduzir);
  window.addEventListener("scroll", rolar, { passive: true });
  window.addEventListener("resize", fim);
  pronto.then(() => {
    if (cancelado || !numero.isConnected) return;
    // Primeiro mede o repouso, depois cria efeitos: nenhuma leitura em rAF.
    for (const [el, props] of bases) if (!retomada?.temporarios.some(e => e === el || e.contains(el))) {
      for (const [k, v] of props) el.style[k] = v;
    }
    numero.style.transform = "";
    const fonte = getComputedStyle(numero), em = parseFloat(fonte.fontSize),
      tinta = getComputedStyle(raiz).getPropertyValue("--tinta").trim(),
      apagado = getComputedStyle(raiz).getPropertyValue("--apagado").trim();
    casas.forEach(casa => {
      casa.style.width = casa.dataset.casa[0] === "d" ? "var(--largura-digito, 1ch)" : "auto";
    });
    const medidas = casas.map(casa => casa.getBoundingClientRect().width);
    const largura = estado => casas.reduce((s,c,i) => s + (estado[c.dataset.casa] ? medidas[i] : 0), 0),
      maior = Math.max(...estados.map(largura), largura(casasNumero(p.sobra)));
    centroFinal = (maior - largura(casasNumero(p.sobra))) / 2 / em;
    numero.style.width = maior / em + "em";
    numero.style.height = "1.08em";
    mostrar(estados[0], 0);
    trilhoNumero.style.transform = "translateX(-"+(maior-largura(estados[0]))/2/em+"em)";
    numero.style.opacity = "1";
    numero.style.color = tinta;
    const r = raiz.getBoundingClientRect(), n = numero.getBoundingClientRect(),
      barras = linhas.map(l => l.querySelector(".trilho").getBoundingClientRect()),
      ultimoImpacto = t.primeira + (linhas.length - 1) * t.conta + t.destaque + t.voo,
      fimDigitos = ultimoImpacto + t.digito + Math.max(0, Object.keys(estados.at(-1)).filter(k => k[0] === "d").length - 1) * t.intervaloDigito,
      pousar = Math.max(ultimoImpacto + 170, fimDigitos - t.sobreporFinal),
      pousarNumero = pousar + Math.max(0, suave.duracao - t.final),
      total = prefixo + pousarNumero + t.final, preparoInicio = performance.now();
    raiz.dataset.duracao = String(total);
    raiz.dataset.impactos = JSON.stringify(linhas.map((_,i) => prefixo + t.primeira + i*t.conta + t.destaque + t.voo));
    raiz.dataset.pouso = String(prefixo + pousarNumero);
    const animar = (el, frames, opcoes) => {
      let props = bases.get(el);
      if (!props) bases.set(el, props = new Map());
      for (const frame of frames) for (const k of Object.keys(frame)) {
        if (!["offset","easing","composite"].includes(k) && !props.has(k)) props.set(k, el.style[k]);
      }
      const { retomando, ...timing } = opcoes;
      const a = el.animate(frames, { fill: "forwards", ...timing, delay: (timing.delay || 0) + (retomando ? 0 : prefixo) });
      // A preparação não consome a abertura. Todos recebem origem só após montar.
      a.pause();
      a.currentTime = 0;
      animacoes.add(a);
      return a;
    };
    const marco = (ms, fn) => {
      const a = animar(raiz, [], { delay: ms, duration: 1 });
      a.finished.then(() => { if (!cancelado && numero.isConnected) fn(); }).catch(() => {});
    };
    const definirInicio = (el, valores) => {
      let props = bases.get(el);
      if (!props) bases.set(el, props = new Map());
      for (const k of Object.keys(valores)) if (!props.has(k)) props.set(k, el.style[k]);
      Object.assign(el.style, valores);
    };
    // FLIP: conserva as janelas e move apenas as casas à esquerda do espaço
    // liberado. A unidade continua ancorada, sem relayout durante o giro.
    casas.forEach((casa, i) => definirInicio(casa, {
      width: medidas[i] + "px", transform: transformacaoCasa(casas, medidas, estados[0], i),
      opacity: estados[0][casa.dataset.casa] ? "1" : "0",
    }));
    definirInicio(pulso, { filter: "brightness(1) saturate(1) hue-rotate(0deg)" });
    raiz.classList.add("animando");
    // O valor já está legível na preparação; a entrada pertence às linhas/barras.
    const entrada = raiz.querySelector(".entrada .oliva");
    definirInicio(entrada, { transform: "scaleX(0)" });
    animar(entrada, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: t.abertura, easing: suave.easing });
    [...raiz.querySelectorAll(".etapa")].forEach((linha,i) => {
      definirInicio(linha, { opacity: "0.001", transform: "translateY(8px)" });
      animar(linha, [{ opacity: .001, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
        { delay: i*40, duration: suave.duracao, easing: suave.easing });
    });
    linhas.forEach((linha, i) => {
      const inicio = t.primeira + i * t.conta, soltar = inicio + t.destaque, impacto = soltar + t.voo,
        antes = fracaoSaldo(Number(linha.dataset.antes), p.entra), saldo = fracaoSaldo(Number(linha.dataset.saldo), p.entra), b = barras[i],
        barra = linha.querySelector(".oliva"), texto = linha.querySelector(".etapa-texto");
      animar(texto, [{ color: apagado }, { color: tinta }], { delay: inicio, duration: suave.duracao, easing: suave.easing });
      definirInicio(barra, { transform: "scaleX("+antes+")" });
      animar(barra, [{ transform: "scaleX("+antes+")" }, { transform: "scaleX("+saldo+")" }],
        { delay: soltar, duration: quique.duracao, easing: quique.easing });
      const eixoX = document.createElement("span"), eixoY = document.createElement("span"), pedaco = document.createElement("i"),
        w = Math.max(3, b.width * (antes - saldo)), left = b.left - r.left + b.width * saldo, top = b.top - r.top,
        dx = r.width + 12 - left - w/2, dy = n.top - r.top + n.height*.65 - top;
      eixoX.className = "pedaco-x"; eixoY.className = "pedaco-y"; pedaco.className = "pedaco";
      eixoX.setAttribute("aria-hidden", "true");
      // Wrappers sem área: o retângulo invisível não cria rolagem lateral.
      Object.assign(eixoX.style, { left: left+"px", top: top+"px", width: "0px", height: "0px" });
      Object.assign(pedaco.style, { left: "0px", top: "0px", width: w+"px", height: b.height+"px", opacity: "0" });
      eixoY.append(pedaco); eixoX.append(eixoY); raiz.append(eixoX); temporarios.push(eixoX);
      // Arco: X desacelera e Y acelera, derivados da mola suave em eixos separados.
      const yLinear = "linear(" + suave.pontos.map((_,j,a) => (1-a[a.length-1-j]).toFixed(5)).join(",") + ")",
        yEasing = CSS.supports("animation-timing-function", yLinear) ? yLinear : "cubic-bezier(.76,0,.78,1)";
      animar(eixoX, [{ transform: "translateX(0)" }, { transform: "translateX("+dx+"px)" }],
        { delay: soltar, duration: t.voo, easing: suave.easing });
      animar(eixoY, [{ transform: "translateY(0)" }, { transform: "translateY("+dy+"px)" }],
        { delay: soltar, duration: t.voo, easing: yEasing });
      animar(pedaco, [
        { transform: "scale(1)", opacity: 1, easing: quique.easing },
        { transform: "scale(1.04)", opacity: 1, offset: .08, easing: suave.easing },
        { transform: "scale(.06,.65)", opacity: 1, offset: .38, easing: suave.easing },
        { transform: "scale(.06,.65)", opacity: 1, offset: .86, easing: suave.easing },
        { transform: "scale(.01)", opacity: 0 },
      ], { delay: soltar, duration: t.voo });
      rolarDigitos(casas, estados[i], estados[i+1], i+1, medidas, impacto, animar);
      animar(pulso, [
        { transform: "scale(1)", easing: suave.easing },
        { transform: "scale(.97)", offset: .34, easing: quique.easing },
        { transform: "scale(1)" },
      ], { delay: impacto, duration: quique.duracao, fill: "none" });
      const etiqueta = document.createElement("span");
      etiqueta.className = "abatimento-voador";
      etiqueta.textContent = "− " + R(Number(linha.dataset.valor)); etiqueta.setAttribute("aria-hidden", "true");
      Object.assign(etiqueta.style, { right: Math.max(0, r.right-n.right-6)+"px", top: n.top-r.top-18+"px", opacity: "0" });
      raiz.append(etiqueta); temporarios.push(etiqueta);
      animar(etiqueta, [
        { opacity: 0, transform: "translateY(0)", easing: suave.easing },
        { opacity: 1, transform: "translateY(-3px)", offset: .25, easing: suave.easing },
        { opacity: 0, transform: "translateY(-12px)" },
      ], { delay: impacto, duration: t.digito });
      marco(impacto, () => { numero.dataset.valor = linha.dataset.saldo; numero.dataset.formatado = R(Number(linha.dataset.saldo)); });
    });
    const prazo = raiz.querySelector(".resultado-prazo"), pouso = raiz.querySelector(".pouso");
    definirInicio(prazo, { opacity: "0.001", filter: "blur(4px)", transform: "translateY(6px)" });
    definirInicio(pouso, { transform: "scaleX(0)" });
    animar(prazo, [{ opacity: 0, transform: "translateY(6px)", filter: "blur(4px)" }, { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" }],
      { delay: pousar, duration: suave.duracao, easing: suave.easing });
    animar(pouso, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      { delay: pousar, duration: t.final, easing: quique.easing });
    animar(trilhoNumero, [
      { transform: "translateX(-"+(maior-largura(estados[0]))/2/em+"em)" },
      { transform: "translateX(-"+centroFinal+"em)" },
    ], { delay: pousarNumero, duration: t.final, easing: suave.easing });
    // Matriz sRGB exata de #30362d → #526a3b: muda a cor na camada composta,
    // sem repintar todos os glifos em cada quadro. No fim volta à cor CSS oliva.
    animar(pulso, [
      { filter: "brightness(1) saturate(1) hue-rotate(0deg)" },
      { filter: "brightness(1.8723334562) saturate(2.7153816161) hue-rotate(-8.0086419635deg)" },
    ], { delay: pousar, duration: suave.duracao, easing: suave.easing });
    animar(pulso, [
      { transform: "scale(1)", easing: quique.easing },
      { transform: "scale(1.035)", offset: .3, easing: quique.easing },
      { transform: "scale(1)" },
    ], { delay: pousarNumero, duration: t.final });
    if (retomada) {
      const destinos = new Map();
      for (const [el, props] of retomada.estilos) {
        if (!retomada.temporarios.some(e => e === el || e.contains(el))) {
          const css = getComputedStyle(el);
          destinos.set(el, Object.fromEntries(Object.keys(props).map(k => [k, css[k]])));
        }
      }
      for (const [el, frames] of retomada.estilos) if (destinos.has(el)) {
        animar(el, [frames, destinos.get(el)], { retomando: true, duration: prefixo, easing: suave.easing, fill: "none" });
      }
      for (const el of retomada.temporarios) {
        temporarios.push(el);
        animar(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }],
          { retomando: true, duration: 240, easing: suave.easing });
      }
    }
    marco(0, () => { numero.dataset.valor = String(p.entra); numero.dataset.formatado = R(p.entra); });
    const relogio = animar(raiz, [], { retomando: true, duration: total });
    relogio.finished.then(() => fim()).catch(() => {});
    // Um quadro de preparação deixa as máscaras/camadas prontas antes do relógio.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelado) return;
      const origem = document.timeline.currentTime;
      raiz.dataset.preparacao = String(performance.now() - preparoInicio);
      for (const a of animacoes) {
        a.play();
        a.startTime = origem;
      }
    }));
  });
}
function rolarDigitos(casas, de, para, indice, medidas, impacto, animar) {
  const t = TEMPOS_CASCATA;
  casas.forEach((casa, i) => {
    const k = casa.dataset.casa, rolo = casa.firstElementChild;
    if (rolo) animar(rolo, [
      { transform: "translateY(-"+(indice-1)*1.35+"em)" },
      { transform: "translateY(-"+indice*1.35+"em)" },
    ], { delay: impacto + Number(k.slice(1)) * t.intervaloDigito, duration: t.digito, easing: MOLAS_CASCATA.digito.easing });
    const antes = transformacaoCasa(casas, medidas, de, i), depois = transformacaoCasa(casas, medidas, para, i);
    if (antes !== depois) animar(casa, [
      { transform: antes, opacity: de[k] ? 1 : 0 },
      { transform: depois, opacity: para[k] ? 1 : 0 },
    ], { delay: impacto, duration: t.sumirCasa, easing: MOLAS_CASCATA.suave.easing });
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
