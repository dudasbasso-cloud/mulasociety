// O ecrã do Jarvis: lê a API do servidor, ouve o canal de eventos e desenha os painéis (radar, gráfico, máquina do tempo,
// observações, agora, conta, notícias, calendário, conversa e opções). Lembra o símbolo, o tempo e as camadas.
import { criarGrafico } from './grafico.js'

const CODIGO = document.querySelector('meta[name="jarvis-codigo"]').content
const $ = id => document.getElementById(id)
const NB = ' ', LX = 'Europe/Lisbon'
const fmt = (v, c = 1) => { if (v == null || Number.isNaN(+v)) return '-'; const s = Math.abs(v).toFixed(c).split('.'); return (v < 0 ? '-' : '') + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB) + (s[1] ? ',' + s[1] : '') }
const casasTexto = s => s === 'XAUUSD' ? 1 : /JPY/.test(s) ? 3 : 5
const pipDe = s => s === 'XAUUSD' ? 0.1 : /JPY/.test(s) ? 0.01 : 0.0001
let ultimoPlacar = []
const TFN = { '15m': '15 min', '1h': '1 h', '4h': '4 h', '1d': 'dia' }, FIBO = { 0.382: '38,2', 0.5: '50', 0.618: '61,8' }
let ultimaR = null   // a última análise, para a contagem do mercado fechado no Agora
const hhmm = ms => new Date(ms).toLocaleTimeString('pt-PT', { timeZone: LX, hour: '2-digit', minute: '2-digit' })
const diaDe = ms => new Date(ms).toLocaleDateString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit' })
const diaHora = ms => (diaDe(ms) === diaDe(Date.now()) ? '' : diaDe(ms) + ' ') + hhmm(ms)
const quando = ms => { const d = diaDe(ms); return (d === diaDe(Date.now()) ? '' : d === diaDe(Date.now() + 864e5) ? 'amanhã ' : 'a ' + d + ' ') + 'às ' + hhmm(ms) }
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
// na página da nuvem (o link fixo do amigo, 24/10) a API vem do Supabase; no Mac é a do próprio servidor
const BASE = window.JARVIS_API || ''
const api = async c => { const r = await fetch(BASE + '/api/' + c); const j = await r.json(); if (!r.ok) throw new Error(j.erro || c); return j }
async function post(c, corpo) {
  const r = await fetch('/api/' + c, { method: 'POST', headers: { 'content-type': 'application/json', 'x-jarvis': CODIGO }, body: JSON.stringify(corpo) })
  if (r.status === 403) { location.reload(); throw new Error('o servidor reiniciou') }   // o código muda quando o servidor arranca
  const j = await r.json()
  if (!r.ok) throw new Error(j.erro || c)
  return j
}

const est = Object.assign({ simbolo: 'XAUUSD', tf: '15m', conversa: [] }, JSON.parse(localStorage.getItem('jarvis') || '{}'))
// o gráfico limpo de base (velas, SV3, níveis, a posição e o estocástico); o resto liga-se em cima. A versão 2 repõe isto
// uma vez em quem já tinha tudo ligado.
const LIMPO = { sv3: true, ema: false, niveis: true, diario: false, asia: false, fibo: false, linhas: false, velas: false, sinais: false, alvos: true, plano: true, posicoes: true, estoc: true }
if (est.v !== 2) { est.camadas = { ...LIMPO }; est.v = 2; localStorage.setItem('jarvis', JSON.stringify(est)) }
est.camadas = { ...LIMPO, ...(est.camadas || {}) }
const guardar = () => localStorage.setItem('jarvis', JSON.stringify(est))
const grafico = criarGrafico($('grafico'))
let radarLista = [], ultimoGrafico = null, ultimoPlano = null

// a janela do Jarvis abre grande (o Chrome deixa mexer no tamanho das janelas de app)
if (window.outerWidth < 1300) { try { window.resizeTo(Math.min(screen.availWidth, 1680), Math.min(screen.availHeight, 1050)); window.moveTo(screen.availLeft || 0, screen.availTop || 0) } catch {} }

