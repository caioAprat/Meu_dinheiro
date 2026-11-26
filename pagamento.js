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
  return `<section class="cascata" aria-labelledby="proximo-titulo"><h2 id="proximo-titulo">Próximo pagamento · ${mesAno(p.dia)} · ${prazo}</h2><div class="degraus"><div class="etapa entrada"><strong>Entra ${R(p.entra)}</strong><small>${fontes.join(" + ")}${conta}</small>${barraMordida(p.entra, p.entra, p.entra)}</div>${etapas}</div><div class="resultado"><span id="saldoRotulo">Sobra</span><button id="repetir-cascata" aria-label="Sobra ${R(p.sobra)}. Repetir animação do pagamento"><span id="saldoNumero" aria-hidden="true">${R(p.sobra)}</span></button><i class="pouso" aria-hidden="true"></i><small class="resultado-prazo">${p.dias ? "para " + Number(p.dias) + " dias" : "após estas contas"}${ate ? " · até " + mesAno(ate) : ""}${p.sobra < 0 ? " · falta cobrir" : ""}</small></div>${futuros.length ? '<a class="proxima-secao" href="#proximos">Próximos pagamentos ' + icone("arrow-right") + "</a>" : ""}</section>
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
let ultimaCascata = "",
  pararCascata = () => {};
function animarPagamento(p, repetir = false) {
  pararCascata();
  const numero = $("saldoNumero");
  if (!numero) return;
  const botao = $("repetir-cascata");
  botao.onclick = () => animarPagamento(p, true);
  const chave = JSON.stringify([p.dia, p.entra, p.sobra, p.contas]),
    movimento = matchMedia("(prefers-reduced-motion: reduce)");
  if ((!repetir && ultimaCascata === chave) || movimento.matches) {
    ultimaCascata = chave;
    return;
  }
  ultimaCascata = chave;
  const linhas = [...document.querySelectorAll(".etapa[data-saldo]")].filter(
    (l) => l.dataset.desconta === "true",
  );
  if (!linhas.length) return;
  const raiz = document.querySelector(".cascata"),
    pouso = raiz.querySelector(".pouso"),
    prazo = raiz.querySelector(".resultado-prazo");
  const animacoes = new Set(),
    timers = [],
    temporarios = [];
  let parou = false,
    exibido = p.entra;
  const animar = (el, frames, opcoes) => {
    const a = el.animate(frames, { fill: "both", ...opcoes });
    animacoes.add(a);
    return a;
  };
  const depois = (ms, fn) =>
    timers.push(
      setTimeout(() => {
        if (!parou && numero.isConnected) fn();
      }, ms),
    );
  const fim = () => {
    if (parou) return;
    parou = true;
    timers.forEach(clearTimeout);
    animacoes.forEach((a) => a.cancel());
    temporarios.forEach((e) => e.remove());
    raiz.classList.remove("animando");
    numero.textContent = R(p.sobra);
    movimento.removeEventListener("change", reduzir);
  };
  const reduzir = () => {
    if (movimento.matches) fim();
  };
  movimento.addEventListener("change", reduzir);
  pararCascata = fim;
  raiz.classList.add("animando");
  numero.textContent = R(p.entra);
  animar(
    raiz.querySelector(".entrada .oliva"),
    [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
    { duration: 400, easing: "ease-out" },
  );
  animar(
    numero,
    [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 250 },
  );
  const encerramento = 400 + linhas.length * 540;
  animar(
    prazo,
    [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { delay: encerramento, duration: 300, easing: "ease-out" },
  );
  animar(pouso, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
    delay: encerramento,
    duration: 300,
    easing: "ease-out",
  });
  linhas.forEach((linha, i) => {
    const inicio = 400 + i * 540,
      foco = linha.querySelector(".etapa-texto").cloneNode(true);
    foco.className += " linha-foco";
    foco.setAttribute("aria-hidden", "true");
    linha.append(foco);
    temporarios.push(foco);
    animar(
      foco,
      [
        { opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.8 },
        { opacity: 0 },
      ],
      { delay: inicio, duration: 540 },
    );
    const antes = fracaoSaldo(Number(linha.dataset.antes), p.entra),
      saldo = fracaoSaldo(Number(linha.dataset.saldo), p.entra);
    animar(
      linha.querySelector(".oliva"),
      [{ transform: `scaleX(${antes})` }, { transform: `scaleX(${saldo})` }],
      { delay: inicio, duration: 300, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
    depois(inicio, () => {
      // Uma leitura de geometria no começo; os quadros alteram só transform/opacity.
      const r = linha.querySelector(".trilho").getBoundingClientRect(),
        n = numero.getBoundingClientRect(),
        largura = Math.max(3, r.width * (antes - saldo));
      const pedaco = document.createElement("i");
      pedaco.className = "pedaco";
      pedaco.setAttribute("aria-hidden", "true");
      Object.assign(pedaco.style, {
        left: r.left + r.width * saldo + "px",
        top: r.top + "px",
        width: largura + "px",
        height: r.height + "px",
      });
      document.body.append(pedaco);
      temporarios.push(pedaco);
      const dx =
          n.left + n.width / 2 - (r.left + r.width * saldo + largura / 2),
        dy = n.top + n.height / 2 - r.top;
      animar(
        pedaco,
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          {
            transform: `translate(${dx * 0.32}px,${dy * 0.35}px) scale(.85) rotate(-6deg)`,
            opacity: 1,
            offset: 0.45,
          },
          { transform: `translate(${dx}px,${dy}px) scale(.06)`, opacity: 0 },
        ],
        { duration: 300, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    });
    depois(inicio + 300, () => {
      const proximo = Number(linha.dataset.saldo);
      rolarDigitos(numero, exibido, proximo, animar);
      exibido = proximo;
      const etiqueta = document.createElement("span");
      etiqueta.className = "abatimento-voador";
      etiqueta.textContent = "− " + R(Number(linha.dataset.valor));
      etiqueta.setAttribute("aria-hidden", "true");
      raiz.querySelector(".resultado").append(etiqueta);
      temporarios.push(etiqueta);
      animar(
        etiqueta,
        [
          { opacity: 0, transform: "translateY(0)" },
          { opacity: 1, transform: "translateY(-3px)", offset: 0.18 },
          { opacity: 0, transform: "translateY(-12px)" },
        ],
        { duration: 500, easing: "ease-out" },
      );
      numero.dataset.valor = String(proximo);
    });
  });
  animar(botao, [{ transform: "scale(1.06)" }, { transform: "scale(1)" }], {
    fill: "forwards",
    delay: encerramento,
    duration: 380,
    easing: "cubic-bezier(.34,1.56,.64,1)",
  });
  depois(encerramento + 400, fim);
}
function rolarDigitos(el, de, para, animar) {
  const novo = R(para),
    velho = R(de).padStart(novo.length, " "),
    diferenca = velho.length - novo.length;
  el.innerHTML = [...novo]
    .map((char, i) => {
      if (!/\d/.test(char))
        return '<span class="numero-sinal">' + esc(char) + "</span>";
      const anterior = /\d/.test(velho[i + diferenca])
          ? Number(velho[i + diferenca])
          : 0,
        alvo = Number(char),
        passos = (anterior - alvo + 10) % 10 || 10;
      return (
        '<span class="digito"><span class="digito-rolo" data-passos="' +
        passos +
        '">' +
        Array.from(
          { length: passos + 1 },
          (_, j) => "<span>" + ((anterior - j + 10) % 10) + "</span>",
        ).join("") +
        "</span></span>"
      );
    })
    .join("");
  el.querySelectorAll(".digito-rolo").forEach((rolo, i) => {
    const passos = Number(rolo.dataset.passos);
    animar(
      rolo,
      [
        { transform: "translateY(0)" },
        { transform: `translateY(-${(100 * passos) / (passos + 1)}%)` },
      ],
      { duration: 220 + i * 12, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
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
