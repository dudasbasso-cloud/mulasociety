// O ecrã do Jarvis: lê a API do servidor, ouve o canal de eventos e desenha os painéis (radar, gráfico, máquina do tempo,
// observações, agora, conta, notícias, calendário, conversa e opções). Lembra o símbolo, o tempo e as camadas.
import { criarGrafico, numerosAviso } from './grafico.js?v=ea9f774249'

const CODIGO = document.querySelector('meta[name="jarvis-codigo"]').content
const $ = id => document.getElementById(id)
const NB = ' ', LX = 'Europe/Lisbon'
const fmt = (v, c = 1) => { if (v == null || Number.isNaN(+v)) return '-'; const s = Math.abs(v).toFixed(c).split('.'); return (v < 0 ? '-' : '') + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB) + (s[1] ? ',' + s[1] : '') }
const casasTexto = s => s === 'XAUUSD' ? 1 : /JPY/.test(s) ? 3 : 5
const pipDe = s => s === 'XAUUSD' ? 0.1 : /JPY/.test(s) ? 0.01 : 0.0001
let ultimoPlacar = []
const TFN = { '1s': '1 s', '15m': '15 min', '1h': '1 h', '4h': '4 h', '1d': 'dia' }, FIBO = { 0.382: '38,2', 0.5: '50', 0.618: '61,8' }
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
const grafico = criarGrafico($('grafico'), { pedirHistoria: (s, tf, ate) => api('historico?s=' + s + '&tf=' + tf + '&ate=' + ate) })
let radarLista = [], ultimoGrafico = null, ultimoPlano = null, fechado = false
// o lote e o câmbio do /api/resultado (os € dos avisos a decorrer) e o último preço que se lhes aplicou
let valorLote = null, pxAbertos = null

// a janela do Jarvis abre grande (o Chrome deixa mexer no tamanho das janelas de app)
if (window.outerWidth < 1300) { try { window.resizeTo(Math.min(screen.availWidth, 1680), Math.min(screen.availHeight, 1050)); window.moveTo(screen.availLeft || 0, screen.availTop || 0) } catch {} }

// 31/10 (desempenho): um formatador por fuso, feito uma vez; fazer um novo a cada chamada era o que custava
const FMT_HORA = new Map()
const horaEm = (zona, d = new Date()) => {
  let f = FMT_HORA.get(zona)
  if (!f) FMT_HORA.set(zona, f = new Intl.DateTimeFormat('en-US', { timeZone: zona, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }))
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value])); return { dia: p.weekday, h: +p.hour % 24, m: +p.minute }
}
// o fim de semana do ouro, pela hora de Nova Iorque: de sexta às 17:00 a domingo às 18:00
const fimDeSemana = ny => ny.dia === 'Sat' || (ny.dia === 'Fri' && ny.h >= 17) || (ny.dia === 'Sun' && ny.h < 18)