// relógio e sessões, à hora de Lisboa
function relogio() {
  const agora = new Date(), h = +agora.toLocaleString('en-GB', { timeZone: LX, hour: '2-digit', hourCycle: 'h23' }), d = agora.toLocaleDateString('en-GB', { timeZone: LX, weekday: 'short' })
  // 22/10 («mete isto mais na minha cara»): as horas grandes, com os segundos, e por baixo a hora do gráfico dele (UTC-3)
  $('relogio').textContent = agora.toLocaleTimeString('pt-PT', { timeZone: LX, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  $('relogioGraf').textContent = agora.toLocaleTimeString('pt-PT', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  const fechado = d === 'Sat' || (d === 'Sun' && h < 22) || (d === 'Fri' && h >= 22)
  const abertas = [h >= 0 && h < 9 && 'Tóquio', h >= 8 && h < 17 && 'Londres', h >= 13 && h < 22 && 'Nova Iorque'].filter(Boolean)
  $('sessoes').textContent = fechado ? 'mercado fechado' : abertas.length ? abertas.join(' e ') + (abertas.length > 1 ? ' abertas' : ' aberta') : 'entre sessões'
  $('sessoes').classList.toggle('aberta', !fechado && abertas.length > 0)
}
setInterval(relogio, 1000); relogio()

function radar(l) {
  radarLista = l
  $('radarInfo').textContent = l.length ? 'às ' + hhmm(Date.now()) : 'a ler os pares'
  const txt = x => x.estado === 'entrar' ? '<span class="sobe">ENTRAR</span>' + esc(x.texto.slice(6)) : x.estado === 'mira' ? '<span class="areia">na mira</span>' + esc(x.texto.slice(7)) : esc(x.texto)
  // 22/10 («aqui mete um botão que diga carregar gráfico, menos no ouro; o ouro tem que estar sempre à mostra»): o ouro fica
  // sempre no topo da lista, preso ao deslizar, e é o gráfico de base; nos pares, o gráfico só muda com o botão
  const ord = [...l.filter(x => x.simbolo === 'XAUUSD'), ...l.filter(x => x.simbolo !== 'XAUUSD')]
  const botao = x => x.simbolo === 'XAUUSD' ? '' : x.simbolo === est.simbolo ? '<span class="carregar on">No gráfico</span>' : '<button class="carregar" data-s="' + x.simbolo + '">Carregar gráfico</button>'
  $('radar').innerHTML = ord.length ? ord.map(x => '<div class="par' + (x.simbolo === 'XAUUSD' ? ' ouro' : '') + (x.simbolo === est.simbolo ? ' ativo' : '') + '" data-s="' + x.simbolo + '"><span class="n">' + esc(x.nome) + '</span><span class="p num">' + fmt(x.px, casasTexto(x.simbolo))
    + ' <span class="' + (x.var24h >= 0 ? 'sobe' : 'desce') + '">' + (x.var24h >= 0 ? '+' : '') + fmt(x.var24h, 1) + '%</span></span><span class="e' + (x.simbolo === 'XAUUSD' ? ' toda' : '') + '">' + txt(x) + '</span>' + botao(x)
    + '<span class="barra"><i style="width:' + Math.round((1 - x.perto) * 100) + '%"></i></span></div>').join('')
    : '<div class="vazio">A ler o ouro e os 28 pares (uns segundos).</div>'
}
$('radar').addEventListener('click', e => {
  const b = e.target.closest('.carregar[data-s]'), p = e.target.closest('.par')
  if (b) selecionar(b.dataset.s)
  else if (p?.dataset.s === 'XAUUSD' && est.simbolo !== 'XAUUSD') selecionar('XAUUSD')   // o ouro volta com um clique na linha dele
})

// a tendência nos quatro tempos: a direção pela EMA 200 (e a terra de ninguém), o SV3 e o estocástico de cada um; por baixo,
// o Fibonacci de 4 h, o ATR de cada tempo e o horário de liquidez
function tendencia(t) {
  if (!t) { $('tendencia').innerHTML = '<div class="vazio">Sem leitura técnica para este símbolo agora.</div>'; return }
  const c = casasTexto(t.simbolo), ouro = t.simbolo === 'XAUUSD', nada = '<span class="suave">-</span>'
  const lado = l => l === 'compra' ? '<span class="sobe">compra</span>' : '<span class="desce">venda</span>'
  const sv3 = s => !s ? nada : s.estado === 'entrar' ? '<b class="' + (s.lado === 'venda' ? 'desce' : 'sobe') + '">ENTRAR</b> ' + esc(s.lado)
    : s.estado === 'mira' ? '<span class="areia">na mira</span> ' + esc(s.lado)
    : s.tend === 'desce' ? '<span class="desce">vende</span>' : s.tend === 'sobe' ? '<span class="sobe">compra</span>' : '<span class="suave">deitada</span>'
  const estoc = e => { if (!e) return nada; const k = Math.round(e.k), seta = e.antes == null ? '' : e.k > e.antes + 0.5 ? ' ↑' : e.k < e.antes - 0.5 ? ' ↓' : ''; return '<span class="num ' + (k >= 80 ? 'desce' : k <= 20 ? 'sobe' : '') + '">' + k + seta + '</span>' }
  const linhas = t.tempos.map(x => '<tr><td>' + x.nome + '</td><td>' + (x.tendencia ? lado(x.tendencia.lado) + (x.tendencia.terra ? ' <span class="terra">terra de ninguém</span>' : '') : nada)
    + '</td><td>' + sv3(x.sv3) + '</td><td>' + estoc(x.estoc) + '</td></tr>').join('')
  const f = t.fibo, a = t.atr || {}
  const fib = f ? '<div>Fibonacci de 4 h' + (f.provisorio ? ' (swing ainda a fazer-se)' : '') + ': ' + f.niveis.map(n => FIBO[n.r] + NB + '%' + NB + '<b class="num">' + fmt(n.p, c) + '</b>').join(' · ') + '</div>' : ''
  const atr = '<div>ATR: ' + ['15m', '1h', '4h', '1d'].filter(k => a[k]).map(k => TFN[k].replace(' ', NB) + NB + '<b class="num">' + (ouro ? fmt(a[k], 1) + NB + '$' : Math.round(a[k] / pipDe(t.simbolo)) + NB + 'pips') + '</b>').join(' · ') + '</div>'
  const lq = t.liquidez ? '<div>' + (t.liquidez.dentro ? 'Dentro do horário de liquidez, até às ' + t.liquidez.ate + '.' : 'Fora do horário de liquidez (' + t.liquidez.de + ' às ' + t.liquidez.ate + ').') + '</div>' : ''
  $('tendencia').innerHTML = '<table class="tend"><tr><th>Tempo</th><th>Direção</th><th>SV3</th><th>Estoc.</th></tr>' + linhas + '</table><div class="tnota">' + fib + atr + lq + '</div>'
}

// a força das divisas: barras cinzentas a partir do meio, o valor de 24 h com cor e o de 5 dias ao lado
function forca(f) {
  if (!f?.h24?.length) return
  const max = Math.max(0.05, ...f.h24.map(x => Math.abs(x.forca))), d5 = new Map((f.d5 || []).map(x => [x.moeda, x.forca])), sinal = v => (v >= 0 ? '+' : '') + fmt(v, 2) + '%'
  $('forca').innerHTML = f.h24.map(x => {
    const w = Math.round(50 * Math.abs(x.forca) / max), esq = x.forca >= 0 ? 50 : 50 - w
    return '<div class="m"><span class="n">' + x.moeda + '</span><span class="b"><i style="left:' + esq + '%;width:' + w + '%"></i></span><span class="v num ' + (x.forca >= 0 ? 'sobe' : 'desce') + '">' + sinal(x.forca)
      + '</span><span class="c num">' + (d5.has(x.moeda) ? sinal(d5.get(x.moeda)) : '') + '</span></div>'
  }).join('') + (f.par ? '<div class="sugere">O par a ver: <b data-s="' + f.par.simbolo + '">' + f.par.simbolo + '</b> (' + f.par.lado + ')' + (f.par.confirma5d ? ', também nos 5 dias.' : '; nos 5 dias, não.') + '</div>' : '')
}
$('forca').addEventListener('click', e => { const b = e.target.closest('b[data-s]'); if (b && b.dataset.s !== est.simbolo) selecionar(b.dataset.s) })

// as estratégias que ele mandou: o estado numa frase, os passos (✓ feito, ○ à espera, ✗ cancelou) e a medição
function estrategias(l) {
  const negrito = t => esc(t).replace(/(\d[\d\u00a0\u202f]*,\d+|\d{1,2}:\d\d)/g, '<b class="num">$1</b>')
  $('estrategias').innerHTML = l?.length ? l.map(e => '<div class="estr"><div class="en"><b>' + esc(e.nome) + '</b> <span class="suave">' + esc(e.autor) + '</span></div>'
    + '<div class="ee' + (e.sinal ? ' sinal' : '') + '">' + negrito(e.estado) + '</div>'
    + (e.passos || []).map(p => '<div class="ep ' + (p.ok ? 'ok' : p.aviso ? 'nao' : '') + '">' + (p.ok ? '✓' : p.aviso ? '✗' : '○') + ' ' + negrito(p.texto) + '</div>').join('')
    + (e.outro ? '<div class="ec">' + negrito(e.outro) + '</div>' : '') + (e.contexto ? '<div class="ec">' + negrito(e.contexto) + '</div>' : '') + (e.proxima && !e.sinal ? '<div class="ec">Próxima caixa: ' + esc(e.proxima) + '.</div>' : '')
    + (e.medicao ? '<div class="ec">' + negrito(e.medicao) + '</div>' : '') + '</div>').join('') : '<div class="vazio">Sem velas que cheguem para as ler.</div>'
}

// o plano de agora: vender ou comprar (ou esperar e porquê), a entrada, o stop e os alvos com o € de cada um, e o mesmo no gráfico
function plano(p, r) {
  const c = casasTexto(r.simbolo), e = v => fmt(v, 0) + NB + '€'
  $('planoVela').textContent = r.briefing.vela ? 'a vela fecha às ' + r.briefing.vela.lisboa + ' (' + r.briefing.vela.grafico + ' no teu gráfico)' : ''
  ultimoPlano = p?.acao && p.acao !== 'esperar' ? p : null
  grafico.plano(est.camadas.plano ? ultimoPlano : null)
  if (!p) { $('plano').innerHTML = '<div class="vazio">Sem plano.</div>'; return }
  // 24/10 («um de pausa e outro de mercado fechado, mas que ocupem esse tamanho do card»): sem entrada para fazer, o cartão
  // inteiro diz porquê, à mesma altura da ordem: mercado fechado (quando abre e quanto falta) ou em pausa (o lado e a linha)
  const fechado = /^mercado fechado/.test(semVelas()), diaria = /^pausa diária/.test(semVelas())
  if (fechado || diaria || (p.acao !== 'esperar' && !p.agora)) { $('plano').innerHTML = ordemParada(p, r, fechado, diaria); return }
  if (p.acao === 'esperar') { $('plano').innerHTML = '<div class="acao esperar">ESPERAR</div><div class="pq">' + esc(p.porque) + '</div>'; return }
  // 22/10 («mete isto bacano, tem que se ver bem»): a ação num bloco com a cor do lado; os níveis numa escada pela ordem
  // do preço, como no gráfico, com o preço de agora no sítio dele; como entrar e o que fazer no alvo 1 por baixo
  const venda = p.acao === 'vender', px = r.analise?.px
  const niveis = [
    { nome: 'Stop', preco: p.sl, d: p.risco ? '-' + e(p.risco.eur) : '', cl: 'st' },
    { nome: 'Entrada', preco: p.entrada, d: p.agora ? 'já' : 'na linha', cl: 'en' },
    { nome: 'Alvo 1', preco: p.tp1, d: (p.ganho1 != null ? '+' + e(p.ganho1) + ' · ' : '') + fmt(p.rr1, 1) + '×', cl: 'al' },
    { nome: 'Alvo 2', preco: p.tp2, d: (p.ganho2 != null ? '+' + e(p.ganho2) + ' · ' : '') + fmt(p.rr2, 1) + '×', cl: 'al' },
    ...(px != null ? [{ nome: 'Agora', preco: px, d: '', cl: 'ag' }] : [])
  ].sort((a, b) => b.preco - a.preco)
  // 23/10 («se não há nenhuma entrada isto deveria estar em pausa»): enquanto espera a linha, o cartão fica em pausa, a
  // cinzento, com o lado e a linha escritos por baixo; os níveis ficam apagados até ser para entrar
  const pausa = !p.agora
  $('plano').innerHTML = '<div class="acaoBloco ' + (pausa ? 'pausa' : venda ? 'vender' : 'comprar') + '"><div class="acao">' + (pausa ? 'EM PAUSA' : venda ? 'VENDER' : 'COMPRAR') + '</div><div class="sub">'
    + (pausa ? 'sem entrada agora · ' + (venda ? 'vende' : 'compra') + ' só se tocar a ' + (venda ? 'vermelha' : 'verde') + ' (' + fmt(p.entrada, c) + ')'
      : (venda ? 'short' : 'long') + ', entrar já' + (p.risco ? ' · arriscas ' + e(p.risco.eur) + ' com ' + fmt(p.risco.lote, 2) + ' lotes' : '')) + '</div></div>'
    + '<div class="escada' + (pausa ? ' apagada' : '') + '">' + niveis.map(n => '<div class="deg ' + n.cl + '"><i></i><span class="n">' + n.nome + '</span><b class="num">' + fmt(n.preco, c) + '</b><span class="d">' + n.d + '</span></div>').join('') + '</div>'
    // 24/10 («faz com que caibam sem scroll»): como entrar, o alvo 1 e o porquê ficam fechados, a um toque
    + '<details class="mais comoEntrar"><summary>Como entrar e porquê</summary><div class="nota"><b>Como entrar:</b> ' + esc(p.entradaTexto) + '</div>'
    + (p.gestao ? '<div class="nota"><b>No alvo 1:</b> ' + esc(p.gestao.replace(/^No alvo 1 /, '')) + '</div>' : '')
    + '<div class="pq">' + esc(p.porque) + '</div></details>'
}

// 22/10 («quero que esta parte do Agora fique bacana e apelativa para ler e perceber»): a barra de onde está o preço entre
// o suporte e o teto, os dois cenários do «se fechar», e o SV3 e a atenção em destaque. Os números vêm do servidor (resumo,
// campo d); as linhas sem eles ficam em texto. A direção em grande («VENDA em todos os tempos») saiu a 23/10, a pedido dele.
function agoraVisual(l, c) {
  const de = k => l.find(x => x.rotulo === k), f = v => fmt(v, c), cl = lado => lado === 'venda' ? 'desce' : 'sobe'
  const out = [], onde = de('Onde está'), se = de('Se fechar'), sv = de('SV3'), at = de('Atenção')
  if (onde?.d && onde.d.s1 != null && onde.d.r1 != null && onde.d.r1 > onde.d.s1) {
    const { px, s1, r1 } = onde.d, pos = Math.max(0, Math.min(100, (px - s1) / (r1 - s1) * 100))
    out.push('<div class="ag-bloco"><div class="ag-rot">Onde está</div><div class="ag-px num">' + f(px) + '</div><div class="ag-faixa"><i style="left:' + pos.toFixed(1) + '%"></i></div>'
      + '<div class="ag-pontas num"><span class="sobe">suporte ' + f(s1) + '</span><span class="desce">teto ' + f(r1) + '</span></div></div>')
  } else if (onde) out.push('<div class="ag-bloco"><div class="ag-rot">Onde está</div><div class="ag-txt">' + esc(onde.texto) + '</div></div>')
  if (se?.d && (se.d.acima || se.d.abaixo)) {
    const cen = (x, cima) => x ? '<div class="ag-cen ' + (cima ? 'sobe' : 'desce') + '"><span class="ag-cen-t">' + (cima ? '▲ fecha acima de' : '▼ fecha abaixo de') + '</span><b class="num">' + f(x.nivel) + '</b>'
      + '<span class="ag-cen-t">' + (x.alvo != null ? 'pode ir a' : 'sem nível perto') + '</span>' + (x.alvo != null ? '<b class="num">' + f(x.alvo) + '</b>' : '') + '</div>' : ''
    out.push('<div class="ag-bloco"><div class="ag-rot">Se a vela de 15 min fechar</div><div class="ag-cens">' + cen(se.d.acima, true) + cen(se.d.abaixo, false) + '</div></div>')
  } else if (se) out.push('<div class="ag-bloco"><div class="ag-rot">Se fechar</div><div class="ag-txt">' + esc(se.texto) + '</div></div>')
  if (sv?.d) {
    const d = sv.d, entrar = d.estado === 'entrar'
    out.push('<div class="ag-bloco"><div class="ag-rot">SV3</div><div class="ag-sv3' + (entrar ? ' entrar' : '') + '"><span class="' + cl(d.lado) + '">' + (entrar ? 'ENTRAR em ' + d.lado : d.estado === 'mira' ? 'Na mira para ' + d.lado : 'Espera ' + d.lado + ' na ' + d.linha) + '</span>'
      + '<b class="num">' + f(d.preco) + '</b>' + (entrar ? '' : '<span class="suave">a ' + esc(d.dist) + '</span>') + '</div></div>')
  } else if (sv) out.push('<div class="ag-bloco"><div class="ag-rot">SV3</div><div class="ag-txt">' + esc(sv.texto) + '</div></div>')
  if (at) out.push('<div class="ag-atencao">' + esc(at.texto) + '</div>')
  for (const x of l) if (!['Direção', 'Onde está', 'Se fechar', 'SV3', 'Atenção'].includes(x.rotulo)) out.push('<div class="ag-bloco"><div class="ag-rot">' + esc(x.rotulo) + '</div><div class="ag-txt">' + esc(x.texto) + '</div></div>')
  return '<div class="agora">' + out.join('') + '</div>'
}

function analise(r) {
  if (!r || r.simbolo !== est.simbolo) return
  plano(r.plano, r)
  tendencia(r.tecnica)
  estrategias(r.tecnica?.estrategias)
  const a = r.analise, c = casasTexto(r.simbolo)
  $('gNome').textContent = a?.nome || r.simbolo
  $('gPx').textContent = a ? fmt(a.px, c) : ''
  $('gVar').textContent = a ? (a.var24h >= 0 ? '+' : '') + fmt(a.var24h, 1) + '% em 24 h' : ''
  $('gVar').className = 'num ' + (a && a.var24h >= 0 ? 'sobe' : 'desce')
  $('vela').textContent = r.briefing.vela ? 'a vela de 15 min fecha às ' + r.briefing.vela.lisboa : ''
  // primeiro o resumo (os números a negrito), depois a análise toda, fechada até ele a abrir
  const negrito = t => esc(t).replace(/(\d[\d\u00a0\u202f]*,\d+|\d{1,2}:\d\d)/g, '<b class="num">$1</b>')
  // 24/10: o «Ver tudo» (a análise inteira, fechada) saiu a pedido dele; fica só o resumo
  ultimaR = r
  $('brief').innerHTML = r.resumo?.length === 1 && r.resumo[0].rotulo === 'Mercado' ? mercadoFechado(r) : r.resumo?.length ? agoraVisual(r.resumo, casasTexto(r.simbolo)) : ''
  const nome = r.simbolo === 'XAUUSD' ? 'ouro' : r.simbolo
  $('noticias').innerHTML = r.setas.length ? r.setas.map(x => '<div class="noticia"><div class="q"><span class="num">' + diaHora(x.quando) + '</span><span class="chip ' + (x.dir > 0 ? 'sobe">▲' : 'desce">▼') + x.grau + ' ' + esc(r.simbolo) + '</span></div><div class="tx">' + esc(x.texto) + '</div>' + (x.porque ? '<div class="pq">' + esc(x.porque) + '</div>' : '') + depoisTxt(x.depois, r.simbolo) + '</div>').join('')
    : '<div class="vazio">Sem setas para ' + esc(nome) + ' nos últimos 3 dias.</div>'
  // 22/10 («mete tipo assim», com o cartão «Próximos eventos» do Orca): cada evento numa caixa, com a moeda, o nome, o
  // previsto e a hora; os fortes a rosa. A próxima vai também na barra de cima
  const diaH = ms => { const d = diaDe(ms); return (d === diaDe(Date.now()) ? '' : d === diaDe(Date.now() + 864e5) ? 'amanhã ' : d + ' ') + hhmm(ms).replace(':', 'h') }
  const evento = e => '<span class="evento' + (e.impacto === 'High' ? ' forte' : '') + '"><b class="moeda">' + esc(e.moeda) + '</b><span class="tt">' + esc(e.titulo) + '</span>'
    + (e.previsao ? '<span class="prev">previsto ' + esc(e.previsao) + '</span>' : '') + '<b class="hora num">' + diaH(e.quando) + '</b></span>'
  // 24/10: a grelha do mês (mesCalendario) saiu a pedido dele («mete o anterior, não o das datas»); ficam os eventos
  $('calendario').innerHTML = (r.proximas.length ? '<div class="eventos">' + r.proximas.map(evento).join('') + '</div>' : '<div class="vazio">Nada de médio ou forte para estas moedas esta semana.</div>')
  const p = r.proximas[0]
  $('proxima').innerHTML = p ? evento(p) : ''
}

const planoTexto = l => { const out = []; for (const x of l) { const u = out[out.length - 1]; if (u && u.l === x) u.n++; else out.push({ l: x, n: 1 }) } return out.map(o => (o.n > 1 ? o.n + ' × ' : '') + fmt(o.l, 2)).join(' + ') }
function conta(c) {
  if (!c || (!c.online && !c.conta)) {
    $('conta').innerHTML = '<div class="linha"><span>Robô do ouro</span><span>' + esc(c?.texto || 'sem notícias') + '</span></div>'
    $('topoRobo').innerHTML = 'Robô <b>sem notícias</b>'; $('topoConta').textContent = ''
    return
  }
  // 24/10 («acho que isto poderia estar mais bem conseguido»): o risco em cima, com o número grande e a barra; por baixo, a
  // conta, as posições, o robô e o dia em quatro quadrados; o plano dos lotes numa linha pequena no fim. Conta a 0 € fica a rosa
  const pct = Math.min(100, Math.round(100 * c.risco / c.limite)), din = c.equity ?? c.saldo
  const quad = (n, v, cl = '') => '<div class="quad"><span class="n">' + n + '</span><b class="' + cl + '">' + v + '</b></div>'
  const pos = c.posicoes.length ? c.posicoes.map(p => esc(p.lado) + ' ' + fmt(p.lotes, 2) + ' <span class="num ' + (p.lucro >= 0 ? 'sobe' : 'desce') + '">' + (p.lucro >= 0 ? '+' : '') + fmt(p.lucro, 2) + ' €</span>' + (p.sl > 0 ? '' : ' <span class="desce">sem stop</span>')).join('<br>') : 'nenhuma'
  $('conta').innerHTML = '<div class="riscoBloco"><div class="rl"><span>Stops abertos</span><b class="num">' + fmt(c.risco, 0) + ' €<small> de ' + c.limite + ' €</small></b></div>'
    + '<div class="risco"><i style="width:' + pct + '%"></i></div>' + (c.semStop ? '<div class="desce rsem">' + c.semStop + ' sem stop</div>' : '') + '</div>'
    + '<div class="quads">'
    + quad('Conta ' + esc(c.conta), fmt(din, 2) + ' €' + (din <= 0 ? '<small>sem saldo</small>' : c.credito ? '<small>saldo ' + fmt(c.saldo, 2) + ' + crédito ' + fmt(c.credito, 2) + '</small>' : ''), 'num' + (din <= 0 ? ' desce' : ''))
    + quad('Posições', pos)
    + quad('Robô do ouro', (c.online ? 'ligado' : 'calado') + '<small>' + (c.real ? 'a sério' : 'em teste') + (c.auto ? '' : ', entradas desligadas') + '</small>', c.online ? 'sobe' : '')
    + quad('Hoje', c.dia ? c.dia.n + (c.dia.n === 1 ? ' entrada' : ' entradas') + (c.dia.perda ? '<small class="desce">parado por perda</small>' : '') : '-')
    + '</div>'
    + (c.plano ? '<div class="planoLotes">Plano dos lotes <span class="num">' + planoTexto(c.plano.lotes) + ' · passo ' + fmt(c.plano.passo, 0) + ' $</span></div>' : '')
  $('topoRobo').innerHTML = 'Robô <b>' + (c.online ? (c.real ? 'ligado, a sério' : 'ligado, em teste') : 'calado') + '</b>'
  $('topoConta').innerHTML = 'Conta MT5 <b class="num">' + fmt(din, 2) + ' €</b>'
}

function maquina(m) {
  const el = $('maquina')
  if (!m?.disponivel) { el.innerHTML = '<div class="t1">Máquina do tempo</div><div class="t2"><div>' + esc(m?.texto || 'a medir') + '</div></div>'; return }
  const nome = { teto: 'venda no teto', sv3: 'SV3', pico: 'venda depois do pico', incrivel: 'INCRÍVEL' }[m.sinal.tipo] || m.sinal.tipo
  el.innerHTML = '<div class="t1">Máquina do tempo · ' + esc(nome) + (nome.includes(m.sinal.lado) ? '' : ' (' + esc(m.sinal.lado) + ')') + ' a <span class="num">' + fmt(m.sinal.entrada, 1) + '</span>, stop <span class="num">' + fmt(m.sinal.sl, 1) + '</span></div>'
    + '<div class="t2">' + m.linhas.map(l => '<div>' + esc(l.replace(/^• /, '')) + '</div>').join('') + '</div>'
    + '<div class="ver"><b class="' + (m.entra ? 'sobe' : 'desce') + '">' + (m.entra ? 'ENTRA' : 'NÃO ENTRA') + '</b>' + ({ robo: 'pelo histórico do robô', todos: 'por todas as vezes do sinal', simulacoes: 'pelas simulações' }[m.por] || '') + '</div>'
}

// 24/10 («acho que isto poderia estar mais bem conseguido»): a mesma observação repetida (o ouro a entrar e sair da mesma
// zona de minuto a minuto, com os números a mexer uma décima) fica numa linha só, com quantas vezes e desde quando; os dias
// vão em títulos (Hoje, Ontem, 22/10) e cada linha leva só a hora
let obsLista = []
const obsChave = o => (o.tipo || '') + '|' + String(o.texto).replace(/[\d\s\u00a0\u202f.,]+/g, '#')
function obsGrupos(L) {
  // junta à mesma linha as iguais da última hora, mesmo com outras pelo meio (a zona e o suporte iam alternando)
  const G = [], aberto = new Map()
  for (const o of L) {
    const k = obsChave(o), g = aberto.get(k)
    if (g && diaDe(g.de) === diaDe(o.t) && g.de - o.t < 3600e3) { g.n++; g.de = o.t }
    else { const n = { ...o, chave: k, n: 1, de: o.t }; G.push(n); aberto.set(k, n) }
  }
  return G
}
function pintarObs() {
  if (!obsLista.length) { $('obs').innerHTML = '<div class="vazio">Ainda nada. Aqui aparece o que for acontecendo.</div>'; return }
  const hoje = diaDe(Date.now()), ontem = diaDe(Date.now() - 864e5)
  let dia = null, h = ''
  for (const g of obsGrupos(obsLista)) {
    const d = diaDe(g.t)
    if (d !== dia) { dia = d; h += '<div class="obsDia">' + (d === hoje ? 'Hoje' : d === ontem ? 'Ontem' : d) + '</div>' }
    h += '<div class="o ' + (g.nivel || 'info') + '"><span class="h num">' + hhmm(g.t) + '</span><span><span class="tx">' + esc(g.texto) + '</span>'
      + (g.n > 1 ? '<span class="rep num">' + g.n + ' vezes desde as ' + hhmm(g.de) + '</span>' : '') + '</span></div>'
  }
  $('obs').innerHTML = h
}
function observacoes(l) { obsLista = [...l].sort((a, b) => b.t - a.t); pintarObs() }
function observacao(o) { obsLista = [o, ...obsLista].slice(0, 200); pintarObs() }

const OPCOES = [['voz', 'Avisos com voz'], ['robo', 'Controlar o robô'], ['ordens', 'Ordens com o meu «sim»'], ['ordensPares', 'Ordens nos pares (em breve)']]
// 23/10 (revisão de design): cada opção é um interruptor a sério (botão com role="switch"), que também se usa pelo teclado
function opcoes(o) { $('opcoes').innerHTML = OPCOES.map(([k, t]) => '<button type="button" class="opcao" role="switch" aria-checked="' + !!o[k] + '" data-k="' + k + '"' + (k === 'ordensPares' ? ' disabled' : '') + '>' + t + ' <span class="sw' + (o[k] ? ' on' : '') + '" aria-hidden="true"></span></button>').join('') }
$('opcoes').addEventListener('click', async e => {
  const l = e.target.closest('[data-k]')
  if (!l || l.disabled) return
  try { opcoes(await post('opcoes', { chave: l.dataset.k, valor: l.getAttribute('aria-checked') !== 'true' })) } catch (err) { observacao({ t: Date.now(), nivel: 'atencao', texto: 'Opções: ' + err.message }) }
})

function mensagem(quem, texto, guardarMsg = true) {
  const d = document.createElement('div')
  d.className = 'msg ' + quem
  d.innerHTML = '<div class="q">' + (quem === 'eu' ? 'tu' : 'MULASOCIETY') + '</div><div class="c"></div>'
  d.querySelector('.c').innerHTML = esc(texto).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')   // o Jarvis às vezes põe negritos
  $('conversa').append(d); $('conversa').scrollTop = 1e9
  if (guardarMsg) { est.conversa = [...est.conversa, { quem, texto }].slice(-30); guardar() }
  return d
}
$('pergunta').addEventListener('submit', async e => {
  e.preventDefault()
  const t = $('texto').value.trim(), b = $('pergunta').querySelector('button')
  if (!t || b.disabled) return
  $('texto').value = ''; b.disabled = true
  mensagem('eu', t)
  const espera = mensagem('jv', 'a pensar…', false)
  try { const r = await post('conversa', { texto: t }); espera.remove(); mensagem('jv', r.texto) }
  catch (err) { espera.remove(); mensagem('jv', 'Não consegui: ' + err.message) }
  b.disabled = false
})

$('brief').addEventListener('toggle', e => { if (e.target.tagName === 'DETAILS') { est.detalhes = e.target.open; guardar() } }, true)

function marcar() {
  for (const s of document.querySelectorAll('.legenda [data-c]')) s.style.display = est.camadas[s.dataset.c] ? '' : 'none'
  $('legEma').textContent = 'EMA 200 ' + (est.tf === '1d' ? 'do diário' : 'de ' + TFN[est.tf])
  for (const s of $('tfs').children) { const on = s.dataset.tf === est.tf; s.classList.toggle('on', on); s.setAttribute('aria-pressed', on) }
  for (const s of $('camadas').children) { const on = !!est.camadas[s.dataset.c]; s.classList.toggle('on', on); s.setAttribute('aria-pressed', on) }
  escolhaEstr()
  mAtualizar()
}
// 24/10 («mete as estratégias mesmo, e eu seleciono para ver só aquela»): uma lista na barra das camadas; a escolhida
// mostra as entradas dela no gráfico (seta do lado, ✓ se chegou a um TP, ✗ se foi ao stop). Nenhuma = nada
// 25/10 («a possibilidade de meter as que eu quiser selecionadas»): várias ao mesmo tempo. A linha «ZIMBA FX: todas juntas»
// (id edney) liga e desliga as três dele; fica ligada quando as três estão. O select escondido só guarda os nomes
const JUNTAS = { edney: ['liquidez', 'choch', 'orderblock'] }
const estrEscolhidas = () => [...new Set((est.estrVer || []).flatMap(v => JUNTAS[v] || [v]))]
est.estrVer = estrEscolhidas()
function nomeEstr() {
  const l = estrEscolhidas(), nomes = Object.fromEntries([...$('estrSel').options].filter(o => o.value).map(o => [o.value, o.text.replace(/\s*\(.*\)$/, '')]))
  const curto = id => (nomes[id] || id).replace(/^ZIMBA FX: /, '')
  if (!l.length) return ''
  if (l.length === 3 && JUNTAS.edney.every(id => l.includes(id))) return 'ZIMBA FX: todas juntas'
  return l.length === 1 ? nomes[l[0]] || l[0] : l.length === 2 ? l.map(curto).join(' + ') : l.length + ' estratégias'
}
function escolhaEstr() {
  const el = $('estrSel'), ids = ultimoGrafico?.estrategias?.ids || []
  if (!ids.length) return
  const n = id => (ultimoGrafico.estrategias.lista || []).filter(x => (JUNTAS[id] || [id]).includes(x.id)).length
  const html = '<option value="">Estratégia: nenhuma</option>' + ids.flatMap(x => x.id === 'liquidez' ? [{ id: 'edney', nome: 'ZIMBA FX: todas juntas (liquidez, CHoCH e order block)' }, x] : [x]).map(x => '<option value="' + x.id + '">' + esc(x.nome) + ' (' + n(x.id) + ')</option>').join('')
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html }
  el.classList.toggle('on', estrEscolhidas().length > 0)
  mAtualizar()
}
function aplicarEstr() {
  guardar(); escolhaEstr(); mAtualizar()
  if (ultimoGrafico) grafico.mostrar(ultimoGrafico, { ...est.camadas, estrVer: est.estrVer })
}
$('estrSel').addEventListener('change', e => { est.estrVer = e.target.value ? JUNTAS[e.target.value] || [e.target.value] : []; aplicarEstr() })
$('tfs').addEventListener('click', e => { const t = e.target.dataset.tf; if (!t || t === est.tf) return; est.tf = t; guardar(); marcar(); carregarGrafico() })
$('camadas').addEventListener('click', e => { const c = e.target.dataset.c; if (!c) return; est.camadas[c] = !est.camadas[c]; guardar(); marcar(); if (ultimoGrafico) grafico.mostrar(ultimoGrafico, { ...est.camadas, estrVer: est.estrVer }); grafico.plano(est.camadas.plano ? ultimoPlano : null) })

// o relógio da vela (22/10, «preciso do timer lá em cima de mudança de candle»): quanto falta para a vela do tempo escolhido
// fechar, a contar do início da última vela do gráfico (as de 4 h e do dia começam às 17:00 de Nova Iorque, como no MT5).
// Fica no canto de cima à direita do gráfico (onde ele marcou). Sem velas novas, diz porquê pela hora de Nova Iorque: a pausa
// diária do ouro (17:00 às 18:00 lá, 22:00 às 23:00 em Lisboa) ou o fim de semana (de sexta às 17:00 a domingo às 18:00).
const DURACAO = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }
let fimVela = null
const horaEm = (zona, d = new Date()) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zona, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d).map(x => [x.type, x.value])); return { dia: p.weekday, h: +p.hour % 24, m: +p.minute } }
// 24/10 («podia estar mais bem conseguido», o «Mercado: Fechado.» do Agora): com o mercado fechado, o Agora diz quando abre
// e quanto falta, e o último preço com a variação da semana em 24 h
function reabreEm() {
  for (let t = Math.ceil(Date.now() / 60e3) * 60e3, fim = t + 4 * 864e5; t < fim; t += 60e3) { const ny = horaEm('America/New_York', new Date(t)); if (ny.dia === 'Sun' && ny.h === 18 && ny.m === 0) return t }
  return null
}
setInterval(() => { if (ultimaR && $('brief').querySelector('.mf')) $('brief').innerHTML = mercadoFechado(ultimaR) }, 30e3)
// 24/10: o que o preço fez na hora a seguir à notícia («subiu 12,4 pips na hora a seguir»), e se a seta acertou
function depoisTxt(d, simbolo) {
  if (!d) return ''
  const n = Math.abs(d.mov), u = simbolo === 'XAUUSD' ? ' pips' : '', q = d.min >= 60 ? 'na hora a seguir' : 'nos ' + d.min + ' min a seguir'
  const t = n < 0.5 ? 'Quase não mexeu ' + q : (d.mov > 0 ? 'Subiu ' : 'Desceu ') + fmt(n, 1) + u + ' ' + q
  return '<div class="depois ' + (n < 0.5 ? '' : d.mov > 0 ? 'sobe' : 'desce') + '">' + t + (d.acertou === true ? ' · a seta acertou' : d.acertou === false ? ' · a seta falhou' : '') + '</div>'
}
function ordemParada(p, r, fechado, diaria) {
  const c = casasTexto(r.simbolo), px = r.analise?.px, t = fechado ? reabreEm() : null, falta = t ? t - Date.now() : null
  const quanto = falta != null ? (falta >= 3600e3 ? Math.floor(falta / 3600e3) + ' h ' : '') + Math.floor(falta % 3600e3 / 60e3) + ' min' : null
  const venda = p.acao === 'vender', linha = p.acao !== 'esperar' && p.entrada != null && !(px != null && Math.abs(p.entrada - px) < 0.1)
  const tit = fechado ? 'Mercado fechado' : 'Em pausa'
  const sub = fechado ? semVelas().replace(/^mercado fechado, /, '') : diaria ? semVelas().replace(/^pausa diária, /, '') : 'sem entrada agora'
  const linhas = [
    ...(quanto ? [['Falta', quanto]] : []),
    ...(px != null ? [[fechado ? 'Último preço' : 'Agora', fmt(px, c)]] : []),
    ...(linha ? [[(venda ? 'Vende' : 'Compra') + ' se tocar', fmt(p.entrada, c)]] : []),
    ...(linha && px != null ? [['Distância', fmt(Math.abs(p.entrada - px), 1) + (r.simbolo === 'XAUUSD' ? ' pips' : '')]] : [])]
  return '<div class="ordemParada ' + (fechado ? 'fechado' : 'pausa') + '"><div class="op-est">' + tit + '</div><div class="op-sub">' + esc(sub) + '</div>'
    + '<div class="op-lin">' + linhas.map(([n, v]) => '<div><span>' + esc(n) + '</span><b class="num">' + v + '</b></div>').join('') + '</div></div>'
}
setInterval(() => { if (ultimaR && $('plano')?.querySelector('.ordemParada.fechado')) plano(ultimaR.plano, ultimaR) }, 30e3)
function mercadoFechado(r) {
  const t = reabreEm(), a = r.analise, c = casasTexto(r.simbolo), falta = t ? t - Date.now() : null
  const h = falta != null ? Math.floor(falta / 3600e3) : null, m = falta != null ? Math.floor(falta % 3600e3 / 60e3) : null
  const pausa = /pausa/.test(semVelas())
  return '<div class="mf"><div class="mf-rot">Mercado</div><div class="mf-est">' + (pausa ? 'Em pausa' : 'Fechado') + '</div>'
    + '<div class="mf-sub">' + esc(semVelas().replace(/^mercado fechado, /, '').replace(/^pausa diária, /, '')) + (h != null && !pausa ? ' · daqui a <b class="num">' + (h ? h + ' h ' : '') + m + ' min</b>' : '') + '</div>'
    + (a ? '<div class="mf-px"><span class="suave">Último preço</span><b class="num">' + fmt(a.px, c) + '</b><span class="num ' + (a.var24h >= 0 ? 'sobe' : 'desce') + '">' + (a.var24h >= 0 ? '+' : '') + fmt(a.var24h, 1) + '%</span></div>' : '') + '</div>'
}
function semVelas() {
  const ny = horaEm('America/New_York'), lx = horaEm('Europe/Lisbon'), dif = ((lx.h - ny.h + 24) % 24)
  const as18 = String((18 + dif) % 24).padStart(2, '0') + ':00'   // as 18:00 de Nova Iorque na hora de Lisboa
  if (ny.dia === 'Sat' || (ny.dia === 'Fri' && ny.h >= 17) || (ny.dia === 'Sun' && ny.h < 18)) return 'mercado fechado, abre domingo às ' + as18
  if (ny.h === 17) return 'pausa diária, volta às ' + as18
  return 'sem velas novas'
}
setInterval(() => {
  const el = $('gTimer')
  if (!fimVela) { el.textContent = ''; return }
  const agora = Date.now() / 1000, dur = DURACAO[fimVela.tf]
  if (agora - fimVela.inicio > 2 * dur + 300) { el.textContent = semVelas(); el.classList.remove('quase'); return }
  let fim = fimVela.inicio + dur
  while (fim <= agora) fim += dur
  const s = Math.floor(fim - agora), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, '0')
  el.innerHTML = 'vela fecha em<b>' + (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + ss + '</b>'
  el.classList.toggle('quase', s <= 60)
}, 1000)

