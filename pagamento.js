// Usa os saldos precisos calculados pelo assistente, inclusive nas contas opcionais.
function etapasPagamento(p) {
  const etapas = [];
  for (const conta of p.contas || []) {
    const bb = conta.automatico && /^Empréstimo BB/i.test(conta.nome);
    const anterior = etapas.at(-1);
    if (bb && anterior?.bb && anterior.cabe === conta.cabe) {
      anterior.valor += conta.valor;
      anterior.restaDepois = conta.restaDepois;
    } else {
      etapas.push({...conta, bb, nome: bb ? 'Empréstimos BB' : conta.nome});
    }
  }
  return etapas;
}

function fracaoSaldo(valor, entrada) {
  return entrada > 0 ? Math.min(1, Math.max(0, valor / entrada)) : 0;
}

function telaPagamento(p, futuros, missoes) {
  const dias = diasAte(p.dia);
  const prazo = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : dias > 0 ? 'em ' + dias + ' dias' : 'há ' + Math.abs(dias) + ' dias';
  const fontes = [];
  if (p.salario) fontes.push('salário ' + R(p.salario.valor));
  for (const e of p.extras || []) fontes.push(esc(e.nome) + ' ' + R(e.valor));
  if (p.saldoAntes) fontes.push(R(p.saldoAntes) + ' na conta');
  const trilho = saldo => '<div class="trilho" aria-hidden="true"><i style="transform:scaleX(' + fracaoSaldo(saldo,p.entra) + ')"></i></div>';
  const etapas = etapasPagamento(p).map(c => {
    const nota = [c.automatico && 'automático', c.aviso, c.seSobrar && (c.cabe ? 'se sobrar' : 'se sobrar · não cabe neste pagamento')].filter(Boolean).map(esc).join(' · ');
    return `<div class="etapa" data-saldo="${Number(c.restaDepois)}"><strong>${esc(c.nome)}<span>${c.cabe === false ? '' : '− '}${R(c.valor)}</span></strong><small>${nota}</small>${trilho(c.restaDepois)}</div>`;
  }).join('');
  const lista = futuros.map(f => `<article><b>${mesAno(f.dia)}</b><small>Entra ${R(f.entra)}</small>${etapasPagamento(f).map(c => `<small>${esc(c.nome)} · ${R(c.valor)}${c.cabe === false ? ' (não cabe)' : ''}</small>`).join('')}<b>${f.sobra < 0 ? 'Falta' : 'Sobra'} ${R(Math.abs(f.sobra))}</b></article>`).join('');
  const m = missoes?.ativa;
  return `<section class="cascata"><h2>Próximo pagamento · ${mesAno(p.dia)} · ${prazo}</h2>
    <div class="etapa"><strong>Entra ${R(p.entra)}</strong><small>${fontes.join(' + ')}</small>${trilho(p.entra)}</div>${etapas}
    <div class="resultado ${p.sobra < 0 ? 'negativo' : ''}"><span class="sr">${p.sobra < 0 ? 'Falta' : 'Sobra'} ${R(Math.abs(p.sobra))}</span>
    <div aria-hidden="true"><span id="saldoRotulo">${p.sobra < 0 ? 'Falta' : 'Sobra'}</span><b id="saldoNumero">${R(Math.abs(p.sobra))}</b></div>
    ${p.dias ? '<small>para ' + Number(p.dias) + ' dias</small>' : ''}</div></section>
    ${lista ? '<section class="futuros"><h2>Próximos pagamentos</h2><div class="faixa-pagamentos">' + lista + '</div></section>' : ''}
    ${m ? `<section class="missao-atual"><h2>${esc(m.nome)} <span>${Number(m.pct)}%</span></h2><progress max="100" value="${Number(m.pct)}" aria-label="Progresso da missão"></progress><p>${R(m.pago)} de ${R(m.total)}${m.prazo ? ' · fecha em ' + mesAno(m.prazo) : ''}</p>${(missoes.fila || []).map(x => '<p>Depois · ' + esc(x.nome) + ' · ' + R(x.total) + '</p>').join('')}</section>` : ''}`;
}

let ultimaCascata = '';
function animarPagamento(p) {
  const chave = JSON.stringify([p.dia,p.entra,p.sobra,p.contas]);
  if (ultimaCascata === chave) return;
  ultimaCascata = chave;
  const movimento = matchMedia('(prefers-reduced-motion: reduce)');
  const linhas = [...document.querySelectorAll('.etapa[data-saldo]')];
  if (!linhas.length || movimento.matches) return;
  const rotulo = $('saldoRotulo'), numero = $('saldoNumero');
  const saldos = [p.entra,...linhas.map(l => Number(l.dataset.saldo))];
  const barras = linhas.map(l => l.querySelector('i'));
  barras.forEach((b,i) => b.style.transform = 'scaleX(' + fracaoSaldo(saldos[i],p.entra) + ')');
  rotulo.textContent = 'Saldo'; numero.textContent = R(p.entra);
  const inicio = performance.now(), passo = Math.min(400,1600 / linhas.length);
  function quadro(agora) {
    if (!numero.isConnected) return;
    const tempo = movimento.matches ? Infinity : Math.max(0, agora - inicio - 120);
    const atual = Math.floor(tempo / passo);
    linhas.forEach((l,i) => {
      const t = Math.min(1,Math.max(0,(tempo - i * passo) / (passo * .76)));
      const saldo = saldos[i] + (saldos[i+1] - saldos[i]) * (1 - (1-t)**3);
      l.classList.toggle('ativa',i === atual);
      barras[i].style.transform = 'scaleX(' + fracaoSaldo(saldo,p.entra) + ')';
      if (i === atual) numero.textContent = R(saldo);
    });
    if (atual < linhas.length) requestAnimationFrame(quadro);
    else { rotulo.textContent = p.sobra < 0 ? 'Falta' : 'Sobra'; numero.textContent = R(Math.abs(p.sobra)); }
  }
  requestAnimationFrame(quadro);
}