// relógio e sessões, à hora de Lisboa
// 31/10: cada sessão pela hora da sua cidade (das 9 às 18 em Tóquio, das 8 às 17 em Londres e em Nova Iorque) e o mercado
// fechado pelo fimDeSemana, como no gráfico. Com as horas fixas de Lisboa, ao domingo o mercado «abria» às 22:00 e não às
// 23:00, Tóquio ficava uma hora ao lado todo o verão e, nas semanas em que só um dos lados muda a hora, Nova Iorque também.
// Os formatadores fazem-se uma vez, porque isto corre a cada segundo
const FMT_RELOGIO = new Intl.DateTimeFormat('pt-PT', { timeZone: LX, hour: '2-digit', minute: '2-digit', second: '2-digit' })
const FMT_GRAF = new Intl.DateTimeFormat('pt-PT', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
function relogio() {
  const agora = new Date(), ny = horaEm('America/New_York', agora), entre = (h, de, ate) => h >= de && h < ate
  // 22/10 («mete isto mais na minha cara»): as horas grandes, com os segundos, e por baixo a hora do gráfico dele (UTC-3)
  $('relogio').textContent = FMT_RELOGIO.format(agora)
  $('relogioGraf').textContent = FMT_GRAF.format(agora)
  const fechado = fimDeSemana(ny)
  const abertas = [entre(horaEm('Asia/Tokyo', agora).h, 9, 18) && 'Tóquio', entre(horaEm('Europe/London', agora).h, 8, 17) && 'Londres', entre(ny.h, 8, 17) && 'Nova Iorque'].filter(Boolean)
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
// 25/10: com o mercado fechado a leitura é a do fecho (servidor/arranque.mjs, leituraNoFecho); diz-se de quando é, para não
// parecer de agora
const doFecho = t => t?.noFecho ? '<div class="fecho">Mercado fechado: é a leitura do fecho, ' + esc(new Date(t.noFecho * 1000).toLocaleString('pt-PT', { timeZone: LX, weekday: 'long', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ')) + '.</div>' : ''
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
  $('tendencia').innerHTML = doFecho(t) + '<table class="tend"><tr><th>Tempo</th><th>Direção</th><th>SV3</th><th>Estoc.</th></tr>' + linhas + '</table><div class="tnota">' + fib + atr + lq + '</div>'
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
function estrategias(l, t) {
  const negrito = t => esc(t).replace(/(\d[\d\u00a0\u202f]*,\d+|\d{1,2}:\d\d)/g, '<b class="num">$1</b>')
  $('estrategias').innerHTML = l?.length ? doFecho(t) + l.map(e => '<div class="estr"><div class="en"><b>' + esc(e.nome) + '</b> <span class="suave">' + esc(e.autor) + '</span></div>'
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
  // 25/10 («quantas tenho a decorrer? mete ali em cima as entradas, tipo TP e SL, onde diz em pausa»): com avisos abertos e sem
  // ordem para fazer agora, o retângulo mostra-os; o que o SV3 espera fica numa linha por baixo
  const ab = avisosAbertos(), fe = avisosFechados()
  if ((ab.length || fe.length) && (fechado || diaria || p.acao === 'esperar' || !p.agora)) { pintarPlano(decorrer(ab, fe, p, r, fechado, diaria)); resultadosAbertos(r.analise?.px); return }
  if (fechado || diaria || (p.acao !== 'esperar' && !p.agora)) { $('plano').innerHTML = ordemParada(p, r, fechado, diaria); return }
  if (p.acao === 'esperar') {
    const [curto, ...regra] = p.porque.split(': '), px = r.analise?.px
    $('plano').innerHTML = retangulo('esperar', 'Esperar', curto.replace(/\.$/, ''), linhasOp(px != null ? [['Agora', fmt(px, c)]] : []),
      regra.length ? comTexto('Porquê', '<p>' + esc(p.porque) + '</p>', 'esperar|' + p.porque) : '')
    return
  }
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
  // (enquanto espera a linha, desde 23/10, é o «Em pausa» do ordemParada). O que arriscas está no stop
  pintarPlano(retangulo(venda ? 'vender' : 'comprar', venda ? 'Vender' : 'Comprar', (venda ? 'short' : 'long') + ', entrar já' + (p.risco ? ' · ' + fmt(p.risco.lote, 2) + ' lotes' : ''),
    '<div class="escada">' + niveis.map(n => '<div class="deg ' + n.cl + '"><i></i><span class="n">' + n.nome + '</span><b class="num">' + fmt(n.preco, c) + '</b><span class="d">' + n.d + '</span></div>').join('') + '</div>',
    comoEntrar(p)) + (ab.length ? '<div class="ab-cap">A decorrer<span class="ab-lote"></span><b class="ab-total num"></b></div>' + TIT_ABERTOS + '<div class="ab-desliza">' + listaAbertos(ab, c) + '</div>' : ''))
  resultadosAbertos(px)
}

// os avisos do bot ainda abertos (os que foram para o Telegram, como no quadro dos Alvos), os mais novos primeiro. Os iguais
// (o mesmo lado e os mesmos preços, até 1 h uns dos outros) juntam-se num só, «×2», como no gráfico
const CURTO_AVISO = { teto: 'Teto', pico: 'Pico', incrivel: 'INCRÍVEL', sv3: 'SV3' }, NOME_AVISO = { teto: 'Venda de teto', pico: 'Venda depois do pico', incrivel: 'INCRÍVEL', sv3: 'SV3' }
// (o fim pela regra, quando há: o regresso ao TP1 depois do TP2 já fecha o aviso)
const fimDe = p => p.regra || p.fim
function avisosDo(filtro) {
  const g = ultimoGrafico
  if (est.simbolo !== 'XAUUSD' || g?.simbolo !== 'XAUUSD') return []
  const nomes = new Map((g.estrategias?.ids || []).map(x => [x.id, x.nome])), curtos = new Map((g.estrategias?.ids || []).map(x => [x.id, x.curto])), out = []
  for (const p of (g.alvos?.lista || []).filter(filtro)) {
    const u = out.find(o => o.lado === p.lado && o.entrada === p.entrada && o.sl === p.sl && Math.abs(o.t - p.t) <= 3600), nome = nomes.get(p.tipo) || CURTO_AVISO[p.tipo] || p.tipo
    if (u) { u.n++; u.nomes.push(nome); if (p.num) u.nums.push(p.num) } else out.push({ ...p, n: 1, curto: CURTO_AVISO[p.tipo] || curtos.get(p.tipo) || p.tipo, nomes: [nome], nums: p.num ? [p.num] : [] })
  }
  return out.sort((a, b) => b.t - a.t)
}
const avisosAbertos = () => avisosDo(p => !fimDe(p))
// 26/10 («eu recebi no tg mas no card não tem»): os que já acabaram nas últimas 24 h, os mais recentes primeiro
const avisosFechados = () => avisosDo(p => { const f = fimDe(p); return f && Date.now() / 1000 - f.t <= 86400 }).sort((a, b) => fimDe(b).t - fimDe(a).t)
// cada um numa linha: ✓ ou ✗, o lado e o nome, como e quando acabou, e o resultado pela regra (o € vem em resultadosAbertos,
// com o lote dele: 31/10, o TP2 vale 2 vezes o stop e o stop menos uma). Até 4; os outros contam-se
const COMO_ACABOU = { stop: 'stop', tp2: 'TP2' }
// 26/10: o número do aviso no dia, o mesmo do Telegram e das respostas dos TP e do stop («#7»)
const numeros = p => p.nums?.length ? numerosAviso(p.nums) + ' ' : ''
const linhaFechado = (p, c) => {
  const f = fimDe(p), ok = f.estado !== 'stop', v = p.lado === 'venda', k = ok ? 2 : -1
  return '<div class="fe" data-r="' + k * Math.abs(p.entrada - p.sl) + '" title="' + esc(p.nomes.join(' e ') + ', entrada ' + fmt(p.entrada, c) + ' às ' + diaHora(p.t * 1000)) + '">'
    + '<span class="' + (ok ? 'sobe">✓' : 'desce">✗') + '</span><span class="fe-l ' + (v ? 'desce">Venda' : 'sobe">Compra') + '</span>'
    + '<span class="fe-n">' + numeros(p) + esc(p.curto) + (p.n > 1 ? ' ×' + p.n : '') + '</span><span class="fe-h">' + COMO_ACABOU[f.estado] + ' ' + diaHora(f.t * 1000) + '</span>'
    + '<b class="fe-r num' + (ok ? ' sobe' : ' desce') + '"></b></div>'
}
// 29/10 («se clicar em ver mais, mostra tipo pop-up»): os outros abrem-se todos numa janela por cima (a dos Lucros, mais estreita)
const listaFechados = (l, c) => '<div class="fe-lista"><div class="fe-tit">Fecharam nas últimas 24 h</div>' + l.slice(0, 4).map(p => linhaFechado(p, c)).join('')
  + (l.length > 4 ? '<button type="button" class="fe-mais" aria-haspopup="dialog">Ver mais ' + (l.length - 4) + '</button>' : '') + '</div>'
// o € de cada um, com o lote dele; sem o lote, em pips
const valoresFechados = raiz => {
  const v = valorLote
  for (const el of raiz.querySelectorAll('.fe[data-r]')) {
    const d = +el.dataset.r, s = d > 0 ? '+' : d < 0 ? '-' : ''
    el.querySelector('.fe-r').textContent = v ? s + fmt(Math.abs(d) * 100 * v.lote / v.eurusd, 0) + NB + '€' : s + fmt(Math.abs(d), 1) + ' pips'
  }
}
// cada aviso: o lado e o nome, a hora, quanto vai agora (resultadosAbertos) e os preços: a entrada, o stop (pela regra, na
// entrada depois do TP1 e no TP1 depois do TP2) e os três TP, com ✓ nos que já tocou
// (os nomes dos preços só uma vez, em cima: com um nome por aviso o cartão empurrava para fora o dos separadores)
// 29/10 («tens que arranjar forma disto ficar no mesmo retângulo»): os de outros dias vão debaixo de uma linha com o dia,
// como nas observações, e cada aviso só leva a hora; com a data em cada linha, o cabeçalho passava a borda do cartão
// 31/10: os nomes dos preços ficam fora da lista, parados por cima dela, e só os avisos deslizam (pintarPlano)
const TIT_ABERTOS = '<div class="ab-tit"><span>Entrada</span><span>Stop</span><span>TP1</span><span>TP2</span><span>TP3</span></div>'
const listaAbertos = (l, c) => {
  const hoje = diaDe(Date.now()), ontem = diaDe(Date.now() - 864e5)
  let dia = hoje
  return '<div class="ab-lista">' + l.map(p => {
    const v = p.lado === 'venda', d = diaDe(p.t * 1000), novoDia = d !== dia
    const niv = (x, cl, ok) => '<b class="num ' + cl + '">' + fmt(x, c) + (ok ? '<i>✓</i>' : '') + '</b>'
    dia = d
    return (novoDia ? '<div class="ab-dia">' + (d === ontem ? 'Ontem' : d) + '</div>' : '')
      + '<div class="ab" data-k="' + p.t + p.lado + p.entrada + '" data-entrada="' + p.entrada + '" data-lado="' + p.lado + '" data-n="' + p.n + '" title="' + esc(p.nomes.join(' e ')) + '">'
      + '<div class="ab-cab"><span class="' + (v ? 'desce">▼ Venda' : 'sobe">▲ Compra') + '</span><span class="ab-n">' + numeros(p) + esc(p.curto) + (p.n > 1 ? ' ×' + p.n : '') + '</span>'
      + '<span class="ab-h num">' + hhmm(p.t * 1000) + '</span><b class="ab-r num"></b></div>'
      + '<div class="ab-niv">' + niv(p.entrada, 'en') + niv(p.sl, 'st') + p.tps.map((x, k) => niv(x, 'tp', p.hits[k] != null)).join('') + '</div></div>'
  }).join('') + '</div>'
}
function decorrer(l, fe, p, r, fechado, diaria) {
  const c = casasTexto(r.simbolo), px = r.analise?.px, n = l.reduce((s, x) => s + x.n, 0), linha = p.acao !== 'esperar' && p.entrada != null
  const sv3 = fechado ? 'Mercado fechado, ' + semVelas().replace(/^mercado fechado, /, '') : diaria ? 'Pausa diária, ' + semVelas().replace(/^pausa diária, /, '')
    : p.acao === 'esperar' ? 'SV3: esperar. ' + p.porque.split(': ')[0].replace(/\.$/, '')
    : 'SV3 em pausa: ' + (linha ? (p.acao === 'vender' ? 'vende' : 'compra') + ' se tocar ' + fmt(p.entrada, c) + (px != null ? ', a ' + fmt(Math.abs(p.entrada - px), 1) + ' pips' : '') : 'sem entrada agora')
  return '<div class="ordemParada decorrer"><div class="op-est">' + (n ? 'A decorrer<b class="ab-total num"></b>' : 'Avisos') + '</div><div class="op-sub">' + (n ? n + (n === 1 ? ' aviso do bot' : ' avisos do bot') : 'Nenhum a decorrer')
    + (px != null ? ' · agora <b class="num ab-px">' + fmt(px, c) + '</b>' : '') + '<span class="ab-lote"></span></div>' + (n ? TIT_ABERTOS : '')
    + '<div class="ab-desliza">' + (n ? listaAbertos(l, c) : '') + (fe.length ? listaFechados(fe, c) : '') + '</div><div class="ab-sv3">' + esc(sv3) + '</div>'
    + (!fechado && p.acao !== 'esperar' && p.entradaTexto ? comoEntrar(p) : '') + '</div>'
}
// 31/10 («isto às vezes tem muitas ordens, o que vais fazer é que as ordens fiquem num card que não se mexa mas que dentro
// dele seja scroll»): o cartão tem sempre a mesma altura e os avisos deslizam dentro dele (estilo.css, .ab-desliza). Como o
// cartão se refaz a cada análise e a cada gráfico, a lista volta ao sítio onde ele a deixou; a ponta esbate-se quando há
// mais, como nas abas
const pontas = el => { el.classList.toggle('mais-cima', el.scrollTop > 1); el.classList.toggle('mais-baixo', el.scrollTop + el.clientHeight < el.scrollHeight - 1) }
const roPlano = new ResizeObserver(es => es.forEach(e => pontas(e.target)))
function pintarPlano(html) {
  const y = $('plano').querySelector('.ab-desliza')?.scrollTop || 0
  $('plano').innerHTML = html
  const d = $('plano').querySelector('.ab-desliza')
  roPlano.disconnect()
  if (d) { d.scrollTop = y; pontas(d); roPlano.observe(d); novasEntram('plano', est.simbolo + '/' + ultimoGrafico?.simbolo + '/' + est.tf, d, d, y) }
}
$('plano').addEventListener('scroll', e => { if (e.target.classList?.contains('ab-desliza')) pontas(e.target) }, { capture: true, passive: true })
// 31/10 («continua a melhorar cenas, mete cenas de última geração»): o que chega de novo a uma lista (um aviso, uma notícia)
// entra devagar: cresce do zero até à altura dele e aparece, e o resto desce com ele em vez de saltar. Cada linha leva um
// data-k; na primeira pintura, ou com outro símbolo ou outro gráfico, nada entra. Se a lista estava descida, a leitura fica
// parada: anda o tamanho do que entrou por cima, sem animação. Com o movimento reduzido, entra de uma vez
const vistas = new Map()
function novasEntram(nome, fonte, lista, desliza, y) {
  const els = [...lista.querySelectorAll('[data-k]')], antes = vistas.get(nome)
  vistas.set(nome, { fonte, k: new Set(els.map(e => e.dataset.k)) })
  if (antes?.fonte !== fonte) return
  const novas = els.filter(e => !antes.k.has(e.dataset.k))
  if (!novas.length) return
  const topo = desliza.getBoundingClientRect().top, acima = y > 4 ? novas.filter(e => e.getBoundingClientRect().top < topo) : []
  if (acima.length) desliza.scrollTop = y + acima.reduce((s, e) => s + e.offsetHeight, 0)
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  for (const e of novas.filter(e => !acima.includes(e))) {
    const cs = getComputedStyle(e), h = e.offsetHeight
    // (o clip corta sem mudar nada lá dentro; o hidden mudava as margens)
    e.style.overflow = 'clip'
    const a = e.animate([{ height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 }, { opacity: 0, offset: 0.35 },
      { height: h + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.2, .8, .2, 1)' })
    a.onfinish = a.oncancel = () => { e.style.overflow = '' }
  }
}
// quanto vai cada aviso aberto, ao preço de agora (de segundo em segundo no Mac). 25/10 («mete também o valor como se
// tivesse metido 0,32 lote»): e em €, com o lote dele; 1 $ no ouro com 1 lote são 100 $. Sem o lote (a barra ainda não
// chegou), só pips
function resultadosAbertos(px) {
  const v = valorLote
  valoresFechados($('plano'))
  if (px == null) return
  pxAbertos = px
  let somaPips = 0, somaEur = 0
  for (const el of $('plano').querySelectorAll('.ab[data-entrada]')) {
    const d = (el.dataset.lado === 'venda' ? 1 : -1) * (+el.dataset.entrada - px), r = el.querySelector('.ab-r'), s = d >= 0 ? '+' : '-'
    // com o €, os pips vão mais pequenos ao lado (29/10: cabem no cartão); sem o lote (o amigo), só os pips, como antes
    const pips = s + fmt(Math.abs(d), 1) + ' pips', eur = v ? Math.round(Math.abs(d) * 100 * v.lote / v.eurusd) : 0
    r.innerHTML = v ? '<span class="ab-pips">' + pips + '</span> ' + s + fmt(eur, 0) + NB + '€' : pips
    r.className = 'ab-r num ' + (d >= 0 ? 'sobe' : 'desce')
    // o total soma o que se vê em cada linha (os «×2» contam duas vezes, como no número de avisos)
    const k = (+el.dataset.n || 1) * (d >= 0 ? 1 : -1)
    somaPips += k * Math.round(Math.abs(d) * 10) / 10; somaEur += k * eur
  }
  // 29/10 («aqui em cima mete a soma de todas, tipo total das que tão a decorrer»): ao lado do título, em € (sem o lote, em pips)
  for (const t of $('plano').querySelectorAll('.ab-total')) {
    const x = v ? somaEur : somaPips, s = x >= 0 ? '+' : '-'
    t.innerHTML = '<span class="ab-tot-l">total</span> ' + s + (v ? fmt(Math.abs(x), 0) + NB + '€' : fmt(Math.abs(x), 1) + ' pips')
    t.className = 'ab-total num ' + (x >= 0 ? 'sobe' : 'desce')
    t.title = 'A soma dos avisos a decorrer, ao preço de agora' + (v ? ': ' + (somaPips >= 0 ? '+' : '-') + fmt(Math.abs(somaPips), 1) + ' pips' : '')
  }
  const a = $('plano').querySelector('.ab-px')
  if (a) a.textContent = fmt(px, casasTexto('XAUUSD'))
  for (const n of $('plano').querySelectorAll('.ab-lote')) n.textContent = v ? ' · € com ' + fmt(v.lote, 2) + ' lote' : ''
}

// 25/10 («quando houver ordens elas têm que caber bem aí nesse retângulo», «se tiveres algum texto faz com que apareça mas
// com setinha para baixo e aparece tipo um card»): todos os estados da ordem no mesmo retângulo, da mesma altura (fechado, em
// pausa, esperar e a ordem). O texto fica atrás de uma setinha e abre num cartão por cima do que está por baixo, sem mexer
// no retângulo; fica aberto quando a análise se atualiza, até mudar a ordem, tocar fora dele ou carregar no Esc
let txtAberto = null
const comTexto = (rotulo, html, chave) => '<details class="txtOrdem" data-chave="' + esc(chave) + '"' + (txtAberto === chave ? ' open' : '') + '><summary>' + rotulo
  + setaGrupo(false) + setaGrupo(true) + '</summary><div class="cartaoTxt">' + html + '</div></details>'
const comoEntrar = p => comTexto('Como entrar e porquê', '<p><b>Como entrar:</b> ' + esc(p.entradaTexto) + '</p>'
  + (p.gestao ? '<p><b>No alvo 1:</b> ' + esc(p.gestao.replace(/^No alvo 1 /, '')) + '</p>' : '') + '<p>' + esc(p.porque) + '</p>', p.acao + '|' + p.entrada)
const retangulo = (cl, tit, sub, corpo, txt = '') => '<div class="ordemParada ' + cl + '"><div class="op-est">' + tit + '</div>'
  + (sub ? '<div class="op-sub">' + esc(sub) + '</div>' : '') + corpo + txt + '</div>'
const linhasOp = l => l.length ? '<div class="op-lin">' + l.map(([n, v]) => '<div><span>' + esc(n) + '</span><b class="num">' + v + '</b></div>').join('') + '</div>' : ''
$('plano').addEventListener('toggle', e => { if (e.target.classList?.contains('txtOrdem')) txtAberto = e.target.open ? e.target.dataset.chave : null }, true)
document.addEventListener('click', e => { const d = $('plano').querySelector('.txtOrdem[open]'); if (d && !d.contains(e.target)) d.open = false })
document.addEventListener('keydown', e => { const d = $('plano').querySelector('.txtOrdem[open]'); if (e.key === 'Escape' && d) { d.open = false; d.querySelector('summary').focus() } })

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
  fechado = !!r.analise?.fechado
  plano(r.plano, r)
  tendencia(r.tecnica)
  estrategias(r.tecnica?.estrategias, r.tecnica)
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
  const nome = r.simbolo === 'XAUUSD' ? 'ouro' : r.simbolo, yN = $('noticias').parentElement.scrollTop
  $('noticias').innerHTML = r.setas.length ? r.setas.map(x => '<div class="noticia" data-k="' + esc(x.quando + ' ' + x.texto.slice(0, 30)) + '"><div class="q"><span class="num">' + diaHora(x.quando) + '</span><span class="chip ' + (x.dir > 0 ? 'sobe">▲' : 'desce">▼') + x.grau + ' ' + esc(r.simbolo) + '</span></div><div class="tx">' + esc(x.texto) + '</div>' + (x.porque || x.mais ? '<div class="pq">' + esc(x.porque || '') + (x.mais ? (x.porque ? ' · ' : '') + 'mais ' + x.mais + (x.mais > 1 ? ' notícias' : ' notícia') + ' sobre isto' : '') + '</div>' : '') + depoisTxt(x.depois, r.simbolo) + '</div>').join('')
    // 25/10 («e aqui nada?»): as setas vêm do card Mercado do Orca; com as notícias dele desligadas não chegam novas
    // 25/10: com o botão de pausa aqui em cima e a pausa sozinha do fim de semana (pausaAuto)
    : '<div class="vazio">' + (r.pausa ? (r.pausaAuto ? 'Ao fim de semana, com o mercado fechado, as notícias param sozinhas para não gastarem créditos' : 'As notícias estão em pausa, por isso não chegam setas novas') + (r.ultimaSeta ? ' (a última foi a ' + diaDe(r.ultimaSeta) + ', às ' + hhmm(r.ultimaSeta) + ')' : '')
      + (r.pausaAuto ? '. Voltam meia hora antes de o mercado abrir' + (AMIGO ? '.' : ', ou já, no ▶ aqui em cima.') : AMIGO ? '.' : '. Para voltarem, carrega no ▶ aqui em cima.')
      : 'Sem setas para ' + esc(nome) + ' nos últimos 3 dias.') + '</div>'
  novasEntram('noticias', r.simbolo, $('noticias'), $('noticias').parentElement, yN)
  // 22/10 («mete tipo assim», com o cartão «Próximos eventos» do Orca): cada evento numa caixa, com a moeda, o nome, o
  // previsto e a hora; os fortes a rosa. A próxima vai também na barra de cima
  const diaH = ms => { const d = diaDe(ms); return (d === diaDe(Date.now()) ? '' : d === diaDe(Date.now() + 864e5) ? 'amanhã ' : d + ' ') + hhmm(ms).replace(':', 'h') }
  // 25/10: os números da ForexFactory vêm com ponto («4.00%»); aqui com a vírgula, como o resto do Jarvis
  const pt = v => String(v).replace(/(\d)\.(\d)/g, '$1,$2')
  const evento = e => '<span class="evento' + (e.impacto === 'High' ? ' forte' : '') + '" data-quando="' + e.quando + '" title="' + esc(e.titulo + (e.previsao ? ', previsto ' + pt(e.previsao) : '') + (e.anterior ? ', anterior ' + pt(e.anterior) : '')) + '"><b class="moeda">' + esc(e.moeda) + '</b><span class="tt">' + esc(e.titulo) + '</span>'
    + (e.previsao ? '<span class="prev">previsto ' + esc(pt(e.previsao)) + '</span>' : '') + '<b class="hora num">' + diaH(e.quando) + '</b></span>'
  // 24/10: a grelha do mês (mesCalendario) saiu a pedido dele («mete o anterior, não o das datas»); ficam os eventos
  // 25/10 («tens a certeza?»): com a ForexFactory a recusar, a lista dela fica velha e só entram as dos EUA (da nuvem do
  // ouro); no ouro chegam, nos pares diz-se que faltam as das outras moedas
  const calVelho = r.calendarioLido != null && Date.now() - r.calendarioLido > 3 * 3600e3, semFF = calVelho ? 'A ForexFactory não responde desde ' + diaHora(r.calendarioLido) + ': ' : ''
  $('calendario').innerHTML = (r.proximas.length ? '<div class="eventos">' + r.proximas.map(evento).join('') + '</div>' + (semFF && r.simbolo !== 'XAUUSD' ? '<div class="vazio">' + esc(semFF) + 'só aparecem as dos EUA.</div>' : '')
    : '<div class="vazio">' + (semFF ? esc(semFF) + (r.simbolo === 'XAUUSD' ? 'sem notícias dos EUA à vista.' : 'faltam as notícias destas moedas.') : 'Nada de médio ou forte para estas moedas esta semana.') + '</div>')
  // 25/10 («retira isto daqui»): a próxima notícia saiu da barra de cima; fica no cartão do calendário
  for (const ev of $('calendario').querySelectorAll('.evento')) { const p = ev.querySelector('.prev'); if (p && p.scrollWidth > p.clientWidth + 1) ev.classList.add('semPrev') }
  marcarPerto()
}
// 25/10 («quando tiver 1 hora antes das reuniões elas pulsam levemente»): na última hora antes de cada notícia a caixa dela
// pulsa devagar (estilo.css, .evento.perto); revê-se de 30 em 30 s, sem esperar pelo próximo pedido
function marcarPerto() {
  const agora = Date.now()
  for (const ev of document.querySelectorAll('#calendario .evento[data-quando]')) { const d = +ev.dataset.quando - agora; ev.classList.toggle('perto', d > 0 && d <= 3600e3) }
}
setInterval(marcarPerto, 30e3)

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
  // 25/10 («mete ai 1 segundo»): o 1 s só no ouro e só no Jarvis do Mac (o preço de segundo em segundo não vai à nuvem)
  for (const s of $('tfs').children) { const on = s.dataset.tf === est.tf; s.classList.toggle('on', on); s.setAttribute('aria-pressed', on)
    if (s.dataset.tf === '1s') s.hidden = est.simbolo !== 'XAUUSD' || document.documentElement.classList.contains('amigo') }
  for (const s of $('camadas').children) { const on = !!est.camadas[s.dataset.c]; s.classList.toggle('on', on); s.setAttribute('aria-pressed', on) }
  escolhaEstr()
  mAtualizar()
}
// 24/10 («mete as estratégias mesmo, e eu seleciono para ver só aquela»): uma lista na barra das camadas; a escolhida
// mostra as entradas dela no gráfico (seta do lado, ✓ se chegou a um TP, ✗ se foi ao stop). Nenhuma = nada
// 25/10 («a possibilidade de meter as que eu quiser selecionadas»): várias ao mesmo tempo. O select escondido só guarda os nomes.
// 29/10: a «ZIMBA FX: todas juntas» (id edney) já não liga as cinco: é uma estratégia só, com as entradas em que as cinco
// deram sinal do mesmo lado (estrategias.mjs, sinaisJuntas)
// 25/10 («deveria estar nesses filtros»): os avisos do bot também, por tipo, com os nomes do placar; «todos os avisos»
// (id bot) liga os quatro tipos
const JUNTAS = { bot: ['bot-pico', 'bot-teto', 'bot-incrivel', 'bot-sv3'] }, ZIMBA_CINCO = ['liquidez', 'choch', 'orderblock', 'wyckoff', 'elliott']
const BOT_ESTR = [{ id: 'bot', nome: 'BOT: todos os avisos' }, { id: 'bot-pico', nome: 'BOT: venda depois do pico' }, { id: 'bot-teto', nome: 'BOT: venda de teto' },
  { id: 'bot-incrivel', nome: 'BOT: INCRÍVEL' }, { id: 'bot-sv3', nome: 'BOT: linhas do SV3' }]
const estrEscolhidas = () => [...new Set((est.estrVer || []).flatMap(v => JUNTAS[v] || [v]))]
est.estrVer = estrEscolhidas()
// quem tinha a «todas juntas» escolhida antes de 29/10 tinha guardadas as cinco: passa a ter a estratégia nova (uma vez só)
if (!est.juntas5) { if (est.estrVer.length === 5 && ZIMBA_CINCO.every(id => est.estrVer.includes(id))) est.estrVer = ['edney']; est.juntas5 = 1; guardar() }
function nomeEstr() {
  const l = estrEscolhidas(), nomes = Object.fromEntries([...$('estrSel').options].filter(o => o.value).map(o => [o.value, o.text.replace(/\s*\(.*\)$/, '')]))
  const curto = id => (nomes[id] || id).replace(/^(ZIMBA FX|BOT): /, '')
  if (!l.length) return ''
  if (l.length === 4 && JUNTAS.bot.every(id => l.includes(id))) return 'BOT: todos os avisos'
  return l.length === 1 ? nomes[l[0]] || l[0] : l.length === 2 ? (l.every(id => id.startsWith('bot-')) ? 'BOT: ' : '') + l.map(curto).join(' + ') : l.length + ' estratégias'
}
function escolhaEstr() {
  const el = $('estrSel'), ids = ultimoGrafico?.estrategias?.ids || []
  if (!ids.length) return
  const n = id => /^bot/.test(id) ? (ultimoGrafico.alvos?.lista || []).filter(p => (JUNTAS[id] || [id]).includes('bot-' + p.tipo)).length
    : (ultimoGrafico.estrategias.lista || []).filter(x => (JUNTAS[id] || [id]).includes(x.id)).length
  const html = '<option value="">Estratégia: nenhuma</option>' + [...(ultimoGrafico.alvos ? BOT_ESTR : []), ...ids].map(x => '<option value="' + x.id + '">' + esc(x.nome) + ' (' + n(x.id) + ')</option>').join('')
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html }
  el.classList.toggle('on', estrEscolhidas().length > 0)
  mAtualizar()
}
function aplicarEstr() {
  guardar(); escolhaEstr(); mAtualizar()
  if (ultimoGrafico) grafico.mostrar(ultimoGrafico, { ...est.camadas, estrVer: est.estrVer })
}
$('estrSel').addEventListener('change', e => { est.estrVer = e.target.value ? JUNTAS[e.target.value] || [e.target.value] : []; aplicarEstr() })
// 25/10 («estas funções de tempo não funcionam»): carregar no tempo que já está marcado também refaz o gráfico
$('tfs').addEventListener('click', e => { const t = e.target.dataset.tf; if (!t) return; est.tf = t; guardar(); marcar(); carregarGrafico() })
// 25/10 («há aqui umas que penso que não estão a funcionar»): ao ligar uma camada que agora não tem nada para desenhar, uma
// linha por cima do gráfico diz porquê (some ao fim de 5 s)
const notaCam = Object.assign(document.createElement('div'), { className: 'notaCam' })
$('grafico').appendChild(notaCam)
const longo = d => d.tf === '4h' || d.tf === '1d'
const VAZIA = {
  niveis: d => !d.zonas?.length && 'nenhum teto nem suporte perto do preço',
  diario: d => !d.diario?.length && 'sem zonas do diário',
  asia: d => longo(d) ? 'a caixa só se vê no 15 min e no 1 h' : !d.asia && 'sem caixa da Ásia',
  fibo: d => !d.fibo && 'sem Fibonacci de 4 h',
  linhas: d => d.tf === '1d' ? 'no dia não há linhas de tendência' : !d.linhas?.length && 'nenhuma linha de tendência',
  velas: d => !d.padroes?.length && 'nenhuma vela de confirmação nas últimas 150 velas',
  sinais: d => longo(d) ? 'os sinais são de 15 min: veem-se no 15 min e no 1 h' : !d.sinais?.length && 'nenhum sinal nestas velas',
  alvos: d => longo(d) ? 'os avisos são de 15 min: veem-se no 15 min e no 1 h' : !d.alvos?.lista?.length && 'nenhum aviso nestas velas',
  plano: () => !ultimoPlano && (fechado ? 'o mercado está fechado' : 'agora não há plano de entrada'),
  posicoes: d => !d.posicoes?.length && 'não tens nenhuma posição aberta'
}
let notaAte = 0
function notaCamada(c) {
  const porque = est.camadas[c] && ultimoGrafico && VAZIA[c]?.(ultimoGrafico)
  clearTimeout(notaAte)
  if (!porque) { notaCam.classList.remove('on'); return }
  notaCam.textContent = ($('camadas').querySelector('[data-c="' + c + '"]')?.textContent || c) + ': ' + porque + '.'
  notaCam.classList.add('on')
  notaAte = setTimeout(() => notaCam.classList.remove('on'), 5000)
}
$('camadas').addEventListener('click', e => { const c = e.target.dataset.c; if (!c) return; est.camadas[c] = !est.camadas[c]; guardar(); marcar(); if (ultimoGrafico) grafico.mostrar(ultimoGrafico, { ...est.camadas, estrVer: est.estrVer }); grafico.plano(est.camadas.plano ? ultimoPlano : null); notaCamada(c) })

// o relógio da vela (22/10, «preciso do timer lá em cima de mudança de candle»): quanto falta para a vela do tempo escolhido
// fechar, a contar do início da última vela do gráfico (as de 4 h e do dia começam às 17:00 de Nova Iorque, como no MT5).
// Fica no canto de cima à direita do gráfico (onde ele marcou). Sem velas novas, diz porquê pela hora de Nova Iorque: a pausa
// diária do ouro (17:00 às 18:00 lá, 22:00 às 23:00 em Lisboa) ou o fim de semana (de sexta às 17:00 a domingo às 18:00).
const DURACAO = { '1s': 1, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }
let fimVela = null
// (o horaEm e o fimDeSemana estão ao pé do relógio, lá em cima, que já os usa ao abrir)
// 24/10 («podia estar mais bem conseguido», o «Mercado: Fechado.» do Agora): com o mercado fechado, o Agora diz quando abre
// e quanto falta, e o último preço com a variação da semana em 24 h
// 31/10 (desempenho): de hora a hora, porque Nova Iorque só muda de hora em horas certas. De minuto a minuto, ao sábado eram
// umas 2 000 voltas, 80 ms com o ecrã preso, duas vezes a cada 30 s (o Agora e a Ordem); dá a mesma hora em 1 360 casos medidos
function reabreEm() {
  for (let t = Math.ceil(Date.now() / 3600e3) * 3600e3, fim = t + 4 * 864e5; t < fim; t += 3600e3) { const ny = horaEm('America/New_York', new Date(t)); if (ny.dia === 'Sun' && ny.h === 18 && ny.m === 0) return t }
  return null
}
setInterval(() => { if (ultimaR && $('brief').querySelector('.mf')) $('brief').innerHTML = mercadoFechado(ultimaR) }, 30e3)
// 24/10: o que o preço fez na hora a seguir à notícia («subiu 12,4 pips na hora a seguir»), e se a seta acertou.
// 26/10: abaixo de 2 pips é ruído (em meia hora o ouro mexe mais de 0,5 $ em 95% das vezes): «quase não mexeu», sem dizer
// se a seta acertou, como o servidor (PARADO, em noticias.mjs)
function depoisTxt(d, simbolo) {
  if (!d) return ''
  const n = Math.abs(d.mov), u = simbolo === 'XAUUSD' ? ' pips' : '', q = d.min >= 60 ? 'na hora a seguir' : 'nos ' + d.min + ' min a seguir'
  const t = n < 2 ? 'Quase não mexeu ' + q : (d.mov > 0 ? 'Subiu ' : 'Desceu ') + fmt(n, 1) + u + ' ' + q
  return '<div class="depois ' + (n < 2 ? '' : d.mov > 0 ? 'sobe' : 'desce') + '">' + t + (d.acertou === true ? ' · a seta acertou' : d.acertou === false ? ' · a seta falhou' : '') + '</div>'
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
  return retangulo(fechado ? 'fechado' : 'pausa', tit, sub, linhasOp(linhas), !fechado && p.acao !== 'esperar' && p.entradaTexto ? comoEntrar(p) : '')
}
setInterval(() => { if (ultimaR && $('plano')?.querySelector('.ordemParada.fechado')) plano(ultimaR.plano, ultimaR) }, 30e3)
function mercadoFechado(r) {
  const t = reabreEm(), a = r.analise, c = casasTexto(r.simbolo), falta = t ? t - Date.now() : null
  const h = falta != null ? Math.floor(falta / 3600e3) : null, m = falta != null ? Math.floor(falta % 3600e3 / 60e3) : null
  const pausa = /pausa/.test(semVelas())
  return '<div class="mf"><div class="mf-est">' + (pausa ? 'Em pausa' : 'Fechado') + '</div>'
    + '<div class="mf-sub">' + esc(semVelas().replace(/^mercado fechado, /, '').replace(/^pausa diária, /, '')) + (h != null && !pausa ? ' · daqui a <b class="num">' + (h ? h + ' h ' : '') + m + ' min</b>' : '') + '</div>'
    + (a ? '<div class="mf-px"><span class="suave">Último preço</span><b class="num">' + fmt(a.px, c) + '</b><span class="num ' + (a.var24h >= 0 ? 'sobe' : 'desce') + '">' + (a.var24h >= 0 ? '+' : '') + fmt(a.var24h, 1) + '%</span></div>' : '') + '</div>'
}
// o fim de semana do mercado: de sexta às 17:00 a domingo às 18:00 de Nova Iorque
function semVelas() {
  const ny = horaEm('America/New_York'), lx = horaEm('Europe/Lisbon'), dif = ((lx.h - ny.h + 24) % 24)
  const as18 = String((18 + dif) % 24).padStart(2, '0') + ':00'   // as 18:00 de Nova Iorque na hora de Lisboa
  // 25/10: ao domingo «abre hoje», ao sábado «abre amanhã» (no domingo dizia «abre domingo às 22:00»)
  if (fimDeSemana(ny)) return 'mercado fechado, abre ' + (lx.dia === 'Sun' ? 'hoje' : lx.dia === 'Sat' ? 'amanhã' : 'domingo') + ' às ' + as18
  if (ny.h === 17) return 'pausa diária, volta às ' + as18
  return 'sem velas novas'
}
setInterval(() => {
  const el = $('gTimer')
  if (!fimVela) { el.textContent = ''; return }
  const agora = Date.now() / 1000, dur = DURACAO[fimVela.tf]
  // no de 1 s não há contagem: diz «ao vivo» enquanto chegam preços
  if (fimVela.tf === '1s') { el.textContent = agora - fimVela.inicio < 15 ? 'ao vivo' : semVelas(); el.classList.remove('quase'); return }
  if (agora - fimVela.inicio > 2 * dur + 300) { el.textContent = semVelas(); el.classList.remove('quase'); return }
  let fim = fimVela.inicio + dur
  while (fim <= agora) fim += dur
  const s = Math.floor(fim - agora), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, '0')
  el.innerHTML = 'vela fecha em <b>' + (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + ss + '</b>'   // com o espaço: a legenda do telemóvel copia o texto («em4:41»)
  el.classList.toggle('quase', s <= 60)
}, 1000)

let pedidoGrafico = 0
// 25/10 («estas funções de tempo não funcionam»): com o servidor a reiniciar, o pedido falhava e o gráfico ficava no tempo
// anterior até 2 min depois. Agora tenta outra vez (1,5 s, 3 s, 6 s, 12 s) e, enquanto carrega, o tempo marcado fica claro
async function carregarGrafico(tentativa = 0) {
  const s = est.simbolo, tf = est.tf, eu = ++pedidoGrafico, atual = () => eu === pedidoGrafico && s === est.simbolo && tf === est.tf
  $('tfs').setAttribute('aria-busy', 'true')
  let d
  try { d = await api('grafico?s=' + s + '&tf=' + tf) } catch (e) {
    console.warn('gráfico', e)
    if (atual() && tentativa < 4) { setTimeout(() => { if (atual()) carregarGrafico(tentativa + 1) }, 1500 * 2 ** tentativa); return }
  }
  if (eu === pedidoGrafico) $('tfs').removeAttribute('aria-busy')
  if (!d || !atual()) return
  try {
    ultimoGrafico = d; grafico.mostrar(d, { ...est.camadas, estrVer: est.estrVer }); escolhaEstr()
    if (ultimaR && d.simbolo === 'XAUUSD' && ultimaR.simbolo === 'XAUUSD') plano(ultimaR.plano, ultimaR)   // os avisos abertos vêm com o gráfico
    fimVela = d.velas.length ? { inicio: d.velas.at(-1).time, tf: d.tf } : null
  } catch (e) { console.warn('gráfico', e) }
}
const carregarMaquina = () => api('maquina?s=' + est.simbolo).then(maquina).catch(e => maquina({ disponivel: false, texto: 'A máquina do tempo não respondeu (' + e.message + ').' }))
async function carregar() {
  marcar()
  await Promise.allSettled([api('analise?s=' + est.simbolo).then(analise), carregarGrafico()])
}
async function selecionar(s) { est.simbolo = s; if (s !== 'XAUUSD' && est.tf === '1s') est.tf = '15m'; guardar(); radar(radarLista); maquina(null); await carregar() }

// em pausa (o botão do Orca), o ponto lá em cima diz «em pausa» em vez de «ligado»
let pausado = false
// 28/10: o ponto junta a ligação ao Jarvis, a internet do Mac (o ping traz desde quando falta) e a pausa. Com a internet em
// baixo o servidor continuava a responder e o ponto ficava verde, «ligado», com o gráfico e o card parados no que havia
let ligado = null, semRede = null
function pintarLigacao() {
  const hm = t => new Date(t * 1000).toLocaleTimeString('pt-PT', { timeZone: LX, hour: '2-digit', minute: '2-digit' })
  const [c, txt] = ligado === false ? ['erro', 'sem ligação'] : semRede ? ['erro', 'sem internet'] : pausado ? ['pausa', 'notícias em pausa'] : ligado ? ['on', 'ligado'] : ['', 'a ligar']
  $('ligacao').innerHTML = '<span class="ponto ' + c + '"></span>' + txt
  // a hora fica na dica: com ela à vista, a 1440 px a banca lá em cima perdia o número
  $('ligacao').title = !ligado || !semRede ? '' : 'Sem internet desde as ' + hm(semRede) + ': o gráfico, o card e a banca ficam parados no que havia até ela voltar.'
}
function ligar() {
  const ev = new EventSource('/api/eventos'), ponto = ok => { ligado = ok; pintarLigacao() }
  ev.onopen = () => ponto(true)
  ev.onerror = () => ponto(false)
  ev.onmessage = e => {
    const { tipo, dados } = JSON.parse(e.data)
    if (tipo === 'analise' && dados.simbolo === est.simbolo) { analise(dados); carregarGrafico() }
    else if (tipo === 'radar') radar(dados)
    else if (tipo === 'conta') conta(dados)
    // 26/10: um aviso do bot mudou (um novo, um TP, um stop): o gráfico, o card e a barra refazem-se já, sem esperar pela volta
    else if (tipo === 'avisos') { if (est.simbolo === 'XAUUSD') carregarGrafico(); api('resultado').then(resultado, () => {}) }
    else if (tipo === 'obs') observacao(dados)
    else if (tipo === 'forca') forca(dados)
    // o preço de segundo em segundo: no gráfico de 1 s acaba a última vela ou junta a seguinte, e o preço lá em cima anda com
    // ele. 25/10 («o gráfico de 15 min tem que mexer»): também nos outros tempos do ouro, na vela de agora
    else if (tipo === 'segundo' && est.simbolo === 'XAUUSD' && ultimoGrafico?.simbolo === 'XAUUSD' && ultimoGrafico.tf === est.tf) {
      const t = grafico.vivo(dados)
      if (t != null) { fimVela = { inicio: t, tf: est.tf }; $('gPx').textContent = fmt(dados.close, casasTexto('XAUUSD')); resultadosAbertos(dados.close) }
    }
  }
}

// a entrada do amigo (o link partilhado, servidor/amigo.mjs): sem a conta, as opções e a conversa
const AMIGO = document.documentElement.classList.contains('amigo')
// 28/10: na página do amigo (na nuvem) os pedidos de tempo a tempo param com o separador escondido: o gráfico eram 170 KB de
// 30 em 30 s, a gastar os dados do telemóvel sem ninguém a ver. Ao voltar, faz logo os que ficaram por fazer
const porFazer = new Set()
const seVisivel = fn => !AMIGO ? fn : () => { if (document.hidden) porFazer.add(fn); else fn() }
document.addEventListener('visibilitychange', () => { if (document.hidden) return; const L = [...porFazer]; porFazer.clear(); L.forEach(fn => fn()) })
// os separadores do cartão da direita (22/10): lembra o último aberto; o amigo não tem a conversa
function aba(n) {
  // 22/10 («retira»): a conversa saiu do ecrã (o servidor continua a tê-la)
  if (n === 'conversa' || !document.querySelector('#separadores [data-aba="' + n + '"]')) n = 'agora'
  est.aba = n; guardar()
  for (const e of document.querySelectorAll('#separadores [data-aba], .abas .aba')) e.classList.toggle('on', e.dataset.aba === n)
  for (const e of document.querySelectorAll('#separadores [data-aba]')) e.setAttribute('aria-pressed', e.dataset.aba === n)
  porLinha()
  if (n === 'macro') carregarMacro()
}
// 31/10 («continua a melhorar cenas, mete cenas de última geração»): por baixo dos separadores há uma linha só, que desliza
// até ao que se abre (estilo.css, .sep-linha); a primeira vez põe-se no sítio sem deslizar
const sepLinha = Object.assign(document.createElement('i'), { className: 'sep-linha' })
sepLinha.setAttribute('aria-hidden', 'true')
$('separadores').append(sepLinha); $('separadores').classList.add('com-linha')
function porLinha() {
  const s = $('separadores'), t = s.querySelector('[data-aba].on')
  if (!t?.offsetWidth) return
  // (pelas caixas e não pelo offsetWidth, que arredonda: no telemóvel a linha passava meio píxel do separador)
  const rs = s.getBoundingClientRect(), rt = t.getBoundingClientRect()
  sepLinha.style.width = rt.width + 'px'; sepLinha.style.translate = (rt.left - rs.left - s.clientLeft + s.scrollLeft) + 'px 0'
  if (!s.classList.contains('pronta')) requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('pronta')))
}
new ResizeObserver(porLinha).observe($('separadores'))
$('separadores').addEventListener('click', e => { const t = e.target.closest('[data-aba]'); if (t) aba(t.dataset.aba) })
aba(est.aba || 'agora')
for (const m of est.conversa) mensagem(m.quem, m.texto, false)
// tudo ao mesmo tempo: cada painel aparece quando a resposta dele chega
if (!AMIGO) ligar()
api('radar').then(radar, () => radar([]))
if (!AMIGO) api('conta').then(conta, () => conta(null))
api('observacoes').then(observacoes, () => observacoes([]))
if (!AMIGO) api('opcoes').then(opcoes, () => opcoes({}))
// lá em cima (23/10): o que os avisos do ouro davam com o lote dele desde o primeiro, como o quadro (o amigo também, desde 29/10).
// Ao passar o rato («dizer com base no quê»): um quadro nosso, porque o title do sistema demorava e quase não se via.
// 26/10 («consegues melhorar isto, não percebo»): em palavras simples e em três partes: hoje, desde o primeiro dia e qual TP
// dá mais (com a banca de cada um, os mesmos números da barra). Por baixo, a conferência e os avisos que ficaram fora da conta
// por terem saído com os avisos dele em pausa.
function resultado(r) {
  if (!r) return
  valorLote = r.lote && r.eurusd ? { lote: r.lote, eurusd: r.eurusd } : null
  resultadosAbertos(pxAbertos)
  const dia = new Date(r.desde * 1000).toLocaleDateString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit' })
  const sinal = x => (x >= 0 ? '+' : '-') + fmt(Math.abs(x), 0) + ' €', cor = x => x >= 0.5 ? ' sobe' : x <= -0.5 ? ' desce' : ''
  const b = r.banca, h = r.hoje, quando = t => new Date(t * 1000).toLocaleString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ')
  const tit = (nome, sub) => '<div class="tit"><span>' + nome + '</span><span>' + sub + '</span></div>'
  const valor = (nome, txt, cls, nota) => '<div class="l"><span>' + nome + '</span><b class="num' + cls + '">' + txt + '</b>' + (nota ? '<i>' + nota + '</i>' : '') + '</div>'
  // «4 com lucro · 16 no stop»: cada aviso fechado conta uma vez
  const conta = (n, txt, cls) => '<span' + (n ? ' class="' + cls + '"' : '') + '>' + n + NB + txt + '</span>'
  const fecharam = (bons, stops) => conta(bons, 'com lucro', 'sobe') + ' · ' + conta(stops, 'no stop', 'desce')
  const parteHoje = h ? tit('Hoje', 'desde as 00:00')
    + valor('Resultado', sinal(h.eur), cor(h.eur), h.lucro + h.sl ? '' : 'ainda nenhum aviso fechou hoje')
    + (h.lucro + h.sl ? valor('Fecharam', fecharam(h.lucro, h.sl), '') : '')
    + valor('Tocaram', h.tp.map((n, i) => n + NB + 'TP' + (i + 1)).join(' · '), '', 'o mesmo aviso conta em todos os TP que tocou hoje') : ''
  const parteDesde = tit('Desde ' + dia, r.avisos + ' avisos')
    + valor('Resultado', sinal(r.ganhos - r.perdas), cor(r.ganhos - r.perdas), 'ganhou ' + fmt(r.ganhos, 0) + ' € nos TP e perdeu ' + fmt(r.perdas, 0) + ' € nos stops e no spread')
    + (b ? valor('A banca', fmt(b.inicio, 0) + ' € → ' + fmt(b.agora, 0) + ' €', cor(b.agora - b.inicio), b.tMinimo ? 'o mais baixo foi ' + fmt(b.minimo, 0) + ' €, a ' + quando(b.tMinimo) : '')
      + valor('Fecharam', fecharam(b.fechados - b.stops, b.stops), '', r.abertos ? 'e ' + r.abertos + (r.abertos > 1 ? ' ainda abertos, que ainda não contam' : ' ainda aberto, que ainda não conta') : '') : '')
  // fechar sempre no mesmo TP, cada uma com a banca a que chegava (como na barra); diz-se qual dá mais. 31/10: a nossa regra é
  // tudo no TP2, sem mexer no stop, a mesma conta do «Sempre no TP2» (era uma linha à parte)
  const formas = r.porTP.map((v, i) => ['Sempre no TP' + (i + 1), v]), melhor = Math.max(...formas.map(f => f[1]))
  const parteTP = tit('Qual TP dá mais', b ? 'a banca, começando com ' + fmt(b.inicio, 0) + ' €' : 'desde ' + dia)
    + formas.map(([nome, v], i) => valor(nome, b ? fmt(b.inicio + v, 0) + ' €' : sinal(v), cor(v),
      [i === 1 && 'a nossa regra, sem mexer no stop', v === melhor && 'é a que dá mais'].filter(Boolean).join('. ').replace(/^./, c => i === 1 ? c.toUpperCase() : c))).join('')
  // 26/10 («tens que perceber o melhor jeito de nunca te enganares»): a conferência automática do Telegram contra o Jarvis;
  // se alguma coisa não bate, vem logo no topo
  const erros = r.conferencia?.erros?.length ? r.conferencia.erros.map(e => '<p class="desce">' + esc(e) + '</p>').join('') : ''
  const certo = r.conferencia && !erros ? '<p>Bate certo com o Telegram (conferido às ' + hhmm(r.conferencia.t * 1000) + ').</p>' : ''
  const pausa = r.pausa ? '<p>Fora desta conta: ' + r.pausa.avisos + (r.pausa.avisos > 1 ? ' avisos que saíram com os teus avisos em pausa e não te chegaram'
    : ' aviso que saiu com os teus avisos em pausa e não te chegou') + ' (davam ' + sinal(r.pausa.ganhos - r.pausa.perdas) + ').</p>' : ''
  // 29/10 («este cálculo deve tar todo errado»): só os avisos do bot; os sinais das estratégias que também vão para o Telegram
  // ficam fora da banca, com o que davam numa linha à parte
  const outros = r.outros ? '<p>Não entram os ' + r.outros.avisos + ' sinais das estratégias (ZIMBA FX, Abertura, Elliott...) que foram para o Telegram desde '
    + diaDe(r.outros.desde * 1000) + ': com ' + fmt(r.lote, 2) + ' lotes davam ' + sinal(r.outros.ganhos - r.outros.perdas) + '. Cada uma tem a linha dela no placar.</p>' : ''
  $('resultadoDica').innerHTML = r.avisos ? '<p>Quanto davam os avisos do bot no Telegram (teto, pico, INCRÍVEL e SV3), todos com ' + fmt(r.lote, 2) + ' lotes' + (r.custo ? ', já sem o spread (' + fmt(r.custo, 2) + NB + '$ em cada aviso)' : '') + '.</p>' + erros
    + parteHoje + parteDesde + parteTP + certo + pausa + outros : ''
  // 24/10 («podes meter isto noutro sítio ou arquiva»): o card das estratégias de TP fica arquivado (estrategiasTP); no lugar
  // dele, o placar de cada estratégia
  placarTP(r.placar)
  faturacao(r)
  if (b) {
    // 30/10 («em vez disto aqui tu vais meter tipo calendário de faturação»): a banca, a conferência e os TP saem daqui para
    // o botão do calendário (faturacao); continuam na dica, e a conferência também no calendário.
    // 25/10 («mete uma cena do dia de hoje: SL e TPs»): quantos avisos tocaram cada TP hoje e quantos bateram no stop
    $('resultadoTxt').innerHTML = r.hoje ? '<span class="hojeTP">Hoje: ' + (r.hoje.tp.some(n => n) ? r.hoje.tp.map((n, i) => n ? '<b class="num sobe">' + n + NB + 'TP' + (i + 1) + '</b>' : '').filter(Boolean).join(' · ') : '<b class="num">0' + NB + 'TP</b>')
      + ' · <b class="num' + (r.hoje.sl ? ' desce' : '') + '">' + r.hoje.sl + NB + 'SL</b></span>' : ''
    return
  }
  $('resultadoTxt').innerHTML = 'Desde ' + dia + ' com ' + fmt(r.lote, 2) + ': ' + (r.avisos
    ? '<b class="num sobe">+' + fmt(r.ganhos, 0) + ' €</b> feitos · <b class="num' + (r.perdas >= 0.5 ? ' desce">-' : '">') + fmt(r.perdas, 0) + ' €</b> perdidos'
    : '<b>ainda sem avisos</b>')
}
// 30/10 («em vez disto aqui tu vais meter tipo calendário de faturação [...] dia 19 como se tivesse começado com 500 euros de
// banca, dia 20 500 euros de banca e o profit»; «de dia 1 até dia 31 deste mês [...] vermelhos caso tenha ficado negativo ou
// verdes caso positivos»): o botão da barra diz o resultado do mês. Cada dia começa outra vez com a banca inicial e leva os
// avisos que acabaram nele (diasDaBanca, como o Hoje)
// 30/10, depois («esta parte quero que seja uma página mesmo [...] para assim termos mais informação, não quero tipo popform»):
// ao carregar, uma página no lugar das três colunas, com #faturacao no endereço (o voltar atrás e o recarregar ficam nela). Por
// cima as contas do mês; o calendário com o total de cada semana; por baixo o dia escolhido, aviso a aviso (fechos), e esse
// dia por estratégia
let fatR = null, fatMes = null, fatDia = null
const roFat = new ResizeObserver(es => es.forEach(e => pontas(e.target)))
const fatSinal = v => (v >= 0.5 ? '+' : v <= -0.5 ? '-' : '') + fmt(Math.abs(v), 0) + NB + '€', fatCor = v => v >= 0.5 ? ' sobe' : v <= -0.5 ? ' desce' : ''
const diaLxDe = ms => new Date(ms).toLocaleDateString('en-CA', { timeZone: LX })
const outroMes = (m, k) => { const [a, b] = m.split('-').map(Number); return new Date(Date.UTC(a, b - 1 + k, 1)).toISOString().slice(0, 7) }
// como acabou cada aviso pela regra (31/10, tudo no TP2: o TP2 vale 2 vezes o stop, o stop menos uma)
const FIM_FAT = { tp2: 'chegou ao TP2', stop: 'bateu no stop' }
const R_FAT = { tp2: 2, stop: -1 }
function faturacao(r) {
  if (!r?.dias || !r.banca) return
  fatR = r
  const v = r.dias.filter(d => d.dia.startsWith(diaLxDe(Date.now()).slice(0, 7))).reduce((s, d) => s + d.eur, 0)
  $('fatBtnV').className = 'num' + fatCor(v); $('fatBtnV').textContent = fatSinal(v); $('fatBtn').hidden = false
  if (!$('pagFat').hidden) desenharFat()
}
function desenharFat() {
  const r = fatR
  if (!r) return
  const hoje = diaLxDe(Date.now()), ini = r.banca.inicio, desde = diaLxDe(r.desde * 1000)
  // 30/10 («não quero que tu inventes resultados»): só os avisos que foram para o Telegram; os dias antes do primeiro dizem-no
  const primeiro = r.primeiro ? diaLxDe(r.primeiro * 1000) : null
  const mHoje = hoje.slice(0, 7), mIni = desde.slice(0, 7), m = fatMes && fatMes >= mIni && fatMes <= mHoje ? fatMes : mHoje
  const [a, mm] = m.split('-').map(Number), n = new Date(Date.UTC(a, mm, 0)).getUTCDate(), vazios = (new Date(Date.UTC(a, mm - 1, 1)).getUTCDay() + 6) % 7
  const D = new Map(r.dias.map(d => [d.dia, d])), doMes = r.dias.filter(d => d.dia.startsWith(m)), total = doMes.reduce((s, d) => s + d.eur, 0)
  const F = (r.fechos || []).map(f => ({ ...f, dia: diaLxDe(f.tf * 1000) })), fMes = F.filter(f => f.dia.startsWith(m))
  // 30/10 («acho que está a faltar infos, hoje não houve elliot»): os sinais das estratégias que foram para o Telegram, à parte e
  // em pips, como ao lado. Ficam fora da banca e do calendário (29/10) e o stop deles chega aos 51 $, que com o lote dele dava
  // mais de 1 400 € num só sinal. Os pips pela mesma regra dos avisos, já sem o spread
  const FO = (r.fechosOutros || []).map(f => ({ ...f, dia: diaLxDe(f.tf * 1000), pips: R_FAT[f.fim] * f.R - (r.custo || 0) }))
  const nomeE = Object.fromEntries((r.placar || []).map(e => [e.id, e.nome.replace(/^ZIMBA FX: /, '')]))
  const pips = x => { const d = Math.round(Math.abs(x) * 10) / 10; return (x < 0 && d ? '-' : d ? '+' : '') + fmt(d, d % 1 ? 1 : 0) }
  const emPausa = dia => { const t = Date.parse(dia + 'T12:00:00Z') / 1000; return (r.pausas || []).some(([p0, p1]) => t >= p0 && t < p1) }
  const nomeDia = (dia, o = { weekday: 'long', day: 'numeric', month: 'long' }) => new Date(dia + 'T12:00:00Z').toLocaleDateString('pt-PT', { timeZone: 'UTC', ...o })
  const ganha = v => v >= 0.5 ? ' ganha' : v <= -0.5 ? ' perde' : ''
  const contas = x => [x.lucro && x.lucro + ' com lucro', x.stops && x.stops + ' no stop'].filter(Boolean)
  // no quadrado, com os sinais da lista do dia (✓ com lucro, ✗ no stop), para caber numa linha; por extenso ao passar o rato
  const sinais = x => [x.lucro && '<span class="sobe">✓' + NB + x.lucro + '</span>', x.stops && '<span class="desce">✗' + NB + x.stops + '</span>'].filter(Boolean).join(' · ')
  // o dia escolhido: o que ele carregou, se for deste mês; senão hoje, se já fechou algum aviso, ou o último dia com avisos fechados
  const dia = fatDia?.startsWith(m) ? fatDia : hoje.startsWith(m) && D.has(hoje) ? hoje : doMes.at(-1)?.dia ?? (m === mHoje ? hoje : m + '-01')

  // as contas do mês
  const bons = fMes.filter(f => R_FAT[f.fim] > 0).length, stops = fMes.filter(f => f.fim === 'stop').length
  const ganhou = fMes.reduce((s, f) => s + Math.max(0, f.eur), 0), perdeu = fMes.reduce((s, f) => s + Math.max(0, -f.eur), 0)
  const verdes = doMes.filter(d => d.eur >= 0.5).length, vermelhos = doMes.filter(d => d.eur <= -0.5).length
  const ord = [...doMes].sort((x, y) => y.eur - x.eur), melhor = ord[0], pior = ord.at(-1)
  const k = (rot, v, cls, sub) => '<div class="fat-k"><div class="lc-rot">' + rot + '</div><b class="num' + cls + '">' + v + '</b><span>' + sub + '</span></div>'
  const resumo = '<div class="fat-resumo">'
    + k('No mês', fatSinal(total), fatCor(total), fMes.length ? 'ganhou ' + fmt(ganhou, 0) + ' € e perdeu ' + fmt(perdeu, 0) + ' €' : 'ainda nenhum aviso fechou')
    + k('Avisos fechados', fMes.length, '', bons + ' com lucro · ' + stops + ' no stop')
    + k('Acerto', fMes.length ? Math.round(100 * bons / fMes.length) + '%' : '-', '', 'fecharam com lucro')
    + k('Dias verdes', verdes + ' de ' + doMes.length, '', vermelhos + (vermelhos === 1 ? ' vermelho' : ' vermelhos'))
    + k('Melhor dia', melhor ? fatSinal(melhor.eur) : '-', melhor ? fatCor(melhor.eur) : '', melhor ? nomeDia(melhor.dia, { weekday: 'long', day: 'numeric' }) : '')
    + k('Pior dia', pior ? fatSinal(pior.eur) : '-', pior ? fatCor(pior.eur) : '', pior ? nomeDia(pior.dia, { weekday: 'long', day: 'numeric' }) : '') + '</div>'

  // o calendário: um quadrado por dia (os de fora do Jarvis sem botão) e, no fim de cada semana, o total dela
  const celula = d => {
    const x = D.get(d), eHoje = d === hoje, dentro = d >= desde && d <= hoje, cls = 'fat-d' + (eHoje ? ' hoje' : '') + (x ? ganha(x.eur) : '')
    const topo = '<span class="fat-n">' + +d.slice(8) + (eHoje ? ' · hoje' : '') + '</span>'
    // (o € num span: no telemóvel sai, para o número caber no quadrado)
    const corpo = x ? '<b class="fat-v num">' + fatSinal(x.eur).replace(NB + '€', '<span class="fat-eur">' + NB + '€</span>') + '</b><span class="fat-s num">' + fmt(ini, 0) + ' → ' + fmt(ini + x.eur, 0) + NB + '€</span><span class="fat-s fat-sinais num">' + sinais(x) + '</span>'
        // abaixo de zero pelo caminho (a banca de 500 € não aguentava); só se desceu mais do que o fim, que já está à vista
        + (x.minimo < 0 && x.minimo < ini + x.eur - 0.5 ? '<span class="fat-s desce">pelo caminho: ' + fmt(x.minimo, 0) + NB + '€</span>' : '')
      : dentro && emPausa(d) ? '<span class="fat-s">avisos em pausa</span>' : eHoje ? '<span class="fat-s">ainda nenhum fechou</span>'
      : primeiro && dentro && d < primeiro ? '<span class="fat-s">sem avisos</span>' : ''
    return dentro ? '<button type="button" class="' + cls + (d === dia ? ' sel' : '') + '" data-dia="' + d + '" aria-pressed="' + (d === dia) + '"' + (x ? ' title="' + esc(contas(x).join(', ')) + '"' : '') + '>' + topo + corpo + '</button>'
      : '<div class="' + cls + ' fora">' + topo + corpo + '</div>'
  }
  const semana = L => {
    const X = L.map(d => d && D.get(d)).filter(Boolean), v = X.reduce((s, x) => s + x.eur, 0), q = X.reduce((s, x) => s + x.lucro + x.stops, 0)
    return X.length ? '<div class="fat-d fat-sem' + ganha(v) + '"><span class="fat-n">semana</span><b class="fat-v num">' + fatSinal(v) + '</b><span class="fat-s">' + q + (q === 1 ? ' aviso' : ' avisos') + '</span></div>' : '<div class="fat-d vazio fat-sem"></div>'
  }
  const dias = [...Array(vazios).fill(null), ...Array.from({ length: n }, (_, i) => m + '-' + String(i + 1).padStart(2, '0'))]
  while (dias.length % 7) dias.push(null)
  const cal = '<div class="fat-cal">' + ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom', 'semana'].map(x => '<div class="fat-dsem">' + x + '</div>').join('')
    + Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7)).map(L => L.map(d => d ? celula(d) : '<div class="fat-d vazio"></div>').join('') + semana(L)).join('') + '</div>'

  // o dia escolhido, aviso a aviso, pela ordem a que fecharam
  const x = D.get(dia), L = F.filter(f => f.dia === dia), h = ms => (diaLxDe(ms) === dia ? '' : diaDe(ms) + ' ') + hhmm(ms), as = ms => (diaLxDe(ms) === dia ? 'às ' : 'a ' + diaDe(ms) + ' às ') + hhmm(ms)
  let baixo = ini, tBaixo = null, corre = ini
  for (const f of L) { corre += f.eur; if (corre < baixo) { baixo = corre; tBaixo = f.tf } }
  // (os das estratégias em pips; os que ainda não fecharam sem o fim)
  const aviso = (f, emPips) => {
    const aberto = !f.fim, ok = R_FAT[f.fim] > 0, tps = (f.hits || []).map((t, i) => t != null && i < 2 && !(f.fim === 'tp2' && i === 1) ? 'TP' + (i + 1) + ' ' + h(t * 1000) : '').filter(Boolean)
    return '<li class="fat-a"><span class="' + (aberto ? 'suave">·' : ok ? 'sobe">✓' : 'desce">✗') + '</span><span class="fat-a-l ' + (f.lado === 'venda' ? 'desce">Venda' : 'sobe">Compra') + '</span>'
      + '<span class="fat-a-n">' + (f.n ? '#' + f.n + ' ' : '') + esc(CURTO_AVISO[f.tipo] || nomeE[f.tipo] || f.tipo) + '</span>'
      + (aberto ? '<b class="fat-a-v suave">a decorrer</b>' : emPips ? '<b class="fat-a-v num' + fatCor(f.pips) + '">' + pips(f.pips) + NB + 'pips</b>' : '<b class="fat-a-v num' + fatCor(f.eur) + '">' + fatSinal(f.eur) + '</b>')
      + '<span class="fat-a-s">saiu ' + as(f.t * 1000) + ' · stop de ' + fmt(f.R, 2) + NB + '$' + (tps.length ? ' · ' + tps.join(' · ') : '') + (aberto ? '' : ' · ' + FIM_FAT[f.fim] + ' ' + as(f.tf * 1000)) + '</span></li>'
  }
  // as estratégias do dia, por baixo: as que fecharam nele e, no fim, as que saíram nele e ainda não fecharam
  const LO = [...FO.filter(f => f.dia === dia), ...(r.abertosOutros || []).filter(a => diaLxDe(a.t * 1000) === dia)], somaO = LO.reduce((s, f) => s + (f.fim ? f.pips : 0), 0)
  const doDiaO = LO.length ? '<div class="fat-fora"><div class="fat-dia-cab"><h3 class="lc-rot">Outras estratégias</h3>' + (LO.some(f => f.fim) ? '<b class="fat-a-v num' + fatCor(somaO) + '">' + pips(somaO) + NB + 'pips</b>' : '') + '</div>'
    + '<ul class="fat-avisos">' + LO.map(f => aviso(f, true)).join('') + '</ul></div>' : ''
  const semNada = emPausa(dia) ? 'Os teus avisos estavam em pausa: o que saiu não te chegou e não conta.'
    : primeiro && dia < primeiro ? 'Ainda não tinha ido nenhum aviso para o Telegram. O primeiro foi a ' + diaDe(r.primeiro * 1000) + ' às ' + hhmm(r.primeiro * 1000) + '.'
    : dia === hoje ? 'Ainda nenhum aviso fechou hoje.' : 'Nenhum aviso fechou neste dia.'
  // 31/10 («isto aqui tem que ser scroll senão fica super grande»): o nome do dia, o total e a banca ficam parados e os avisos
  // deslizam por dentro do cartão (estilo.css, .fat-desliza), como no cartão da ordem
  const desliza = (x ? '<ul class="fat-avisos">' + L.map(f => aviso(f)).join('') + '</ul>' : '')
    + (dia === hoje && r.abertos ? '<p class="fat-dia-txt">Ainda a decorrer: ' + r.abertos + (r.abertos > 1 ? ' avisos, que só contam quando fecharem.' : ' aviso, que só conta quando fechar.') + '</p>' : '') + doDiaO
  const doDia = '<section class="fat-cartao" aria-labelledby="fatDiaTit"><div class="fat-dia-cab"><div><div class="lc-rot">Dia escolhido</div><h2 class="fat-dia-nome" id="fatDiaTit">' + nomeDia(dia) + '</h2></div>'
      + (x ? '<b class="fat-dia-v num' + fatCor(x.eur) + '">' + fatSinal(x.eur) + '</b>' : '') + '</div>'
    + '<p class="fat-dia-txt">' + (x ? 'Começou com ' + fmt(ini, 0) + ' € e acabou com ' + fmt(ini + x.eur, 0) + ' €' + (tBaixo && baixo < ini + x.eur - 0.5 ? '; o mais baixo foi ' + fmt(baixo, 0) + ' €, às ' + hhmm(tBaixo * 1000) : '') + '.' : semNada) + '</p>'
    + (desliza ? '<div class="fat-desliza" data-de="' + dia + '" tabindex="0" role="region" aria-label="Avisos do dia">' + desliza + '</div>' : '') + '</section>'

  // 31/10 («eu quero que seja daquele dia selecionado»): o dia escolhido (era o mês, que fica nas contas de cima). Depois
  // («não há fora da estratégia, é tudo estratégia»): as do bot e as outras na mesma lista, de igual para igual, em pips, da
  // que deu mais para a que deu menos; os € dos avisos do bot ficam no cartão ao lado
  // 31/10 («epa não sei, melhora isso»): os fechos com os sinais do calendário (✓ com lucro, ✗ no stop) em vez de
  // quatro colunas de números, e ao pé dos pips uma barra fina com o tamanho de cada uma (as perto de zero ficam apagadas)
  const linha = (nome, T, v, maior, parte) => {
    const x = { lucro: T.filter(f => R_FAT[f.fim] > 0).length, stops: T.filter(f => f.fim === 'stop').length }
    return '<tr' + (parte ? ' class="fat-parte"' : '') + '><td>' + esc(nome) + '</td><td class="fat-t-s num" title="' + esc(contas(x).join(', ')) + '">' + sinais(x) + '</td><td class="fat-t-p"><div><span class="fat-barra" aria-hidden="true"><i class="'
      + (v < 0 ? 'desce' : 'sobe') + '" style="width:' + (100 * Math.abs(v) / maior).toFixed(1) + '%"></i></span><b class="num' + (fatCor(v) || ' suave') + '">' + pips(v) + '</b></div></td></tr>'
  }
  // 31/10 («a sv3 é das melhores e não meteste em praticamente nenhum dos dias»): o BOT SV3 do placar são os avisos do bot todos
  // juntos (teto, pico, INCRÍVEL e as linhas do SV3, que sozinhas só deram um aviso desde 19/10). Aqui também: uma linha com a
  // soma deles e, por baixo, os tipos que fecharam nesse dia, como no placar
  const porTipo = l => [...new Set(l.map(f => f.tipo))].map(t => { const T = l.filter(f => f.tipo === t); return { t, T, v: T.reduce((s, f) => s + f.pips, 0) } }).sort((p, q) => q.v - p.v)
  const doBot = L.map(f => ({ ...f, pips: R_FAT[f.fim] * f.R - (r.custo || 0) })), partes = porTipo(doBot), PARTE = { ...NOME_AVISO, sv3: 'Linhas do SV3' }
  const estrDia = [...(doBot.length ? [{ t: 'bot', T: doBot, v: partes.reduce((s, o) => s + o.v, 0), partes }] : []), ...porTipo(LO.filter(f => f.fim))].sort((p, q) => q.v - p.v)
  const escala = Math.max(1e-9, ...[...estrDia, ...partes].map(o => Math.abs(o.v)))
  // 31/10 («quero que isto seja mais relevante»): com título como o do cartão do dia, ao lado dele e da mesma largura (estilo.css).
  // Depois («mete o total de pips em cima à direita»): o total do dia em pips, onde o cartão do dia tem os €
  const somaE = estrDia.reduce((s, o) => s + o.v, 0)
  const porEstr = estrDia.length ? '<section class="fat-cartao" aria-labelledby="fatTiposTit"><div class="fat-dia-cab"><div><div class="lc-rot">Por estratégia</div><h2 class="fat-dia-nome" id="fatTiposTit">' + nomeDia(dia) + '</h2></div>'
    + '<b class="fat-dia-v num' + fatCor(somaE) + '">' + pips(somaE) + NB + 'pips</b></div><table class="fat-tipos"><thead><tr><th scope="col">Estratégia</th><th scope="col">Avisos</th><th scope="col">Pips</th></tr></thead><tbody>'
    + estrDia.map(o => linha(o.partes ? nomeE.bot || 'BOT SV3' : nomeE[o.t] || o.t, o.T, o.v, escala) + (o.partes || []).map(p => linha(PARTE[p.t] || p.t, p.T, p.v, escala, true)).join('')).join('') + '</tbody></table></section>' : ''

  const seta = (k, nome, d) => '<button type="button" class="fat-seta" data-mes="' + k + '" aria-label="' + nome + '"' + ((k < 0 ? m <= mIni : m >= mHoje) ? ' disabled' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg></button>'
  const foco = document.activeElement?.closest?.('#pagFat [data-mes], #pagFat [data-dia], #pagFat .fat-desliza'), qual = foco && (foco.dataset.mes ? '[data-mes="' + foco.dataset.mes + '"]' : foco.dataset.dia ? '[data-dia="' + foco.dataset.dia + '"]' : '.fat-desliza')
  // (a lista do dia volta ao sítio onde ele a deixou quando as contas se refazem; noutro dia começa do princípio)
  const rolo = $('fatCorpo').querySelector('.fat-desliza'), y = rolo?.dataset.de === dia ? rolo.scrollTop : 0
  $('fatMes').innerHTML = (mIni < mHoje ? seta(-1, 'Mês anterior', 'm15 6-6 6 6 6') : '') + '<b>' + nomeDia(m + '-15', { month: 'long', year: 'numeric' }) + '</b>' + (mIni < mHoje ? seta(1, 'Mês seguinte', 'm9 6 6 6-6 6') : '')
  // 31/10 («podes retirar isto daqui»): sem a coluna das estratégias em pips ao lado (desde 19/10); essa tabela fica por baixo
  // do gráfico, e o calendário e o dia escolhido ficam com a largura toda
  $('fatCorpo').innerHTML = resumo + cal
    + '<p class="fat-nota">Cada dia começa com ' + fmt(ini, 0) + ' € de banca: só os avisos do BOT SV3 que foram mesmo para o Telegram (teto, pico, INCRÍVEL e linhas do SV3), com ' + fmt(r.lote, 2) + ' lotes e já sem o spread (' + fmt(r.custo, 2) + NB + '$ em cada aviso). Cada aviso conta no dia em que fechou. As outras estratégias que foram para o Telegram contam em pips, sem mexer na banca. Carrega num dia para ver os avisos dele aqui em baixo.</p>'
    + (r.conferencia?.erros || []).map(e => '<p class="fat-nota desce">⚠ ' + esc(e) + '</p>').join('')
    + '<div class="fat-baixo">' + doDia + porEstr + '</div>'
  const novo = $('fatCorpo').querySelector('.fat-desliza')
  roFat.disconnect()
  if (novo) { novo.scrollTop = y; pontas(novo); roFat.observe(novo) }
  if (qual) $('pagFat').querySelector(qual)?.focus({ preventScroll: true })
}
{
  const pag = $('pagFat'), grelha = document.querySelector('main.grelha'), btn = $('fatBtn')
  const naPagina = () => location.hash === '#faturacao'
  const mostrar = () => {
    const on = naPagina()
    pag.hidden = !on; grelha.hidden = on; document.body.classList.toggle('naPagina', on); btn.setAttribute('aria-pressed', on)
    if (on) { desenharFat(); $('resultadoDica').hidden = true }
  }
  const abrir = () => { fatMes = null; fatDia = null; history.pushState({ fat: 1 }, '', '#faturacao'); mostrar(); pag.scrollTop = 0; $('fatVoltar').focus() }
  const voltar = () => { if (history.state?.fat) history.back(); else { history.replaceState(null, '', location.pathname + location.search); mostrar() } btn.focus() }
  btn.addEventListener('click', () => naPagina() ? voltar() : abrir())
  $('fatVoltar').addEventListener('click', voltar)
  addEventListener('popstate', mostrar)
  pag.addEventListener('scroll', e => { if (e.target.classList?.contains('fat-desliza')) pontas(e.target) }, { capture: true, passive: true })
  pag.addEventListener('click', e => {
    const s = e.target.closest('.fat-seta'), d = e.target.closest('[data-dia]')
    if (s) { fatMes = outroMes(fatMes || diaLxDe(Date.now()).slice(0, 7), +s.dataset.mes); fatDia = null; desenharFat() }
    else if (d) {
      fatDia = d.dataset.dia; desenharFat()
      const c = $('fatDiaTit')?.closest('.fat-cartao'), falta = c ? c.getBoundingClientRect().top - (pag.getBoundingClientRect().bottom - 240) : 0
      if (falta > 0) pag.scrollBy({ top: falta, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  })
  mostrar()
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
  // 25/10 («faz assim para não ocupar tanto»): os avisos do bot numa linha só, «BOT», com uma setinha; ao carregar nela
  // abrem-se por baixo os tipos (com e sem dólar e petróleo, pico, teto, INCRÍVEL e SV3). Fica como ele deixou
  const filho = e => /^bot-/.test(e.id), F = L.filter(filho), aberto = !!est.botAberto
  const nome = e => '<b>' + esc(e.nome).replace(/^BOT/, '<span class="ouro">BOT</span>').replace(/^ZIMBA FX/, '<span class="ouro laranja">ZIMBA FX</span>') + '</b>'
  const linha = e => {
    const grupo = e.id === 'bot' && F.length
    return '<tr title="' + esc(e.autor) + '"' + (grupo ? ' class="grupo"' : filho(e) ? ' data-de="bot"' + (aberto ? '' : ' hidden') : '') + '><td>'
      + (grupo ? '<button type="button" class="abreGrupo" aria-expanded="' + aberto + '">' + nome(e) + setaGrupo(aberto) + '</button>' : nome(e))
      + (e.partes ? ' <span class="partes">' + esc(e.partes) + '</span>' : '') + '</td>'
      + '<td class="num">' + (e.abertas ? '<span class="decorrer" title="' + e.abertas + (e.abertas > 1 ? ' entradas ainda a decorrer' : ' entrada ainda a decorrer') + '">' + RELOGIO + e.abertas + '</span>' : '') + e.n + '</td>'
      + e.tp.map(k => '<td class="num">' + pct(k, e.n) + '</td>').join('') + '<td class="num">' + pct(e.stop, e.n) + '</td>'
      + '<td class="num' + cor(e.pips) + '">' + (e.n ? pips(e.pips) : '-') + '</td></tr>'
  }
  // as duas colunas dividem-se com o BOT fechado; aberto, os tipos vão logo por baixo dele e só essa coluna cresce
  const comTipos = l => l.flatMap(e => e.id === 'bot' ? [e, ...F] : [e])
  const tabela = l => '<table class="placar"><thead><tr><th>Estratégia</th><th>Entradas</th><th>TP1</th><th>TP2</th><th>TP3</th><th>Stop</th><th>Pips</th></tr></thead><tbody>' + comTipos(l).map(linha).join('') + '</tbody></table>'
  const V = L.filter(e => !filho(e)), meio = Math.ceil(V.length / 2)
  // 27/10: o BOT conta como saiu no Telegram (a regra, sem limite de horas); as outras medem-se nas velas, até 24 h cada.
  // 29/10 («estas estratégias são por dia ou desde sempre?»): diz que é tudo somado e que as 24 h são de cada entrada
  el.innerHTML = '<div class="tit"><span>Estratégias</span><span>tudo somado desde 19/10 · o BOT como no Telegram; nas outras, cada entrada até 24 h<span class="legDecorrer">' + RELOGIO + 'a decorrer</span></span></div>'
    + '<div class="placarDuas">' + tabela(V.slice(0, meio)) + tabela(V.slice(meio)) + '</div>'
  el.hidden = false
}
// 25/10 («tenta meter isto de outra forma»): as entradas a decorrer com um relógio pequeno e o número, em vez de «a decorrer +2»
const RELOGIO = '<svg class="relogio" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4"/><path d="M5 3v2.2l1.4 1"/></svg>'
const setaGrupo = aberto => '<svg class="seta" viewBox="0 0 10 10" aria-hidden="true"><path d="' + (aberto ? 'M2 6.5 5 3.5 8 6.5' : 'M2 3.5 5 6.5 8 3.5') + '"/></svg>'
// carregar na linha do BOT (ou na setinha) abre e fecha os tipos, sem desenhar a tabela outra vez
$('estrTP').addEventListener('click', e => {
  const g = e.target.closest('tr.grupo')
  if (!g) return
  est.botAberto = !est.botAberto; guardar()
  const b = g.querySelector('.abreGrupo')
  b.setAttribute('aria-expanded', est.botAberto); b.querySelector('.seta').outerHTML = setaGrupo(est.botAberto)
  for (const r of $('estrTP').querySelectorAll('tr[data-de="bot"]')) r.hidden = !est.botAberto
})
// 31/10 (desempenho): a luz do BOT e do ZIMBA FX (24/10, «mete tipo a ouro a brilhar») era uma animação de CSS sem fim e o
// ecrã refazia os estilos 60 vezes por segundo, também com a luz parada fora das letras: 70% do trabalho do ecrã parado.
// Agora passa daqui, igual (1,4 s a cada 3,5 s), só com o placar à vista e a janela aberta
{
  let aVista = false
  new IntersectionObserver(l => { aVista = l.at(-1).isIntersecting }).observe($('estrTP'))
  const calma = matchMedia('(prefers-reduced-motion: reduce)')
  setInterval(() => {
    if (!aVista || document.hidden || calma.matches) return
    for (const s of $('estrTP').querySelectorAll('.placar .ouro')) if (s.offsetParent) s.animate([{ backgroundPosition: '100% 0' }, { backgroundPosition: '0 0' }], { duration: 1400, easing: 'ease-in-out' })
  }, 3500)
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
// 29/10 («o meu sócio não tem muitas coisas que eu tenho, tipo lucro: mete mesmo igual como eu tou a ver»): o amigo também
// tem a barra, com os € e o placar (antes só o placar); na nuvem vem da volta, de 2 em 2 min
{ const res = () => api('resultado').then(resultado, () => {}); res(); setInterval(seVisivel(res), 60e3) }
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
  const s = 'semRede' in q ? q.semRede ?? null : semRede, mudou = !!q.pausa !== pausado
  if (!mudou && s === semRede) return
  pausado = !!q.pausa; semRede = s
  pintarLigacao()
  if (mudou) pintarPausa()
}
// 25/10 («adiciona aqui o play pause mas apenas eu é que o posso usar»): no título das notícias, o mesmo pausa e play do botão
// do Orca (pára as notícias, o que gasta créditos). Na entrada do amigo não aparece nem tem rota
const bPausa = $('pausaNot')
function pintarPausa() {
  if (AMIGO) return
  const t = pausado ? 'Retomar as notícias' : 'Pausar as notícias, para não gastarem créditos'
  bPausa.innerHTML = pausado ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.8v14.4c0 .8.9 1.3 1.6.9l11-7.2c.6-.4.6-1.4 0-1.8l-11-7.2C8.9 3.5 8 4 8 4.8Z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></svg>'
  bPausa.title = t; bPausa.setAttribute('aria-label', t); bPausa.hidden = false
}
if (!AMIGO) {
  pintarPausa()
  bPausa.addEventListener('click', async () => {
    bPausa.disabled = true
    try { verPausa(await post('pausa', { pausa: !pausado })); api('analise?s=' + est.simbolo).then(d => { if (d.simbolo === est.simbolo) analise(d) }, () => {}) }
    catch {} finally { bPausa.disabled = false }
  })
}
// 25/10: em pausa só param as notícias; os eventos continuam a chegar e o gráfico anda (antes refazia-se de 2 em 2 min)
api('ping').then(p => { const v0 = p.versao; verPausa(p); setInterval(seVisivel(() => api('ping').then(q => {
  if (q.versao && v0 && q.versao !== v0) location.reload()
  verPausa(q)
}, () => {})), 15e3) }, () => {})
// 29/10 («ele diz que ainda não está»: o Chrome do sócio ficou com a versão antiga, mesmo a recarregar): na nuvem o ping
// não traz a versão, por isso a página sabe com que versão foi publicada (nuvem/publicar.sh) e vê de 2 em 2 min a
// versao.txt; se já há outra, recarrega sozinha (no máximo uma vez em 5 min, se o GitHub ainda der a antiga)
if (window.JARVIS_VERSAO) setInterval(seVisivel(() => fetch('versao.txt?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(v => {
  v = v.trim()
  if (!v || v === window.JARVIS_VERSAO || Date.now() - (+sessionStorage.recarregou || 0) < 5 * 60e3) return
  sessionStorage.recarregou = Date.now(); location.reload()
}).catch(() => {})), 2 * 60e3)
// 31/10 («desempenhos melhores no mobile»): na página do amigo o gráfico (uns 125 KB pela rede) vinha de 30 em 30 s, também
// nas Notícias e com o mercado fechado: 17 MB por hora no telemóvel, parado. No ecrã pequeno só se pede com o Gráfico ou a
// Ordem à vista (os avisos abertos vêm com ele) e, com o mercado fechado, de 5 em 5 min. Ao voltar a um deles, vem logo
let graficoAtrasado = false, graficoEm = Date.now()
const ecraPequeno = matchMedia('(max-width: 1000px), (max-height: 520px)')
function graficoDeTempo() {
  if (ecraPequeno.matches && !['grafico', 'ordem'].includes(document.body.dataset.m)) { graficoAtrasado = true; return }
  const ny = horaEm('America/New_York')
  if (!graficoAtrasado && (fimDeSemana(ny) || ny.h === 17) && Date.now() - graficoEm < 5 * 60e3) return
  graficoAtrasado = false; graficoEm = Date.now(); carregarGrafico()
}
if (AMIGO) {
  const estado = ok => { ligado = ok; pintarLigacao() }
  estado(true)
  setInterval(seVisivel(() => { api('analise?s=' + est.simbolo).then(d => { estado(true); if (d.simbolo === est.simbolo) analise(d) }, () => estado(false)); graficoDeTempo() }), 30e3)
  // o radar e a força estão escondidos (23/10) e a nuvem já não os faz (28/10)
  setInterval(seVisivel(() => api('observacoes').then(observacoes, () => {})), 120e3)
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
  // 25/10 («melhorar o ux dos cards»): o título já diz «Confirmam compras»; por baixo fica só o porquê, sem o repetir
  const porque = o.texto.replace(/^Confirmam (compras|vendas) no ouro: (.)/, (x, l, c) => c.toUpperCase())
  el.innerHTML = '<div class="mc-ouro ' + o.estado + '"><span class="mc-rot">Para o ouro</span><b class="' + cl + '">' + ({ compra: 'Confirmam compras', venda: 'Confirmam vendas', misto: 'Não confirmam', sem: 'Sem dados' }[o.estado]) + '</b><span class="mc-tx">' + esc(porque) + '</span></div>'
    + m.ativos.map(a => a.erro ? '<div class="mc-at"><div class="mc-n">' + esc(a.nome) + '</div><div class="vazio">Sem dados agora.</div></div>'
      : '<div class="mc-at"><div class="mc-l1"><span class="mc-n">' + esc(a.nome) + '</span><b class="num">' + fmt(a.px, a.casas) + '</b><span class="num ' + (a.var24h >= 0 ? 'sobe' : 'desce') + '">' + (a.var24h >= 0 ? '+' : '') + fmt(a.var24h, 2) + '% em 24 h</span></div>'
        + '<div class="mc-l2"><span class="' + (a.lado === 'sobe' ? 'sobe' : 'desce') + '">' + (a.lado === 'sobe' ? '▲ a subir' : '▼ a descer') + '</span><span class="suave num">' + (a.mov1h >= 0 ? '+' : '') + fmt(a.mov1h, a.casas) + ' na última hora' + (a.parado ? ' · mercado parado' : '') + '</span></div>'
        + '<div class="mc-sp">' + sparkMacro(a.spark) + '<span class="suave">últimas 24 h</span></div></div>').join('')
    + '<div class="mc-nota">O dólar a descer costuma empurrar o ouro para cima; o petróleo a subir costuma ir com ele. Direção pela EMA 50 de 15 min.</div>'
}
setInterval(seVisivel(() => { if (est.aba === 'macro') carregarMacro() }), 60e3)

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
    if (graficoAtrasado && (m === 'grafico' || m === 'ordem')) graficoDeTempo()
  }
  $('mNav').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { mostrar(b.dataset.m); est.mPainel = b.dataset.m; guardar() } })
  // 31/10: no iPhone o :active só pega com um touchstart na página (o separador e os botões respondem ao dedo)
  document.addEventListener('touchstart', () => {}, { passive: true })

  // 31/10 («melhora funções no mula forex em termos de mobile»): a barra de cima não aparece no telemóvel, e com ela iam a
  // faturação e os lucros. Ficam no cimo da Ordem: dois botões que carregam nos de sempre e mostram o mesmo número
  const mc = document.createElement('div'); mc.className = 'mConta'
  mc.innerHTML = [['fatBtn', 'Faturação do mês'], ['lucrosBtn', 'Lucros de hoje']].map(([id, nome]) => '<button type="button" data-b="' + id + '" hidden'
    + (id === 'lucrosBtn' ? ' aria-haspopup="dialog"' : '') + '><span>' + nome + '</span><b class="num"></b>' + SVG('<path d="m9 6 6 6-6 6"/>') + '</button>').join('')
  $('plano').closest('.card').querySelector('.tit').after(mc)
  mc.addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (b) $(b.dataset.b).click() })
  const copiarConta = () => {
    for (const b of mc.children) {
      const o = $(b.dataset.b), v = b.dataset.b === 'fatBtn' ? $('fatBtnV') : o.querySelector('b')
      b.hidden = o.hidden || !v?.textContent
      if (v) { const d = b.querySelector('b'); d.className = v.className; d.textContent = v.textContent.replace(/\s*hoje$/, '') }
    }
  }
  for (const id of ['fatBtn', 'lucrosBtn']) new MutationObserver(copiarConta).observe($(id), { attributes: true, attributeFilter: ['hidden'], childList: true, characterData: true, subtree: true })
  copiarConta()

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
    ['Entradas', { sinais: 'setas dos sinais do robô', velas: 'velas de confirmação', alvos: 'caixas até ao TP2 e ao stop', plano: 'entrada, stop e TP da ordem', posicoes: 'as posições abertas' }],
    ['Por baixo', { estoc: 'Estocástico 5,3,3' }]]
  const listaCam = () => CAM.flatMap(([g, d]) => [{ grupo: g }, ...Object.entries(d).map(([c, sub]) => { const b = $('camadas').querySelector('[data-c="' + c + '"]'); return b && { nome: b.textContent, sub, on: !!est.camadas[c], b } }).filter(Boolean)])
  barra.querySelector('.cam').addEventListener('click', () => abrir('Camadas no gráfico', listaCam, x => x.b.click(), true))
  $('camBtn').addEventListener('click', e => abrir('Camadas no gráfico', listaCam, x => x.b.click(), true, e.currentTarget))
  // a lista das estratégias por grupos, cada uma com o que fez desde 19/10 (o placar), as que mais deram primeiro
  const listaEstr = () => {
    const P = Object.fromEntries(ultimoPlacar.map(e => [e.id, e])), ops = [...$('estrSel').options].filter(o => o.value), l = estrEscolhidas()
    const item = o => { const e = P[o.value], m = o.text.match(/^(.*?)\s*\((\d+)\)$/), nome = (m ? m[1] : o.text).replace(/^(ZIMBA FX|BOT): /, '')
      return { nome, nomeHtml: o.value === 'edney' ? '<span class="laranja">ZIMBA FX</span>: todas juntas' : o.value === 'bot' ? '<span class="ouro">BOT</span>: todos os avisos' : null, v: o.value, on: (JUNTAS[o.value] || [o.value]).every(id => l.includes(id)), p: e?.n ? e.pips : null,
        sub: !e ? '' : e.n ? e.n + (e.n === 1 ? ' entrada' : ' entradas') + ' desde 19/10 · TP1 ' + Math.round(100 * e.tp[0] / e.n) + '%' + (e.abertas ? ' · ' + e.abertas + '\u00a0a\u00a0decorrer' : '')
          : e.abertas ? e.abertas + ' a decorrer, desde 19/10' : 'sem entradas desde 19/10',
        ordem: o.value === 'zimba' ? 2e9 : o.value === 'edney' || o.value === 'bot' ? 1e9 : e?.n ? e.pips : -1e9 } }
    // 25/10: o modelo completo dos vídeos dele à frente, depois as cinco juntas e cada uma; o Wyckoff e o Elliott também
    // são da lista dele («mete as 5»)
    const ed = ['zimba', 'edney', ...ZIMBA_CINCO], bt = ['bot', ...JUNTAS.bot], por = l => l.sort((a, b) => b.ordem - a.ordem), B = ops.filter(o => bt.includes(o.value))
    return [{ nome: 'Nenhuma', v: '', on: !l.length, radio: true }, ...(B.length ? [{ grupo: '<span class="ouro">BOT</span>' }, ...por(B.map(item))] : []),
      { grupo: '<span class="ouro laranja">ZIMBA FX</span>' }, ...por(ops.filter(o => ed.includes(o.value)).map(item)),
      { grupo: 'Outras' }, ...por(ops.filter(o => !ed.includes(o.value) && !bt.includes(o.value)).map(item))]
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

// 25/10 («melhorar o ux dos cards»): as abas da direita e o calendário deslizam sem barra; quando há mais por baixo (ou por
// cima) a ponta esbate-se, para se ver que continua (estilo.css, .mais-baixo e .mais-cima)
{
  const ver = el => { el.classList.toggle('mais-cima', el.scrollTop > 1); el.classList.toggle('mais-baixo', el.scrollTop + el.clientHeight < el.scrollHeight - 1) }
  const ro = new ResizeObserver(es => es.forEach(e => ver(e.target)))
  for (const el of [...document.querySelectorAll('.abas .aba'), $('calendario')]) {
    el.addEventListener('scroll', () => ver(el), { passive: true }); ro.observe(el)
    new MutationObserver(() => ver(el)).observe(el, { childList: true, subtree: true, characterData: true })
  }
}

// 24/10 («está desalinhado»): se as camadas não cabem na linha de cima, descem; 25/10: sempre à direita
{
  const c = $('camadas'), t = $('tfs')
  const ver = () => { c.classList.remove('sozinha'); if (c.getBoundingClientRect().top >= t.getBoundingClientRect().bottom) c.classList.add('sozinha') }
  new ResizeObserver(ver).observe(c.parentElement); ver()
}

// 24/10 («caga no modo claro, mete só a opção do gráfico ser branco»; «mete mais opções tipo de cor»): o botão da barra
// de cima (e o «Cor» no telemóvel) escolhe a cor do gráfico entre cinco; só o cartão do gráfico muda, o resto do Jarvis
// fica escuro. Fica guardada. Na troca as transições desligam-se um instante, para mudar de uma vez
// 25/10 («vês estas linhas? faz algo deste tipo, com e sem linhas»): ao lado do «Gráfico», a grelha atrás das velas, com ou
// sem linhas; no telemóvel fica na folha da cor. Fica guardada
const grelhaOpc = (() => {
  const b = $('grelhaBtn'), OPC = [{ id: 'com', nome: 'Com linhas', sub: 'a grelha atrás das velas' }, { id: 'sem', nome: 'Sem linhas', sub: 'o fundo liso, só as velas' }]
  let atual = 'com'; try { atual = localStorage.getItem('jarvis-grelha') || 'com' } catch {}
  const aplicar = id => { atual = id; b.innerHTML = 'Grelha <b>' + (id === 'sem' ? 'Sem linhas' : 'Com linhas') + '</b>' + SVG('<path d="m7 10 5 5 5-5"/>'); grafico.grelha(id !== 'sem') }
  const escolher = x => { aplicar(x.id); try { localStorage.setItem('jarvis-grelha', x.id) } catch {} }
  const lista = () => OPC.map(o => ({ ...o, grelha: true, on: o.id === atual }))
  b.addEventListener('click', e => abrirFolha('Linhas do gráfico', lista, escolher, false, e.currentTarget))
  aplicar(atual)
  return { lista, escolher }
})()
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
  $('mBarra')?.querySelector('.cor')?.addEventListener('click', () => abrirFolha('Cor do gráfico', () => [...lista(), { grupo: 'Linhas' }, ...grelhaOpc.lista()], x => x.grelha ? grelhaOpc.escolher(x) : escolher(x), false))
  let guardado = 'escuro'; try { guardado = localStorage.getItem('jarvis-grafico') || 'escuro' } catch {}
  aplicar(guardado)
}