let graficoEm = 0
async function carregarGrafico() {
  try {
    const s = est.simbolo, tf = est.tf, d = await api('grafico?s=' + s + '&tf=' + tf)
    if (s !== est.simbolo || tf !== est.tf) return
    ultimoGrafico = d; grafico.mostrar(d, { ...est.camadas, estrVer: est.estrVer }); escolhaEstr(); graficoEm = Date.now()
    fimVela = d.velas.length ? { inicio: d.velas.at(-1).time, tf: d.tf } : null
  } catch (e) { console.warn('gráfico', e) }
}
const carregarMaquina = () => api('maquina?s=' + est.simbolo).then(maquina).catch(e => maquina({ disponivel: false, texto: 'A máquina do tempo não respondeu (' + e.message + ').' }))
async function carregar() {
  marcar()
  await Promise.allSettled([api('analise?s=' + est.simbolo).then(analise), carregarGrafico()])
}
async function selecionar(s) { est.simbolo = s; guardar(); radar(radarLista); maquina(null); await carregar() }

// em pausa (o botão do Orca), o ponto lá em cima diz «em pausa» em vez de «ligado»
let pausado = false
function ligar() {
  const ev = new EventSource('/api/eventos'), ponto = ok => { if (!pausado) $('ligacao').innerHTML = '<span class="ponto ' + (ok ? 'on' : 'erro') + '"></span>' + (ok ? 'ligado' : 'sem ligação') }
  ev.onopen = () => ponto(true)
  ev.onerror = () => ponto(false)
  ev.onmessage = e => {
    const { tipo, dados } = JSON.parse(e.data)
    if (tipo === 'analise' && dados.simbolo === est.simbolo) { analise(dados); carregarGrafico() }
    else if (tipo === 'radar') radar(dados)
    else if (tipo === 'conta') conta(dados)
    else if (tipo === 'obs') observacao(dados)
    else if (tipo === 'forca') forca(dados)
  }
}

// a entrada do amigo (o link partilhado, servidor/amigo.mjs): sem a conta, as opções e a conversa
const AMIGO = document.documentElement.classList.contains('amigo')
// os separadores do cartão da direita (22/10): lembra o último aberto; o amigo não tem a conversa
function aba(n) {
  // 22/10 («retira»): a conversa saiu do ecrã (o servidor continua a tê-la)
  if (n === 'conversa' || !document.querySelector('#separadores [data-aba="' + n + '"]')) n = 'agora'
  est.aba = n; guardar()
  for (const e of document.querySelectorAll('#separadores [data-aba], .abas .aba')) e.classList.toggle('on', e.dataset.aba === n)
  for (const e of document.querySelectorAll('#separadores [data-aba]')) e.setAttribute('aria-pressed', e.dataset.aba === n)
  if (n === 'macro') carregarMacro()
}
$('separadores').addEventListener('click', e => { const t = e.target.closest('[data-aba]'); if (t) aba(t.dataset.aba) })
aba(est.aba || 'agora')
for (const m of est.conversa) mensagem(m.quem, m.texto, false)
// tudo ao mesmo tempo: cada painel aparece quando a resposta dele chega
if (!AMIGO) ligar()
api('radar').then(radar, () => radar([]))
if (!AMIGO) api('conta').then(conta, () => conta(null))
api('observacoes').then(observacoes, () => observacoes([]))
if (!AMIGO) api('opcoes').then(opcoes, () => opcoes({}))
// lá em cima (23/10): o que os avisos do ouro davam com o lote dele desde o primeiro, como o quadro (o amigo não vê).
// Ao passar o rato («dizer com base no quê»): a regra de cada número, o que dava fechar tudo no TP1, no TP2 ou no TP3, e os
// avisos que ficaram fora da conta por terem saído com os avisos dele em pausa. Um quadro nosso, porque o title do sistema
// demorava e quase não se via.
function resultado(r) {
  if (!r) return
  const dia = new Date(r.desde * 1000).toLocaleDateString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit' })
  const sinal = x => (x >= 0 ? '+' : '-') + fmt(Math.abs(x), 0) + ' €', cor = x => x >= 0.5 ? ' sobe' : x <= -0.5 ? ' desce' : ''
  const linha = (nome, v, nota) => '<div class="l"><span>' + nome + '</span><b class="num' + cor(v) + '">' + sinal(v) + '</b>' + (nota ? '<i>' + nota + '</i>' : '') + '</div>'
  $('resultadoDica').innerHTML = r.avisos ? '<div class="tit"><span>Como se conta</span><span>' + fmt(r.lote, 2) + ' lotes</span></div>'
    + linha('Feitos', r.ganhos, 'com a regra: TP no TP3 e, no TP2, o stop passa para o TP1 (quem voltou ao TP1 conta o TP1)')
    + linha('Perdidos', -r.perdas, 'os que bateram no stop antes do TP2')
    + '<div class="tit"><span>Se fechasses tudo no mesmo TP</span><span>já com os stops</span></div>'
    + ['TP1', 'TP2', 'TP3'].map((n, i) => linha('Tudo no ' + n, r.porTP[i])).join('')
    + '<p>' + r.avisos + ' avisos que te chegaram desde ' + dia + (r.abertos ? ', ' + r.abertos + (r.abertos > 1 ? ' ainda abertos' : ' ainda aberto') : '') + '.</p>'
    + (r.pausa ? '<p>Fora da conta: ' + r.pausa.avisos + ' avisos que saíram com os teus avisos em pausa e não te chegaram (davam ' + sinal(r.pausa.ganhos)
      + (r.pausa.perdas >= 0.5 ? ' e ' + sinal(-r.pausa.perdas) : ', sem stops') + ').</p>' : '') : ''
  // 24/10 («podes meter isto noutro sítio ou arquiva»): o card das estratégias de TP fica arquivado (estrategiasTP); no lugar
  // dele, o placar de cada estratégia
  placarTP(r.placar)
  $('resultado').innerHTML = 'Desde ' + dia + ' com ' + fmt(r.lote, 2) + ': ' + (r.avisos
    ? '<b class="num sobe">+' + fmt(r.ganhos, 0) + ' €</b> feitos · <b class="num' + (r.perdas >= 0.5 ? ' desce">-' : '">') + fmt(r.perdas, 0) + ' €</b> perdidos'
    : '<b>ainda sem avisos</b>')
}
// 24/10 («faz aqui embaixo disto um card que tenha lá estratégia X, profit deu ou profit não, mas quantas vezes acertou; é
// para depois virmos qual é mais lucrativa»): por baixo do gráfico, os mesmos avisos fechados de quatro maneiras, em pips
// (1 pip = 1 $ no ouro, como no briefing). Vem com o /api/resultado; o amigo não o vê.
function placarTP(L) {
  const el = $('estrTP')
  if (!el || !L?.length) return
  ultimoPlacar = L
  const pct = (k, n) => n ? Math.round(100 * k / n) + '%' : '-'
  const pips = x => { const d = Math.round(Math.abs(x) * 10) / 10; return (x < 0 && d ? '-' : '+') + fmt(d, d % 1 ? 1 : 0) }
  const cor = x => x >= 0.5 ? ' sobe' : x <= -0.5 ? ' desce' : ''
  // 24/10 («preciso que o gráfico fique maior em termos verticais»): a tabela em duas colunas lado a lado (o BOT e os
  // filtros à esquerda, as outras à direita), para ocupar metade da altura; a descrição de cada uma passa ao passar o rato
  const linha = e => '<tr title="' + esc(e.autor) + '"><td><b>' + esc(e.nome).replace(/^BOT/, '<span class="ouro">BOT</span>').replace(/^ZIMBA FX/, '<span class="ouro laranja">ZIMBA FX</span>') + '</b></td><td class="num">' + (e.abertas ? '<span class="suave">a decorrer +' + e.abertas + '</span> ' : '') + e.n + '</td>'
    + e.tp.map(k => '<td class="num">' + pct(k, e.n) + '</td>').join('') + '<td class="num">' + pct(e.stop, e.n) + '</td>'
    + '<td class="num' + cor(e.pips) + '">' + (e.n ? pips(e.pips) : '-') + '</td></tr>'
  const tabela = l => '<table class="placar"><thead><tr><th>Estratégia</th><th>Entradas</th><th>TP1</th><th>TP2</th><th>TP3</th><th>Stop</th><th>Pips</th></tr></thead><tbody>' + l.map(linha).join('') + '</tbody></table>'
  const meio = Math.ceil(L.length / 2)
  el.innerHTML = '<div class="tit"><span>Estratégias</span><span>todas medidas igual desde 21/10 às 18:00, até 24 h cada</span></div>'
    + '<div class="placarDuas">' + tabela(L.slice(0, meio)) + tabela(L.slice(meio)) + '</div>'
  el.hidden = false
}
function estrategiasTP(E) {
  const el = $('estrTP')
  if (!el || !E?.lista?.length) return
  const quando = t => new Date(t * 1000).toLocaleString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ')
  const pips = x => { const d = Math.round(Math.abs(x) * 10) / 10; return (x < 0 && d ? '-' : '+') + fmt(d, d % 1 ? 1 : 0) + ' pips' }
  const melhor = Math.max(...E.lista.map(e => e.pips)), cor = x => x >= 0.5 ? ' sobe' : x <= -0.5 ? ' desce' : ''
  el.innerHTML = '<div class="tit"><span>Estratégias de TP</span><span>todos os avisos desde ' + quando(E.desde) + '</span></div><div class="lista">'
    + E.lista.map(e => '<div class="e' + (e.nossa ? ' nossa' : '') + '"><div class="n">' + esc(e.nome) + (e.nossa ? ' <i>a que seguimos</i>' : '') + '</div>'
      + '<b class="num' + cor(e.pips) + '">' + pips(e.pips) + '</b>'
      + '<div class="q">acertou ' + e.ganhou + ' de ' + (e.ganhou + e.perdeu) + (e.abertos ? ' · ' + e.abertos + (e.abertos > 1 ? ' abertos' : ' aberto') : '')
      + (E.lista.length > 1 && e.pips === melhor ? '<span class="sobe"> · a que mais deu</span>' : '') + '</div></div>').join('') + '</div>'
  el.hidden = false
}
if (!AMIGO) { api('resultado').then(resultado, () => {}); setInterval(() => { if (!pausado) api('resultado').then(resultado, () => {}) }, 60e3) }
// o amigo vê o placar das estratégias, sem a barra dos € dele
if (AMIGO) { const pl = () => api('placar').then(r => placarTP(r.placar), () => {}); pl(); setInterval(pl, 120e3) }
$('resultado').addEventListener('mouseenter', () => {
  const d = $('resultadoDica'), b = $('resultado').getBoundingClientRect()
  if (!d.innerHTML) return
  d.style.left = Math.max(8, b.left - 14) + 'px'; d.style.top = (b.bottom + 10) + 'px'; d.hidden = false
})
$('resultado').addEventListener('mouseleave', () => { $('resultadoDica').hidden = true })
api('forca').then(forca, () => {})
await carregar()
// o canal de eventos não passa pelo túnel rápido do link: na entrada do amigo vai-se buscar tudo de tempos a tempos
// o ecrã recarrega-se sozinho quando os ficheiros dele mudam (a versão vem no /api/ping); o ping diz também se está em pausa
const verPausa = q => {
  if (!!q.pausa === pausado) return
  pausado = !!q.pausa
  $('ligacao').innerHTML = pausado ? '<span class="ponto pausa"></span>em pausa' : '<span class="ponto on"></span>ligado'
}
// em pausa não chegam eventos: o gráfico (com as caixas dos avisos) e a barra de cima refazem-se de 2 em 2 min
api('ping').then(p => { const v0 = p.versao; verPausa(p); setInterval(() => api('ping').then(q => {
  if (q.versao && v0 && q.versao !== v0) location.reload()
  verPausa(q)
  if (pausado && Date.now() - graficoEm > 120e3) { carregarGrafico(); if (!AMIGO) api('resultado').then(resultado, () => {}) }
}, () => {}), 15e3) }, () => {})
if (AMIGO) {
  const estado = ok => { if (!pausado) $('ligacao').innerHTML = '<span class="ponto ' + (ok ? 'on' : 'erro') + '"></span>' + (ok ? 'ligado' : 'sem ligação') }
  estado(true)
  setInterval(() => { api('analise?s=' + est.simbolo).then(d => { estado(true); if (d.simbolo === est.simbolo) analise(d) }, () => estado(false)); carregarGrafico() }, 30e3)
  setInterval(() => { api('radar').then(radar, () => {}); api('forca').then(forca, () => {}); api('observacoes').then(observacoes, () => {}) }, 120e3)
}