// 25/10 («podes fazer uma aba lá em cima para eu verificar os meus lucros [...] com a estratégia a seguir neste momento, se
// tou a mover o SL para a zona de profit, e o que temos que fazer depois para arriscarmos mais»): o separador «Lucros», por
// cima do ecrã. A banca de 500 € a seguir os avisos do bot que te chegaram, com as tuas regras e a fase lucro (lucros.mjs).
// O botão da barra diz o lucro de hoje; desde 29/10 também na página do amigo
{
  const caixa = $('lucros'), btn = $('lucrosBtn'), corpo = $('lucrosCorpo'), c = casasTexto('XAUUSD')
  let r = null, aberto = false
  const eur = v => (v >= 0.5 ? '+' : v <= -0.5 ? '-' : '') + fmt(Math.abs(v), 0) + NB + '€', cl = v => v >= 0.5 ? ' sobe' : v <= -0.5 ? ' desce' : ''
  const quando = t => new Date(t * 1000).toLocaleString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ')
  const hora = t => new Date(t * 1000).toLocaleTimeString('pt-PT', { timeZone: LX, hour: '2-digit', minute: '2-digit' })
  const diaNome = d => new Date(d + 'T12:00:00Z').toLocaleDateString('pt-PT', { timeZone: LX, weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
  const NOME = NOME_AVISO
  const nomeAviso = e => (NOME[e.tipo] || e.tipo) + (e.tipo === 'teto' || e.tipo === 'pico' ? '' : ', ' + e.lado)
  const tp = (e, n) => e.entrada + (e.lado === 'venda' ? -1 : 1) * n * Math.abs(e.entrada - e.sl)
  // 31/10: 'banca', a banca já não pagava o stop do lote mais pequeno (lucros.mjs)
  const PORQUE = { outra: 'chegou com outra aberta', perda: 'o dia já tinha parado nos -200 €', metade: 'o dia já tinha parado (metade do melhor)', banca: 'a banca já não chegava para o lote mais pequeno' }
  // o que fazer agora na entrada aberta: a regra de hoje (31/10: o TP no TP2 e o stop não se mexe) ou, na fase lucro, deixar
  // correr (o stop sobe de TP em TP a partir do TP2)
  const agora = e => e.corre && e.k >= 2 ? 'Chegou ao TP' + e.k + ': passa o stop para o TP' + (e.k - 1) + ' (' + fmt(tp(e, e.k - 1), c) + ') e deixa correr.'
    : (e.k ? 'Chegou ao TP1' : 'Ainda não chegou ao TP1') + ': o stop fica em ' + fmt(e.sl, c) + (e.corre ? '. No TP2 passa para o TP1 (' + fmt(tp(e, 1), c) + ').' : ' e o TP fica no TP2 (' + fmt(tp(e, 2), c) + ').')
  function desenhar() {
    if (!r) return
    const h = r.hoje, g = r.regras, dias = r.dias.slice(-7), maior = Math.max(1, ...dias.map(d => Math.abs(d.eur)))
    const feitos = r.dias.filter(d => Math.abs(d.eur) >= 0.5), melhor = feitos.length ? feitos.reduce((a, d) => d.eur > a.eur ? d : a) : null
    const pior = feitos.length ? feitos.reduce((a, d) => d.eur < a.eur ? d : a) : null
    const linha = (n, v) => '<div class="lc-lin"><span>' + n + '</span><b class="num">' + v + '</b></div>'
    const hoje = '<div class="lc-card"><div class="tit"><span>Hoje</span><span>' + esc(diaNome(h.dia)) + '</span></div>'
      + '<div class="lc-grande num' + cl(h.eur) + '">' + eur(h.eur) + '</div><div class="lc-fase' + (h.parou ? ' parou' : h.fase ? ' lucro' : '') + '">'
      + (h.parou ? 'O dia parou' : h.fase ? 'Fase lucro' : 'Fase normal') + '</div>'
      + (h.fase || h.parou ? '' : '<div class="lc-barra" aria-hidden="true"><i style="width:' + Math.max(0, Math.min(100, 100 * h.eur / g.limiar)).toFixed(1) + '%"></i></div>')
      + (h.parou ? '' : linha('A próxima entrada arrisca', fmt(h.proximoRisco, 0) + NB + '€')) + (h.fase || h.parou ? '' : linha('Falta para a fase lucro', fmt(h.faltam, 0) + NB + '€'))
      + linha(h.pico >= g.limiar ? 'O dia pára se descer a' : 'O dia pára aos', eur(h.chao)) + linha('Entradas hoje', h.entradas) + '</div>'
    const abertas = r.abertas.length ? r.abertas.map(e => '<div class="lc-ordem"><div class="lc-o-tit"><b class="' + (e.lado === 'venda' ? 'desce' : 'sobe') + '">' + esc(nomeAviso(e)) + '</b><span>'
        + hora(e.t) + (e.corre ? ' · a deixar correr' : '') + '</span></div>'
      + '<div class="lc-o-niv num">entrada ' + fmt(e.entrada, c) + ' · stop ' + fmt(e.sl, c) + ' · ' + fmt(e.lote, 2) + ' lotes, arrisca ' + fmt(e.risco, 0) + NB + '€</div>'
      + '<div class="lc-o-tps num">' + Array.from({ length: e.corre ? Math.max(3, e.k + 1) : 2 }, (_, i) => i + 1).map(n => '<span class="' + (e.k >= n ? 'ok' : '') + '">TP' + n + ' ' + fmt(tp(e, n), c) + (e.k >= n ? ' ✓' : '') + '</span>').join('') + '</div>'
      + '<div class="lc-o-agora">' + esc(agora(e)) + '</div></div>').join('')
      : '<p class="lc-vazio">Nenhuma entrada aberta.' + (h.parou ? ' Hoje já não entra mais nenhuma.' : ' A próxima:') + '</p>' + (h.parou ? '' : '<div class="lc-passos"><span>Arrisca</span><span>'
        + (h.fase ? 'até ' : '') + fmt(h.proximoRisco, 0) + NB + '€ (o lote ajusta-se ao stop' + (h.fase ? ', no máximo ' + fmt(g.maxLote, 2) : '') + ')</span><span>No TP1</span><span>o stop fica onde está</span><span>No TP2</span>'
        + (h.fase ? '<span>o stop passa para o TP1</span><span>Depois</span><span>o stop sobe de TP em TP, sem TP no fim</span>' : '<span>fecha tudo</span>') + '</div>')
    const osDias = '<div class="lc-card"><div class="tit"><span>Os dias</span><span>o que fechou em cada um</span></div>'
      + (dias.length ? dias.map(d => '<div class="lc-dia"><span>' + esc(diaNome(d.dia)) + '</span><i aria-hidden="true"><b style="width:' + (100 * Math.abs(d.eur) / maior).toFixed(1) + '%"></b></i><b class="num' + cl(d.eur) + '">' + eur(d.eur) + '</b></div>').join('')
        + '<div class="lc-rodape">' + (melhor ? 'Melhor: ' + esc(diaNome(melhor.dia)) + ', <b class="num' + cl(melhor.eur) + '">' + eur(melhor.eur) + '</b>' : '')
        + (pior && pior !== melhor ? ' · pior: ' + esc(diaNome(pior.dia)) + ', <b class="num' + cl(pior.eur) + '">' + eur(pior.eur) + '</b>' : '') + '</div>'
        : '<p class="lc-vazio">Ainda sem dias fechados.</p>') + '</div>'
    const seguir = h.parou ? 'Hoje já parou' + (h.parou === 'perda' ? ' (chegou aos ' + eur(g.parar) + ')' : ' (desceu a metade do melhor do dia)') + '. Amanhã recomeça na fase normal, com ' + fmt(g.risco, 0) + ' € de risco por entrada.'
      : h.fase ? 'Estás na fase lucro. A próxima entrada pode arriscar até ' + fmt(h.proximoRisco, 0) + ' € (metade do lucro do dia; o lote não passa de ' + fmt(g.maxLote, 2) + ') e deixa correr: o stop sobe de TP em TP e não há TP no fim. Se o dia descer a ' + fmt(h.chao, 0) + ' €, pára.'
      : 'Faltam ' + fmt(h.faltam, 0) + ' € para a fase lucro. Quando o dia fechar ' + eur(g.limiar) + ', a entrada seguinte pode arriscar até metade do lucro do dia e deixar correr; o dia pára se descer a metade do melhor, para nunca acabar abaixo disso.'
    // 31/10 («esta cena tá diz resultados que não fazem sentido», com quatro dias seguidos a -200 €): com 200 € de risco, um stop
    // no começo do dia já o pára. Quantos avisos ficaram de fora por isso, e quantos iam ao TP2, explica a distância para o 0,32 fixo
    const fora = r.entradas.filter(e => e.porque === 'perda'), nDias = new Set(fora.map(e => diaLxDe(e.t * 1000))).size
    const nTp2 = fora.filter(e => e.daria === 'tp2').length, nStop = fora.filter(e => e.daria === 'stop').length, nSem = fora.length - nTp2 - nStop
    const porIsso = fora.length ? ' Com ' + fmt(g.risco, 0) + ' € de risco, basta um stop no começo do dia para lá chegar: '
      + (fora.length === 1 ? 'ficou de fora 1 aviso' : 'ficaram de fora ' + fora.length + ' avisos') + ' de ' + nDias + (nDias === 1 ? ' dia que já tinha parado' : ' dias que já tinham parado')
      + ' (' + nTp2 + (nTp2 === 1 ? ' ia' : ' iam') + ' ao TP2 e ' + nStop + ' ao stop' + (nSem ? ', ' + nSem + ' ainda sem fim' : '') + ').' : ''
    const aSeguir = '<div class="lc-card"><div class="tit"><span>A seguir</span></div><p class="lc-txt">' + esc(seguir) + '</p>'
      + '<p class="lc-nota">Num teste de 25/10 (58 dias, 336 avisos refeitos vela a vela), a fase lucro deu +2 346 € e a regra desse dia, ainda com o TP3, -195 €. Mas a fase lucro só aconteceu 8 vezes: ainda não está provada.</p></div>'
    const L = [...r.entradas].reverse().slice(0, 12)
    const tabela = '<div class="lc-card lc-largo"><div class="tit"><span>As entradas</span><span>' + r.entradas.filter(e => e.tomada).length + ' de ' + r.entradas.length + ' avisos' + (r.entradas.length > L.length ? ', as últimas ' + L.length : '') + '</span></div>'
      + (L.length ? '<table class="lc-tab"><thead><tr><th>Quando</th><th>Aviso</th><th class="d">Lote</th><th class="d">Risco</th><th>Fase</th><th class="d">Resultado</th></tr></thead><tbody>'
        + L.map(e => '<tr' + (e.tomada ? '' : ' class="saltou"') + '><td class="num">' + quando(e.t) + '</td><td>' + esc(nomeAviso(e)) + '</td>'
          + (e.tomada ? '<td class="num d">' + fmt(e.lote, 2) + '</td><td class="num d">' + fmt(e.risco, 0) + NB + '€</td><td>' + (e.fase ? 'lucro' : 'normal') + '</td><td class="num d' + (e.fim ? cl(e.fim.eur) : '') + '">' + (e.fim ? eur(e.fim.eur) : 'aberta') + '</td>'
            : '<td colspan="4">não entrou: ' + PORQUE[e.porque] + '</td>') + '</tr>').join('') + '</tbody></table>' : '<p class="lc-vazio">Ainda sem avisos.</p>') + '</div>'
    corpo.innerHTML = '<div class="lc-topo"><div><div class="lc-rot">Banca</div><div class="lc-banca num">' + fmt(g.inicio, 0) + NB + '€ → <b class="' + cl(r.banca.agora - g.inicio).trim() + '">' + fmt(r.banca.agora, 0) + NB + '€</b></div>'
      + '<div class="lc-sub">Desde ' + quando(r.desde) + ', com as tuas regras: uma entrada de cada vez, ' + fmt(g.risco, 0) + ' € de risco em cada, tudo no TP2 sem mexer no stop, o dia pára aos ' + eur(g.parar) + '.' + porIsso + '</div></div>'
      + '<div class="lc-fixo"><span>Com ' + fmt(r.fixo.lote, 2) + ' fixo em todos os avisos do bot (a barra de cima)</span><b class="num' + cl(r.fixo.agora - g.inicio) + '">' + fmt(r.fixo.agora, 0) + NB + '€</b></div></div>'
      + '<div class="lc-grelha">' + hoje + '<div class="lc-card"><div class="tit"><span>Ordem aberta</span><span>o que fazer agora</span></div>' + abertas + '</div>' + osDias + aSeguir + tabela + '</div>'
  }
  async function carregar() {
    try { r = await api('lucros') } catch { return }
    btn.hidden = false
    btn.innerHTML = 'Lucros <b class="num' + cl(r.hoje.eur) + '">' + eur(r.hoje.eur) + ' hoje</b>'
    if (aberto) desenhar()
  }
  const fundo = on => { for (const el of document.body.children) if (el !== caixa && el.tagName !== 'SCRIPT') el.inert = on }
  function abrir() { aberto = true; desenhar(); caixa.hidden = false; fundo(true); $('lucrosFechar').focus(); carregar() }
  function fechar() { aberto = false; caixa.hidden = true; fundo(false); btn.focus() }
  btn.addEventListener('click', abrir)
  caixa.addEventListener('click', e => { if (e.target.closest('[data-fecha]')) fechar() })
  addEventListener('keydown', e => { if (e.key === 'Escape' && aberto) fechar() })
  // 29/10 («mete mesmo igual»): também na página do amigo (antes não tinha /api/lucros); lá só com o separador à vista
  carregar(); setInterval(seVisivel(carregar), 60e3)
}
// 29/10 («aqui, se clicar em ver mais, mostra tipo pop-up»): todos os que fecharam nas últimas 24 h, por cima do ecrã
{
  const caixa = $('fechados'), corpo = $('fechadosCorpo')
  let de = null
  const fundo = on => { for (const el of document.body.children) if (el !== caixa && el.tagName !== 'SCRIPT') el.inert = on }
  function abrir(btn) {
    corpo.innerHTML = '<div class="fe-lista">' + avisosFechados().map(p => linhaFechado(p, casasTexto('XAUUSD'))).join('') + '</div>'
    valoresFechados(corpo)
    de = btn; caixa.hidden = false; fundo(true); $('fechadosFechar').focus()
  }
  function fechar() { caixa.hidden = true; fundo(false); (de?.isConnected ? de : $('plano').querySelector('.fe-mais'))?.focus() }
  $('plano').addEventListener('click', e => { const b = e.target.closest('.fe-mais'); if (b) abrir(b) })
  caixa.addEventListener('click', e => { if (e.target.closest('[data-fecha]')) fechar() })
  addEventListener('keydown', e => { if (e.key === 'Escape' && !caixa.hidden) fechar() })
}