// a grelha do mês de hoje (em Lisboa), de segunda a domingo
function mesCalendario(eventos = []) {
  const ymd = ms => new Date(ms).toLocaleDateString('en-CA', { timeZone: LX }), hoje = ymd(Date.now()), [A, M] = hoje.split('-').map(Number)
  const porDia = {}
  for (const e of eventos) { const d = ymd(e.quando); porDia[d] = porDia[d] === 'High' ? 'High' : e.impacto }
  const primeiro = new Date(Date.UTC(A, M - 1, 1)), dias = new Date(Date.UTC(A, M, 0)).getUTCDate(), vazio = (primeiro.getUTCDay() + 6) % 7
  const nomeMes = (m => m[0].toUpperCase() + m.slice(1))(primeiro.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' }))
  let h = '<div class="mes"><div class="mesNome">' + esc(nomeMes) + '</div><div class="grelhaMes">' + ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(d => '<span class="dsem">' + d + '</span>').join('')
  for (let i = 0; i < vazio; i++) h += '<span></span>'
  for (let d = 1; d <= dias; d++) {
    const k = A + '-' + String(M).padStart(2, '0') + '-' + String(d).padStart(2, '0'), fds = (vazio + d - 1) % 7 >= 5, ev = porDia[k]
    h += '<span class="dia' + (k === hoje ? ' hoje' : '') + (k < hoje ? ' passou' : '') + (fds ? ' fds' : '') + '">' + d + (ev ? '<i class="' + (ev === 'High' ? 'forte' : 'medio') + '"></i>' : '') + '</span>'
  }
  return h + '</div></div>'
}

// 24/10 («uma aba para termos o dólar e o petróleo, porque há uma estratégia em que estes dois confirmam a saída ou a entrada
// no ouro»): o preço, a variação de 24 h, a última hora e a linha das últimas 24 h de cada um, e em cima se confirmam o ouro.
// Lê ao abrir a aba e de minuto a minuto enquanto está aberta
function sparkMacro(L) {
  if (!L?.length) return ''
  const lo = Math.min(...L), hi = Math.max(...L), W = 120, H = 28, y = v => hi > lo ? H - 2 - (v - lo) / (hi - lo) * (H - 4) : H / 2
  return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="1.5" points="'
    + L.map((v, i) => (i * W / (L.length - 1)).toFixed(1) + ',' + y(v).toFixed(1)).join(' ') + '"/></svg>'
}
async function carregarMacro() {
  const m = await api('macro').catch(() => null), el = $('macro')
  if (!m) { el.innerHTML = '<div class="vazio">Não consegui ler o dólar e o petróleo. Tento outra vez daqui a um minuto.</div>'; return }
  const o = m.ouro, cl = { compra: 'sobe', venda: 'desce' }[o.estado] || 'areia'
  el.innerHTML = '<div class="mc-ouro ' + o.estado + '"><span class="mc-rot">Para o ouro</span><b class="' + cl + '">' + ({ compra: 'Confirmam compras', venda: 'Confirmam vendas', misto: 'Não confirmam', sem: 'Sem dados' }[o.estado]) + '</b><span class="mc-tx">' + esc(o.texto) + '</span></div>'
    + m.ativos.map(a => a.erro ? '<div class="mc-at"><div class="mc-n">' + esc(a.nome) + '</div><div class="vazio">Sem dados agora.</div></div>'
      : '<div class="mc-at"><div class="mc-l1"><span class="mc-n">' + esc(a.nome) + '</span><b class="num">' + fmt(a.px, a.casas) + '</b><span class="num ' + (a.var24h >= 0 ? 'sobe' : 'desce') + '">' + (a.var24h >= 0 ? '+' : '') + fmt(a.var24h, 2) + '% em 24 h</span></div>'
        + '<div class="mc-l2"><span class="' + (a.lado === 'sobe' ? 'sobe' : 'desce') + '">' + (a.lado === 'sobe' ? '▲ a subir' : '▼ a descer') + '</span><span class="suave num">' + (a.mov1h >= 0 ? '+' : '') + fmt(a.mov1h, a.casas) + ' na última hora' + (a.parado ? ' · mercado parado' : '') + '</span></div>'
        + '<div class="mc-sp">' + sparkMacro(a.spark) + '<span class="suave">últimas 24 h</span></div></div>').join('')
    + '<div class="mc-nota">O dólar a descer costuma empurrar o ouro para cima; o petróleo a subir costuma ir com ele. Direção pela EMA 50 de 15 min.</div>'
}
setInterval(() => { if (est.aba === 'macro') carregarMacro() }, 60e3)

let abrirFolha = () => {}
// 24/10 («vê como é o TradingView na app mobile»): no telemóvel é como a app deles. Cada painel ocupa o ecrã e muda-se nos
// separadores de baixo; no gráfico, uma barra fina de botões (tempo, camadas, estratégia) que abrem uma folha a subir de
// baixo, e a legenda por cima das velas. Os botões da folha carregam nos de sempre, por isso guardam e redesenham igual
const SVG = d => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'
function mAtualizar() {
  const b = $('mBarra'); if (!b) return
  b.querySelector('.tf .sub').textContent = TFN[est.tf] || est.tf
  const ne = nomeEstr()
  $('camBtnV').textContent = [...$('camadas').querySelectorAll('[data-c]')].filter(x => est.camadas[x.dataset.c]).length + ' ligadas'
  $('estrBtnV').textContent = ne || 'nenhuma'; $('estrBtn').classList.toggle('on', !!ne)
  b.querySelector('.estr .sub').textContent = ne || 'Estratégia'; b.querySelector('.estr').classList.toggle('on', !!ne)
  $('mLeg').innerHTML = '<b>' + esc($('gNome').textContent) + '</b> · ' + esc(TFN[est.tf] || est.tf) + ' &nbsp;<b class="num">' + esc($('gPx').textContent) + '</b> <span class="num ' + ($('gVar').className.includes('sobe') ? 'sobe' : 'desce') + '">' + esc($('gVar').textContent.replace(' em 24 h', '')) + '</span>'
    + ($('gTimer').textContent ? '<br><span class="estado">' + esc($('gTimer').textContent) + '</span>' : '')
}
{
  const P = { grafico: [$('grafico').closest('.card')], estrategias: [$('estrTP')], ordem: [$('plano').closest('.card')],
    analise: [document.querySelector('.card.abas'), $('calendario')?.closest('.card')], noticias: [document.querySelector('.card.noticias')] }
  for (const [k, l] of Object.entries(P)) for (const e of l) if (e) e.dataset.painel = k
  const mostrar = m => {
    document.body.dataset.m = m
    for (const b of $('mNav').children) { const on = b.dataset.m === m; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false') }
    if (m === 'grafico') dispatchEvent(new Event('resize'))
  }
  $('mNav').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { mostrar(b.dataset.m); est.mPainel = b.dataset.m; guardar() } })

  // a barra de cima do gráfico e a legenda
  const barra = document.createElement('div'); barra.className = 'mBarra'; barra.id = 'mBarra'
  barra.innerHTML = '<button type="button" class="tf" aria-label="Tempo das velas">' + SVG('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>') + '<span class="sub"></span></button><span class="div"></span>'
    + '<button type="button" class="cam" aria-label="Camadas">' + SVG('<path d="M12 4 3 9l9 5 9-5-9-5z"/><path d="m3 14 9 5 9-5"/>') + 'Camadas</button><span class="div"></span>'
    + '<button type="button" class="estr" aria-label="Estratégias no gráfico">' + SVG('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>') + '<span class="sub"></span></button><span class="div"></span>'
    + '<button type="button" class="cor" aria-label="Cor do gráfico">' + SVG('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>') + 'Cor</button>'
  $('grafico').closest('.card').prepend(barra)
  const leg = document.createElement('div'); leg.className = 'mLeg'; leg.id = 'mLeg'; $('grafico').append(leg)

  // a folha que sobe de baixo
  const folha = document.createElement('div'); folha.className = 'mFolha'; folha.setAttribute('role', 'dialog'); folha.setAttribute('aria-modal', 'true')
  folha.innerHTML = '<div class="mFundo"></div><div class="mCaixa"><div class="mPega"></div><div class="mTit"></div><div class="mLista"></div></div>'
  document.body.append(folha)
  const fechar = () => folha.classList.remove('aberta')
  folha.querySelector('.mFundo').addEventListener('click', fechar)
  addEventListener('keydown', e => { if (e.key === 'Escape') fechar() })
  let acao = null, multi = false, itens = () => []
  const desenhar = () => {
    folha.querySelector('.mLista').innerHTML = itens().map((x, k) => x.grupo != null ? '<div class="grupo">' + x.grupo + '</div>'
      : '<button type="button" data-k="' + k + '" class="' + (x.on ? 'on' : '') + '" aria-pressed="' + !!x.on + '">' + (x.amostra ? '<span class="amostra" style="background:' + x.amostra.bg + '"><i style="background:' + x.amostra.sobe + '"></i><i style="background:' + x.amostra.desce + '"></i></span>' : '') + '<span class="esq"><span>' + (x.nomeHtml || esc(x.nome)) + (x.n != null ? ' <span class="n">' + x.n + '</span>' : '') + '</span>' + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + '</span>'
      + '<span class="dir">' + (x.p != null ? '<span class="p' + (x.p >= 0.5 ? ' sobe' : x.p <= -0.5 ? ' desce' : '') + '">' + (x.p < 0 ? '-' : '+') + fmt(Math.abs(x.p), 1) + ' pips</span>' : '') + '<span class="' + (multi && !x.radio ? 'int' : 'marca-on') + '"></span></span></button>').join('')
  }
  const abrir = abrirFolha = (tit, f, fn, m, ancora) => {
    if (ancora) { const r = ancora.getBoundingClientRect(); folha.style.setProperty('--x', Math.min(r.left, innerWidth - 410) + 'px'); folha.style.setProperty('--y', r.bottom + 6 + 'px') }
    folha.querySelector('.mTit').textContent = tit; itens = f; acao = fn; multi = m; desenhar(); folha.classList.add('aberta') }
  folha.querySelector('.mLista').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return
    acao(itens()[+b.dataset.k]); mAtualizar()
    if (multi) desenhar(); else fechar()
  })
  barra.querySelector('.tf').addEventListener('click', () => abrir('Tempo das velas',
    () => [...$('tfs').children].map(b => ({ nome: b.textContent, on: b.dataset.tf === est.tf, b })), x => x.b.click(), false))
  // 24/10 («sinto que estas podiam estar melhores»): as camadas num menu como o da estratégia, por grupos e com o que é cada uma
  const CAM = [['Linhas e médias', { sv3: 'as três linhas: vermelha, cinzenta e verde', ema: 'EMA 200 e EMA 80', linhas: 'tendência, 4 h grossa e 1 h fina', fibo: 'Fibonacci de 4 h' }],
    ['Zonas', { niveis: 'suportes e resistências', diario: 'zonas do diário', asia: 'a caixa da sessão asiática' }],
    ['Entradas', { sinais: 'setas dos sinais do robô', velas: 'velas de confirmação', alvos: 'caixas até ao TP3 e ao stop', plano: 'entrada, stop e TP da ordem', posicoes: 'as posições abertas' }],
    ['Por baixo', { estoc: 'Estocástico 5,3,3' }]]
  const listaCam = () => CAM.flatMap(([g, d]) => [{ grupo: g }, ...Object.entries(d).map(([c, sub]) => { const b = $('camadas').querySelector('[data-c="' + c + '"]'); return b && { nome: b.textContent, sub, on: !!est.camadas[c], b } }).filter(Boolean)])
  barra.querySelector('.cam').addEventListener('click', () => abrir('Camadas no gráfico', listaCam, x => x.b.click(), true))
  $('camBtn').addEventListener('click', e => abrir('Camadas no gráfico', listaCam, x => x.b.click(), true, e.currentTarget))
  // a lista das estratégias por grupos, cada uma com o que fez desde 21/10 (o placar), as que mais deram primeiro
  const listaEstr = () => {
    const P = Object.fromEntries(ultimoPlacar.map(e => [e.id, e])), ops = [...$('estrSel').options].filter(o => o.value), l = estrEscolhidas()
    const item = o => { const e = P[o.value], m = o.text.match(/^(.*?)\s*\((\d+)\)$/), nome = (m ? m[1] : o.text).replace(/^ZIMBA FX: /, '')
      return { nome, nomeHtml: o.value === 'edney' ? '<span class="laranja">ZIMBA FX</span>: todas juntas' : null, v: o.value, on: (JUNTAS[o.value] || [o.value]).every(id => l.includes(id)), p: e?.n ? e.pips : null,
        sub: e ? (e.n ? e.n + (e.n === 1 ? ' entrada' : ' entradas') + ' desde 21/10 · TP1 ' + Math.round(100 * e.tp[0] / e.n) + '%' : 'sem entradas desde 21/10') : '',
        ordem: o.value === 'edney' ? 1e9 : e?.n ? e.pips : -1e9 } }
    const ed = ['edney', ...JUNTAS.edney], por = l => l.sort((a, b) => b.ordem - a.ordem)
    return [{ nome: 'Nenhuma', v: '', on: !l.length, radio: true }, { grupo: '<span class="ouro laranja">ZIMBA FX</span>' }, ...por(ops.filter(o => ed.includes(o.value)).map(item)),
      { grupo: 'Outras' }, ...por(ops.filter(o => !ed.includes(o.value)).map(item))]
  }
  // cada linha liga ou desliga a sua (a folha fica aberta para escolher mais); «Nenhuma» desliga todas
  const escolher = x => {
    const l = estrEscolhidas(), ids = JUNTAS[x.v] || [x.v]
    est.estrVer = !x.v ? [] : x.on ? l.filter(id => !ids.includes(id)) : [...new Set([...l, ...ids])]
    aplicarEstr()
  }
  barra.querySelector('.estr').addEventListener('click', () => abrir('Estratégias no gráfico', listaEstr, escolher, true))
  $('estrBtn').addEventListener('click', e => abrir('Estratégias no gráfico', listaEstr, escolher, true, e.currentTarget))
  new MutationObserver(mAtualizar).observe($('gPx'), { childList: true, characterData: true, subtree: true })
  new MutationObserver(mAtualizar).observe($('gTimer'), { childList: true, characterData: true, subtree: true })
  mostrar(est.mPainel || 'grafico'); mAtualizar()
}

// 24/10 («está desalinhado»): se as camadas não cabem na linha de cima, descem e alinham à esquerda
{
  const c = $('camadas'), t = $('tfs')
  const ver = () => { c.classList.remove('sozinha'); if (c.getBoundingClientRect().top >= t.getBoundingClientRect().bottom) c.classList.add('sozinha') }
  new ResizeObserver(ver).observe(c.parentElement); ver()
}

// 24/10 («caga no modo claro, mete só a opção do gráfico ser branco»; «mete mais opções tipo de cor»): o botão da barra
// de cima (e o «Cor» no telemóvel) escolhe a cor do gráfico entre cinco; só o cartão do gráfico muda, o resto do Jarvis
// fica escuro. Fica guardada. Na troca as transições desligam-se um instante, para mudar de uma vez
const TEMAS = [
  { id: 'escuro', nome: 'Escuro', sub: 'o de sempre, com as cores suaves', bg: '#16191c', sobe: '#9cb894', desce: '#cc9390' },
  { id: 'noite', nome: 'Noite', sub: 'o escuro do TradingView', bg: '#131722', sobe: '#26a69a', desce: '#ef5350' },
  { id: 'preto', nome: 'Preto e branco', sub: 'fundo preto, velas brancas e cinzentas', bg: '#000000', sobe: '#ececec', desce: '#6b6b6b' },
  { id: 'branco', nome: 'Branco', sub: 'o claro do TradingView', bg: '#ffffff', sobe: '#26a69a', desce: '#ef5350' },
  { id: 'papel', nome: 'Papel', sub: 'fundo creme, com as cores suaves', bg: '#f7f3ea', sobe: '#5d8a55', desce: '#b2625c' }
]
{
  const b = $('temaBtn'), html = document.documentElement
  try { localStorage.removeItem('jarvis-tema') } catch {}
  const aplicar = id => {
    const t = TEMAS.find(x => x.id === id) || TEMAS[0]
    if (t.id === 'escuro') delete html.dataset.graf; else html.dataset.graf = t.id
    b.innerHTML = 'Gráfico <b>' + esc(t.nome) + '</b>' + SVG('<path d="m7 10 5 5 5-5"/>')
    grafico.tema(t.id)
  }
  const escolher = x => {
    const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none !important}'; document.head.append(st)
    aplicar(x.id); try { localStorage.setItem('jarvis-grafico', x.id) } catch {}
    getComputedStyle(document.body).opacity; requestAnimationFrame(() => st.remove())
  }
  const lista = () => TEMAS.map(t => ({ id: t.id, nome: t.nome, sub: t.sub, on: (html.dataset.graf || 'escuro') === t.id, amostra: t }))
  b.addEventListener('click', e => abrirFolha('Cor do gráfico', lista, escolher, false, e.currentTarget))
  $('mBarra')?.querySelector('.cor')?.addEventListener('click', () => abrirFolha('Cor do gráfico', lista, escolher, false))
  let guardado = 'escuro'; try { guardado = localStorage.getItem('jarvis-grafico') || 'escuro' } catch {}
  aplicar(guardado)
}

