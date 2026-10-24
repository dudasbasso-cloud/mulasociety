// O gráfico do Jarvis (Lightweight Charts 5): as velas, as linhas do SV3, as EMA 200 e 80, os tetos e suportes com nome, a
// caixa da Ásia, o Fibonacci de 4 h, as velas de confirmação e os sinais com o resultado (com uma dica ao passar o rato), as
// posições com o stop e, num painel por baixo, o estocástico 5,3,3. Horas de Lisboa; as velas do dia com a data do dia
// de forex (começam às 17:00 de Nova Iorque, na véspera).
const L = window.LightweightCharts
const LX = 'Europe/Lisbon', NB = ' '
const TFS = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }
const fmt = (v, c) => { const s = Math.abs(v).toFixed(c).split('.'); return (v < 0 ? '-' : '') + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB) + (s[1] ? ',' + s[1] : '') }
const hora = t => new Date(t * 1000).toLocaleTimeString('pt-PT', { timeZone: LX, hour: '2-digit', minute: '2-digit' })
const data = t => new Date(t * 1000).toLocaleDateString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit' })
const NOMES = { teto: 'venda no teto', sv3: 'SV3', pico: 'venda depois do pico', incrivel: 'INCRÍVEL' }
const VELA = { martelo: ['Martelo', 'o', 'martelo'], 'estrela cadente': ['Estrela cadente', 'a', 'estrela'], envolvente: ['Envolvente', 'a', 'envolv.'], doji: ['Doji', 'o', 'doji'] }
const FIBO = { 0.382: '38,2', 0.5: '50', 0.618: '61,8' }
const em = onde => /^[ao] /.test(onde) ? 'n' + onde : 'no ' + onde
const dicaVela = v => { const [n, g] = VELA[v.tipo] || [v.tipo, 'o']; return '<b>' + n + ' (' + v.lado + ')</b><br>' + (v.confirmada ? 'confirmad' + g : 'à espera da vela seguinte') + ', ' + em(v.onde) }

// 23/10 (revisão de design, «um pouco mais clean»): os nomes das caixas e das linhas já não se tapam uns aos outros (o
// «stop 3 980,1» ficava em cima do «mínimo de hoje»). Cada nome guarda o seu retângulo; o seguinte, se calhar em cima de
// um, vai para o sítio livre mais perto, acima ou abaixo. A lista esvazia-se no fim de cada desenho do gráfico.
let ocupados = null
function lugarLivre(x, y, w, h) {
  if (!ocupados) { ocupados = []; queueMicrotask(() => { ocupados = null }) }
  const bate = yy => ocupados.some(o => x < o.x + o.w && o.x < x + w && yy < o.y + o.h && o.y < yy + h)
  let livre = y
  for (let n = 1; n <= 8 && bate(livre); n++) livre = y + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * (h + 2)
  if (bate(livre)) livre = y
  ocupados.push({ x, y: livre, w, h })
  return livre
}

// uma caixa de preço (com ou sem horas): o fundo por baixo das velas e o nome por cima delas
class Caixa {
  constructor(o) {
    this.o = o
    this.vistas = [{ zOrder: () => 'bottom', renderer: () => ({ draw: t => this.desenha(t, false) }) }, { zOrder: () => 'top', renderer: () => ({ draw: t => this.desenha(t, true) }) }]
  }
  attached(p) { this.chart = p.chart; this.serie = p.series }
  detached() {}
  updateAllViews() {}
  paneViews() { return this.vistas }
  desenha(t, texto) {
    const o = this.o
    t.useBitmapCoordinateSpace(sc => {
      const c = sc.context, r = sc.horizontalPixelRatio, k = sc.verticalPixelRatio, ts = this.chart.timeScale(), W = sc.mediaSize.width
      let x1 = o.de != null ? ts.timeToCoordinate(o.de) : 0, x2 = o.ate != null ? ts.timeToCoordinate(o.ate) : W
      if (x1 == null) x1 = 0
      if (x2 == null) x2 = W
      // as caixas dos sinais vão da beira esquerda da primeira vela à beira direita da última
      if (o.velas) { const m = ts.options().barSpacing / 2; x1 -= m; if (o.ate != null) x2 += m }
      let y1 = this.serie.priceToCoordinate(o.hi), y2 = this.serie.priceToCoordinate(o.lo)
      if (y1 == null || y2 == null) return
      if (Math.abs(y2 - y1) < 6) { const m = (y1 + y2) / 2; y1 = m - 3; y2 = m + 3 }
      if (!texto) {
        c.fillStyle = o.fundo; c.fillRect(x1 * r, y1 * k, (x2 - x1) * r, (y2 - y1) * k)
        if (o.borda) { c.strokeStyle = o.borda; c.lineWidth = r; c.setLineDash(o.tracejado ? [5 * r, 4 * r] : []); c.strokeRect(x1 * r, y1 * k, (x2 - x1) * r, (y2 - y1) * k); c.setLineDash([]) }
        return
      }
      if (!o.texto) return
      c.font = (11 * r) + 'px -apple-system, sans-serif'
      const w = c.measureText(o.texto).width, x = o.esq ? x1 + 6 : x2 - 8 - w / r, y = lugarLivre(x - 4, y1 - 16, w / r + 8, 15) + 11
      c.fillStyle = 'rgba(15,17,19,0.82)'; c.fillRect((x - 4) * r, (y - 11) * k, w + 8 * r, 15 * k)
      c.fillStyle = o.cor; c.fillText(o.texto, x * r, y * k)
    })
  }
}

// linhas de preço entre duas horas, tracejadas, com o nome na ponta direita (os TP, a entrada e o stop dos sinais, 22/10:
// «como é que eu sei onde é o TP1?»). Os nomes afastam-se uns dos outros quando as linhas estão muito juntas.
class Linhas {
  constructor(o) { this.o = o; this.vistas = [{ zOrder: () => 'top', renderer: () => ({ draw: t => this.desenha(t) }) }] }
  attached(p) { this.chart = p.chart; this.serie = p.series }
  detached() {}
  updateAllViews() {}
  paneViews() { return this.vistas }
  desenha(t) {
    const o = this.o
    t.useBitmapCoordinateSpace(sc => {
      const c = sc.context, r = sc.horizontalPixelRatio, k = sc.verticalPixelRatio, ts = this.chart.timeScale(), W = sc.mediaSize.width, m = ts.options().barSpacing / 2
      let x1 = ts.timeToCoordinate(o.de), x2 = o.ate != null ? ts.timeToCoordinate(o.ate) : W
      x1 = x1 == null ? 0 : x1 - m
      x2 = x2 == null ? W : o.ate != null ? x2 + m : x2
      if (x2 <= x1) return
      const itens = o.itens.map(it => ({ ...it, y: this.serie.priceToCoordinate(it.preco) })).filter(it => it.y != null)
      c.save()
      c.lineWidth = r; c.setLineDash([4 * r, 3 * r])
      for (const it of itens) { c.strokeStyle = it.cor; c.beginPath(); c.moveTo(x1 * r, Math.round(it.y * k) + 0.5); c.lineTo(x2 * r, Math.round(it.y * k) + 0.5); c.stroke() }
      // os nomes: por ordem de altura, pelo menos 15 px entre eles, e o grupo centrado nas linhas
      const rot = itens.filter(it => it.texto).sort((a, b) => a.y - b.y), GAP = 15
      rot.forEach((it, n) => { it.yr = n && it.y - rot[n - 1].yr < GAP ? rot[n - 1].yr + GAP : it.y })
      const desvio = rot.length ? rot.reduce((s, it) => s + it.y - it.yr, 0) / rot.length : 0
      c.setLineDash([]); c.font = (11 * r) + 'px -apple-system, sans-serif'; c.textBaseline = 'middle'
      for (const it of rot) {
        const w = c.measureText(it.texto).width, x = x2 - w / r - 6, y = lugarLivre(x - 4, it.yr + desvio - 7.5, w / r + 8, 15) + 7.5
        c.fillStyle = 'rgba(15,17,19,0.88)'; c.fillRect((x - 4) * r, (y - 7.5) * k, w + 8 * r, 15 * k)
        c.fillStyle = it.cor; c.fillText(it.texto, x * r, y * k)
      }
      c.restore()
    })
  }
}

function marca(s, casas) {
  const r = s.resultado, aberta = !r || r.estado === 'aberta'
  const bom = r?.eur != null ? r.eur >= 0 : r?.r != null ? r.r >= 0 : null
  const cor = aberta || bom == null ? '#d6c39f' : bom ? '#9cb894' : '#cc9390'
  // sem texto ao lado (era confusão a mais): o resultado vê-se ao passar o rato
  return { time: s.time, position: s.lado === 'venda' ? 'aboveBar' : 'belowBar', shape: s.lado === 'venda' ? 'arrowDown' : 'arrowUp', color: cor, size: 0.7 }
}

function dicaDe(s, casas) {
  const r = s.resultado, c = casas === 2 ? 1 : casas
  const res = !r ? 'sem velas depois' : r.estado === 'aberta' ? 'ainda aberta' + (r.eur != null ? ' (' + (r.eur >= 0 ? '+' : '-') + fmt(Math.abs(r.eur), 2) + ' €)' : '')
    : r.eur != null ? (r.estado === 'stop' ? 'fechou no stop: ' : 'fechou: ') + (r.eur >= 0 ? '+' : '-') + fmt(Math.abs(r.eur), 2) + ' € com o plano do robô'
    : r.estado === 'tp1' ? 'chegou ao TP1 (+' + fmt(r.r, 1) + ' R)' : 'bateu no stop (-1 R)'
  return '<b>' + (NOMES[s.tipo] || s.tipo) + ', ' + s.lado + '</b> às ' + hora(s.time) + ' de ' + data(s.time) + '<br>entrada ' + fmt(s.entrada, c) + ' · stop ' + fmt(s.sl, c) + (s.tp ? ' · TP ' + fmt(s.tp, c) : '') + '<br>' + res
}

export function criarGrafico(el) {
  let casas = 2, chave = '', caixas = [], linhasPos = [], linhasFibo = [], porTempo = new Map(), velaPorTempo = new Map(), tfAtual = '15m', estK = null, estD = null
  const rot = t => tfAtual === '1d' ? t + 43200 : t   // a vela do dia começa às 17:00 de NY da véspera: mostra-se a data do dia
  // 24/10 («no mobile está difícil mexer no gráfico e dar scroll na página»): com o dedo, arrastar para o lado mexe no
  // gráfico e arrastar para cima ou para baixo corre a página; o zoom é com dois dedos
  const toque = matchMedia('(pointer: coarse)').matches
  const chart = L.createChart(el, {
    autoSize: true,
    ...(toque ? { handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }, handleScale: { pinch: true, mouseWheel: false, axisPressedMouseMove: { time: true, price: false } },
      kineticScroll: { touch: true } } : {}),
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8f959c', fontSize: 11, attributionLogo: false,
      panes: { separatorColor: '#23272c', separatorHoverColor: 'rgba(255,255,255,0.04)', enableResize: false } },
    grid: { vertLines: { color: 'rgba(255,255,255,0.035)' }, horzLines: { color: 'rgba(255,255,255,0.035)' } },
    rightPriceScale: { borderColor: '#23272c', scaleMargins: { top: 0.08, bottom: 0.06 }, tickMarkDensity: 1.2 },   // mais preços na escala (24/10)
    timeScale: { borderColor: '#23272c', timeVisible: true, secondsVisible: false, rightOffset: 8, lockVisibleTimeRangeOnResize: true, tickMarkFormatter: (t, tipo) => tipo <= 2 ? data(rot(t)) : hora(t) },
    localization: { locale: 'pt-PT', timeFormatter: t => tfAtual === '1d' ? data(rot(t)) : data(t) + ' ' + hora(t) },
    crosshair: { vertLine: { color: '#3a4047', labelBackgroundColor: '#2a2f35' }, horzLine: { color: '#3a4047', labelBackgroundColor: '#2a2f35' } }
  })
  const velas = chart.addSeries(L.CandlestickSeries, { upColor: '#9cb894', downColor: '#cc9390', borderUpColor: '#9cb894', borderDownColor: '#cc9390',
    wickUpColor: 'rgba(156,184,148,.7)', wickDownColor: 'rgba(204,147,144,.7)', priceLineColor: '#6f757c' })
  const linha = (cor, w, estilo = 0) => chart.addSeries(L.LineSeries, { color: cor, lineWidth: w, lineStyle: estilo, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
  const verm = linha('rgba(204,147,144,.9)', 2), cinza = linha('rgba(139,144,150,.8)', 1, 2), verde = linha('rgba(156,184,148,.9)', 2), ema = linha('rgba(214,195,159,.7)', 1)
  const ema80 = linha('rgba(214,195,159,.5)', 1, 2)
  // as linhas de tendência (4 h grossa, 1 h fina), com o preço onde passam agora no eixo; tracejadas quando partiram
  const linhasLT = new Map()
  const serieLT = k => {
    if (!linhasLT.has(k)) {
      const [tf, lado] = k.split('|')
      linhasLT.set(k, chart.addSeries(L.LineSeries, { color: lado === 'subida' ? 'rgba(156,184,148,.85)' : 'rgba(204,147,144,.85)', lineWidth: tf === '4h' ? 2 : 1, priceLineVisible: false,
        crosshairMarkerVisible: false, title: 'LT ' + (tf === '4h' ? '4 h' : '1 h'), priceFormat: { type: 'custom', minMove: 1e-5, formatter: p => fmt(p, casas) } }, 0))
    }
    return linhasLT.get(k)
  }
  const marcadores = L.createSeriesMarkers(velas, []), marcasVelas = L.createSeriesMarkers(velas, []), marcasAlvos = L.createSeriesMarkers(velas, []), marcasEstr = L.createSeriesMarkers(velas, [])
  // o quadro dos alvos (como o do ULTRA_V1.2 da imagem dele): quantos sinais chegaram a cada TP e quantos ao stop, e o
  // acerto. À direita tapava as velas de agora: fica à esquerda, no canto (de cima ou de baixo) com menos velas
  const quadro = document.createElement('div')
  quadro.className = 'alvos'
  el.appendChild(quadro)
  const porQuadro = () => {
    if (quadro.style.display !== 'block') return
    const H = chart.panes()[0].getHeight(), lr = chart.timeScale().getVisibleLogicalRange(), dados = velas.data()
    let cima = 0, baixo = 0
    if (lr) for (let i = Math.max(0, Math.ceil(lr.from)), f = Math.min(dados.length - 1, Math.floor(lr.from + (lr.to - lr.from) * 0.4)); i <= f; i++) {
      const yh = velas.priceToCoordinate(dados[i].high), yl = velas.priceToCoordinate(dados[i].low)
      if (yh != null && yh < H / 2) cima++
      if (yl != null && yl > H / 2) baixo++
    }
    // 24/10 («deixa isto sempre aqui neste sítio, abaixo à esquerda»): fica sempre no canto de baixo à esquerda
    quadro.style.left = '10px'
    quadro.style.top = Math.max(8, H - quadro.offsetHeight - 10) + 'px'
  }
  chart.timeScale().subscribeVisibleLogicalRangeChange(() => requestAnimationFrame(porQuadro))
  // 23/10 («mete a opção aqui no card de ver o de ontem e hoje»; «preenche o SL com 1 e vermelho»): Tudo (desde o primeiro
  // aviso, é o que abre), Hoje e Ontem no título; a escolha fica até ele mudar
  let vistaAlvos = 'tudo', ultimosAlvos = null
  quadro.addEventListener('click', e => { const b = e.target.closest('[data-vista]'); if (!b || !ultimosAlvos) return; vistaAlvos = b.dataset.vista; quadroAlvos(...ultimosAlvos) })
  function quadroAlvos(a, ouro) {
    const c = a?.conta
    ultimosAlvos = [a, ouro]
    if (!c || !(c.fechados + c.abertos)) { quadro.style.display = 'none'; return }
    // 22/10 («não bateu nenhum stop, porque mostra 9?», «podes tirar»): no Hoje e no Ontem a tabela é a do dia, e a conta
    // desde o início fica numa linha por baixo (os stops de lá foram a sério, não se escondem).
    // 23/10, 00:50 («ainda sem avisos hoje: aqui não faz sentido», «aqui 1» no stop de ontem): para ele o dia só acaba quando
    // se deita. O dia do quadro vai das 06:00 às 06:00 de Lisboa, e a data aparece escrita.
    const lx = t => new Date((t - 6 * 3600) * 1000).toLocaleDateString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit' })
    const tudo = vistaAlvos === 'tudo', dia = lx(Date.now() / 1000 - (vistaAlvos === 'ontem' ? 86400 : 0)), H = (a.lista || []).filter(p => lx(p.time) === dia)
    // 23/10 («mete as infos reais»): no ouro são só os avisos que foram para o Telegram, cada um por si (servidor/arranque.mjs)
    const total = c.fechados + c.abertos, nome = x => x === 1 ? (ouro ? ' aviso' : ' sinal') : (ouro ? ' avisos' : ' sinais')
    const tps = tudo ? [c.tp1, c.tp2, c.tp3] : [0, 1, 2].map(k => H.filter(p => p.hits[k]).length), n = k => tps[k]
    // 24/10 («faz essa estratégia»): com a regra o stop só passa para o TP1 no TP2, por isso um stop depois do TP1 também é
    // stop. As barras dividem pelos decididos (fechados ou já no TP1); o acerto é o dos que acabaram a ganhar sobre os fechados
    const st = tudo ? c.stop : H.filter(p => p.fim?.estado === 'stop').length, quantos = tudo ? total : H.length
    const dec = tudo ? c.decididos ?? n(0) + st : H.filter(p => p.fim || p.hits[0]).length, pc = x => dec ? Math.round(100 * x / dec) : 0
    const fech = tudo ? c.fechados : H.filter(p => p.fim).length, acerto = fech ? Math.round(100 * (fech - st) / fech) : null
    const linha = (nome, x, cor) => '<div class="l' + (nome === 'Stop' && x ? ' st' : '') + '"><b>' + nome + '</b><span class="q">' + x + '</span><i class="barra"><span style="width:' + pc(x) + '%;background:' + cor + '"></span></i><span class="q">' + pc(x) + '%</span></div>'
    // 23/10 («devia ter aqui 1 stop», «mete lá a vermelho no card»): os stops desde o início a vermelho, com a hora do último
    const ultStop = (a.lista || []).filter(p => p.fim?.estado === 'stop').at(-1)
    const hora = t => new Date(t * 1000).toLocaleString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ')
    const stops = x => !x ? '0 stops' : '<b class="st">' + x + (x === 1 ? ' stop' : ' stops') + (ultStop ? (x === 1 ? ' a ' : ', o último a ') + hora(ultStop.fim.exato ?? ultStop.fim.t) : '') + '</b>'
    quadro.innerHTML = '<div class="t">' + (ouro ? 'Avisos do bot' : 'Sinais do SV3')
      + '<div class="seg">' + [['tudo', 'Tudo'], ['hoje', 'Hoje'], ['ontem', 'Ontem']].map(([v, x]) => '<button type="button" data-vista="' + v + '" aria-pressed="' + (v === vistaAlvos) + '"' + (v === vistaAlvos ? ' class="on"' : '') + '>' + x + '</button>').join('') + '</div></div>'
      + (quantos ? linha('TP1', n(0), '#9cb894') + linha('TP2', n(1), '#9cb894') + linha('TP3', n(2), '#9cb894') + linha('Stop', st, '#cc9390')
        + '<div class="a"><span>' + quantos + nome(quantos) + ' · ' + (tudo ? 'desde ' + data(c.desde) : dia) + '</span>' + (acerto != null ? '<span>Acerto <b>' + acerto + '%</b></span>' : '') + '</div>'
        : '<div class="r">' + (vistaAlvos === 'ontem' ? 'Sem' + nome(2) + ' ontem (' + dia + ').' : 'Ainda sem' + nome(2) + ' hoje (' + dia + ').') + '</div>')
      + (tudo ? (c.stop ? '<div class="r">' + stops(c.stop) + '</div>' : '')
        : '<div class="r">Desde ' + data(c.desde) + ': ' + total + nome(total) + ', ' + stops(c.stop) + (c.acerto != null ? ', acerto ' + Math.round(100 * c.acerto) + '%' : '') + '</div>')
      + '<div class="nota">' + (ouro ? 'Só os avisos do Telegram. TP no TP3; no TP2 o stop passa para o TP1.' : 'TP no TP3; no TP2 o stop passa para o TP1. Um sinal de cada vez.') + '</div>'
    quadro.style.display = 'block'
  }
  // o estocástico 5,3,3 num painel por baixo (só existe com a camada ligada), com o 80 e o 20 e o nome no canto
  const tituloEst = document.createElement('div')
  tituloEst.className = 'paneTit'; tituloEst.textContent = 'Estocástico 5,3,3'; tituloEst.style.display = 'none'
  el.appendChild(tituloEst)
  const porTitulo = () => { if (estK && chart.panes().length > 1) { tituloEst.style.top = (chart.panes()[0].getHeight() + 4) + 'px'; tituloEst.style.display = 'block' } else tituloEst.style.display = 'none' }
  function estocastico(on, d) {
    if (!on) {
      if (estK) { chart.removeSeries(estK); chart.removeSeries(estD); estK = estD = null }
      if (chart.panes().length > 1 && !chart.panes()[1].getSeries().length) chart.removePane(1)
      porTitulo()
      return
    }
    if (!estK) {
      const op = { lineWidth: 1, priceLineVisible: false, crosshairMarkerVisible: false, priceFormat: { type: 'custom', minMove: 1, formatter: p => String(Math.round(p)) }, autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) }
      estK = chart.addSeries(L.LineSeries, { ...op, color: '#d6c39f', lastValueVisible: true }, 1)
      estD = chart.addSeries(L.LineSeries, { ...op, color: 'rgba(139,144,150,.8)', lineStyle: 2, lastValueVisible: false }, 1)
      for (const [p, cor] of [[80, 'rgba(204,147,144,.5)'], [20, 'rgba(156,184,148,.5)']]) estK.createPriceLine({ price: p, color: cor, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' })
      chart.panes()[0].setStretchFactor(4.5); chart.panes()[1].setStretchFactor(1)
    }
    estK.setData(d.estoc.k); estD.setData(d.estoc.d)
    requestAnimationFrame(porTitulo)
  }
  const dica = el.querySelector('#dica')
  // as últimas velas enchem o gráfico, também quando a janela muda de tamanho ou volta a aparecer, até ele mexer no
  // gráfico (rodinha ou arrastar); duplo clique volta ao início
  let n = 0, nVer = 130, mexeu = false
  const ajustar = () => { if (n) chart.timeScale().setVisibleLogicalRange({ from: n - nVer, to: n + 6 }) }
  el.addEventListener('wheel', () => { mexeu = true }, { passive: true })
  el.addEventListener('pointerdown', () => { mexeu = true })
  el.addEventListener('dblclick', () => { mexeu = false; ajustar(); chart.priceScale('right').applyOptions({ autoScale: true }) })
  new ResizeObserver(() => { if (!mexeu) ajustar(); requestAnimationFrame(() => { porTitulo(); porQuadro() }) }).observe(el)
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !mexeu) ajustar() })
  chart.subscribeCrosshairMove(p => {
    const s = p?.time != null ? porTempo.get(p.time) || [] : [], v = p?.time != null ? velaPorTempo.get(p.time) || [] : []
    if ((!s.length && !v.length) || !p.point) { dica.style.display = 'none'; return }
    dica.innerHTML = [...s.map(x => dicaDe(x, casas)), ...v.map(dicaVela)].join('<hr style="border:0;border-top:1px solid #2a2f35;margin:6px 0">')
    dica.style.display = 'block'
    dica.style.left = Math.min(p.point.x + 14, el.clientWidth - 270) + 'px'
    dica.style.top = Math.max(8, p.point.y - 70) + 'px'
  })

  function mostrar(d, camadas) {
    const nova = d.simbolo + '|' + d.tf !== chave
    chave = d.simbolo + '|' + d.tf; casas = d.casas; tfAtual = d.tf
    velas.applyOptions({ priceFormat: { type: 'custom', minMove: 1 / 10 ** casas, formatter: p => fmt(p, casas) } })   // cada painel com o seu formato
    velas.setData(d.velas)
    const ou = (on, dados) => on ? dados : []
    verm.setData(ou(camadas.sv3, d.sv3.verm)); cinza.setData(ou(camadas.sv3, d.sv3.cinza)); verde.setData(ou(camadas.sv3, d.sv3.verde))
    ema.setData(ou(camadas.ema, d.ema200)); ema80.setData(ou(camadas.ema, d.ema80 || []))
    estocastico(!!camadas.estoc && !!d.estoc, d)
    for (const c of caixas) velas.detachPrimitive(c)
    caixas = []
    const junta = o => { const c = new Caixa(o); velas.attachPrimitive(c); caixas.push(c) }
    const alinhar = t => t - t % TFS[d.tf]
    if (camadas.asia && d.asia && (d.tf === '15m' || d.tf === '1h'))
      junta({ de: alinhar(d.asia.de), ate: alinhar(d.asia.ate), hi: d.asia.hi, lo: d.asia.lo, fundo: 'rgba(214,195,159,0.05)', borda: 'rgba(214,195,159,0.55)', tracejado: true, texto: 'caixa da Ásia', cor: '#d6c39f', esq: true })
    // o mapa do diário: caixas a toda a largura, tracejadas, por baixo dos níveis do dia
    if (camadas.diario) for (const z of d.diario || []) {
      const cor = z.lado === 'venda' ? '204,147,144' : z.lado === 'compra' ? '156,184,148' : '214,195,159'
      junta({ hi: z.hi, lo: z.lo, fundo: 'rgba(' + cor + ',0.06)', borda: 'rgba(' + cor + ',0.45)', tracejado: true, esq: true, cor: 'rgb(' + cor + ')',
        texto: 'diário · ' + ({ major: 'Major Key', swing: 'swing', intradia: 'intradía' }[z.tipo] || z.tipo) + ' · ' + z.toques + (z.toques === 1 ? ' toque' : ' toques') })
    }
    if (camadas.niveis) for (const z of d.zonas) {
      const meia = 0.6 * 10 ** -(casas === 2 ? 0 : casas - 1)
      junta({ hi: Math.max(z.hi, z.mid + meia), lo: Math.min(z.lo, z.mid - meia), fundo: z.tipo === 'teto' ? 'rgba(204,147,144,0.13)' : 'rgba(156,184,148,0.13)',
        texto: z.tipo + ' ' + fmt(z.mid, casas === 2 ? 1 : casas) + ' · ' + z.nome, cor: z.tipo === 'teto' ? '#cc9390' : '#9cb894' })
    }
    // as caixas dos alvos: verde da entrada ao TP3, vermelha da entrada ao stop, da vela do sinal até ao fim (TP3 ou stop;
    // aberta, até à direita); o TP1, o TP2, o TP3 e o stop marcados no preço, na vela em que lá chegou
    // 23/10 («tá tudo bugado», «uma em cima da outra? antes tava mais clean», «a box deveria estar bem colocada»): cada caixa
    // começa na vela do sinal, com a entrada nela, e nunca fica uma em cima da outra. Os avisos repetidos (o mesmo lado, até
    // 1 h depois do anterior) fazem uma caixa só, com «Venda ×3»; o quadro continua a contar cada aviso. Quando chega outro
    // aviso com a caixa ainda aberta, ela acaba na vela antes do novo, e o que fez depois fica escrito no nome («· TP3»).
    // Se o último aviso ainda está aberto e a caixa do grupo dele já fechou, ganha a sua caixa na vela dele.
    // com uma estratégia escolhida, só as caixas dela
    const alvos = camadas.alvos && !(camadas.estrVer || []).length ? d.alvos?.lista || [] : [], mAlvos = [], grupos = []
    for (const p of alvos) { const g = grupos.at(-1), u = g?.at(-1); if (u && u.lado === p.lado && p.time - u.time <= 3600) g.push(p); else grupos.push([p]) }
    const fim = alvos.at(-1), rep = grupos.at(-1)?.[0], solto = fim && !fim.fim && rep !== fim && rep.fim ? fim : null, ultimo = solto || rep
    const juntaL = o => { const c = new Linhas(o); velas.attachPrimitive(c); caixas.push(c) }, fp = x => fmt(x, casas)   // 24/10 («às vezes estou em 4445,00 e é 4445,10»): com as duas casas
    const precos = p => [{ preco: p.sl, cor: '#cc9390', texto: 'stop ' + fp(p.sl) }, { preco: p.entrada, cor: '#d6c39f', texto: 'entrada ' + fp(p.entrada) },
      ...p.tps.map((preco, k) => ({ preco, cor: '#9cb894', texto: 'TP' + (k + 1) + ' ' + fp(preco) + (p.hits[k] ? ' ✓' : '') }))]
    const caixa = (p, de, ate) => {
      junta({ de, ate, velas: true, hi: Math.max(p.entrada, p.tps[2]), lo: Math.min(p.entrada, p.tps[2]), fundo: 'rgba(156,184,148,0.10)', borda: 'rgba(156,184,148,0.30)' })
      junta({ de, ate, velas: true, hi: Math.max(p.entrada, p.sl), lo: Math.min(p.entrada, p.sl), fundo: 'rgba(204,147,144,0.12)', borda: 'rgba(204,147,144,0.30)' })
    }
    const nome = (p, extra = '') => { const v = p.lado === 'venda'; return { time: p.time, position: v ? 'aboveBar' : 'belowBar', shape: v ? 'arrowDown' : 'arrowUp', color: v ? '#cc9390' : '#9cb894', text: (v ? 'Venda' : 'Compra') + (p.tipo === 'teto' ? ' de teto' : '') + extra, size: 0.7 } }
    const pontos = (p, visto) => {
      p.hits.forEach((t, k) => { if (t != null && visto(t)) mAlvos.push({ time: t, position: 'atPriceMiddle', price: p.tps[k], shape: 'circle', color: '#9cb894', text: 'TP' + (k + 1), size: 0.5 }) })
      if (p.fim?.estado === 'stop' && visto(p.fim.t)) mAlvos.push({ time: p.fim.t, position: 'atPriceMiddle', price: p.sl, shape: 'circle', color: '#cc9390', text: 'stop', size: 0.5 })
      // 24/10: com a regra, o preço voltou ao TP1 depois do TP2 e o aviso fechou aí. O texto fica do lado de onde o preço
      // voltou (por cima numa venda): no meio ficava em cima da vela verde e não se lia
      if (p.fim?.estado === 'tp1' && visto(p.fim.t)) mAlvos.push({ time: p.fim.t, position: p.lado === 'venda' ? 'atPriceTop' : 'atPriceBottom', price: p.tps[0], shape: 'circle', color: '#9cb894', text: 'saiu no TP1', size: 0.5 })
    }
    // 24/10 («este TP3, tu metes esta box: isso quer dizer que a trade só vai até essa box?»): o nome do aviso diz o que ele
    // fez depois de a caixa fechar e a que horas (de Lisboa, com o dia quando já é outro)
    const diaLx = t => new Date(t * 1000).toLocaleDateString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit' })
    const quando = (t, de) => (diaLx(t) === diaLx(de) ? ' às ' : ' a ' + diaLx(t) + ' às ') + new Date(t * 1000).toLocaleTimeString('pt-PT', { timeZone: LX, hour: '2-digit', minute: '2-digit' })
    grupos.forEach((g, i) => {
      const p = g[0], prox = i + 1 < grupos.length ? grupos[i + 1][0].time : solto && g.includes(solto) ? solto.time : null
      const corte = prox != null && (!p.fim || p.fim.t >= prox) ? prox - TFS[d.tf] : null, ate = corte ?? (p.fim ? p.fim.t : null)
      const visto = t => corte == null || t <= corte, melhor = p.hits.filter(Boolean).length, antes = p.hits.filter(t => t != null && visto(t)).length
      const fd = p.fim && !visto(p.fim.t) ? p.fim : null
      const depois = corte == null ? '' : fd ? (({ tp1: ' · saiu no TP1', stop: ' · stop' })[fd.estado] ?? ' · TP3') + quando(fd.exato ?? fd.t, p.time)
        : melhor > antes ? ' · TP' + melhor + quando(p.hits[melhor - 1], p.time) : ''
      caixa(p, p.time, ate)
      // as linhas do TP1 e do TP2 dentro da caixa verde; no último sinal, todas com o preço escrito e um ✓ no TP tocado
      // 23/10 («isto fica sempre do lado direito, para não confundir»): os preços do último aviso vão sempre até à direita
      // do gráfico, mesmo com a caixa já fechada
      juntaL({ de: p.time, ate: p === ultimo ? null : ate, itens: p === ultimo ? precos(p) : [0, 1].map(k => ({ preco: p.tps[k], cor: 'rgba(156,184,148,0.45)' })) })
      if (!camadas.sinais) mAlvos.push(nome(p, ((n => n > 1 ? ' ×' + n : '')(g.length - (solto && g.includes(solto) ? 1 : 0))) + depois))
      pontos(p, visto)
    })
    if (solto) { caixa(solto, solto.time, null); juntaL({ de: solto.time, ate: null, itens: precos(solto) }); if (!camadas.sinais) mAlvos.push(nome(solto)); pontos(solto, t => t >= solto.time) }
    marcasAlvos.setMarkers(mAlvos.sort((a, b) => a.time - b.time))
    if (camadas.alvos) quadroAlvos(d.alvos, d.simbolo === 'XAUUSD'); else quadro.style.display = 'none'
    requestAnimationFrame(porQuadro)
    porTempo = new Map()
    if (camadas.sinais) for (const s of d.sinais) porTempo.set(s.time, [...(porTempo.get(s.time) || []), s])
    marcadores.setMarkers(camadas.sinais ? d.sinais.map(s => marca(s, casas)).sort((a, b) => a.time - b.time) : [])
    // as entradas das estratégias (camada Estratégias): seta do lado, nome curto e ✓ se chegou a um TP, ✗ se foi ao stop
    // «EDNEY: todas» junta as três dele (liquidez, CHoCH e order block)
    const ver = (camadas.estrVer || []).flatMap(v => v === 'edney' ? ['liquidez', 'choch', 'orderblock'] : [v]), EL = ver.length ? (d.estrategias?.lista || []).filter(x => ver.includes(x.id)) : []
    marcasEstr.setMarkers(EL.map(x => ({ time: x.time, position: x.lado === 'venda' ? 'aboveBar' : 'belowBar', shape: x.lado === 'venda' ? 'arrowDown' : 'arrowUp',
      color: x.lado === 'venda' ? '#cc9390' : '#9cb894', size: 0.8, text: x.curto + (x.fim === 'stop' ? ' ✗' : /^tp/.test(x.fim) || (x.fim === 'tempo' && x.pips > 0) ? ' ✓' : '') })).sort((a, b) => a.time - b.time))
    // 24/10 («para essas estratégias também podes meter as boxes»): a caixa de cada entrada, como as dos avisos (verde até
    // ao TP3, vermelha até ao stop), da vela da entrada até ao fim dela; nunca por cima da seguinte
    EL.forEach((x, i) => { const prox = EL[i + 1]?.time, ate = x.ate == null ? prox ?? null : prox != null ? Math.min(x.ate, prox) : x.ate; caixa(x, x.time, ate) })
    velaPorTempo = new Map()
    const pads = camadas.velas ? d.padroes || [] : []
    for (const v of pads) velaPorTempo.set(v.time, [...(velaPorTempo.get(v.time) || []), v])
    marcasVelas.setMarkers(pads.map(v => ({ time: v.time, position: v.lado === 'compra' ? 'belowBar' : 'aboveBar', shape: 'circle', size: 0.5,
      color: v.confirmada ? (v.lado === 'compra' ? '#9cb894' : '#cc9390') : '#8f959c' })).sort((a, b) => a.time - b.time))
    const vistas = new Set()
    if (camadas.linhas) for (const l of d.linhas || []) {
      const k = l.tf + '|' + l.lado, sr = serieLT(k)
      vistas.add(k); sr.applyOptions({ lineStyle: l.partida ? 2 : l.valida ? 0 : 1, lastValueVisible: !l.partida, title: l.partida ? '' : 'LT ' + (l.tf === '4h' ? '4 h' : '1 h') }); sr.setData(l.pontos)
    }
    for (const [k, sr] of linhasLT) if (!vistas.has(k)) sr.setData([])
    for (const p of linhasFibo) velas.removePriceLine(p)
    linhasFibo = []
    if (camadas.fibo && d.fibo) for (const n of d.fibo.niveis) linhasFibo.push(velas.createPriceLine({ price: n.p, color: 'rgba(214,195,159,.6)', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'Fibo ' + FIBO[n.r] }))
    for (const p of linhasPos) velas.removePriceLine(p)
    linhasPos = []
    if (camadas.posicoes) for (const p of d.posicoes) {
      linhasPos.push(velas.createPriceLine({ price: p.preco, color: '#d6c39f', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: p.lado + ' ' + fmt(p.lotes, 2) }))
      if (p.sl > 0) linhasPos.push(velas.createPriceLine({ price: p.sl, color: '#cc9390', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'stop' }))
      if (p.tp > 0) linhasPos.push(velas.createPriceLine({ price: p.tp, color: '#9cb894', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'TP' }))
    }
    n = d.velas.length; nVer = d.tf === '15m' ? 130 : 110
    if (nova) { mexeu = false; ajustar() }
  }
  // o plano no gráfico: a entrada, o stop e os dois alvos (tracejados, com o nome no eixo)
  let linhasPlano = []
  function plano(p) {
    for (const l of linhasPlano) velas.removePriceLine(l)
    linhasPlano = []
    if (!p) return
    for (const [preco, cor, titulo] of [[p.entrada, '#d6c39f', 'entrada'], [p.sl, '#cc9390', 'stop'], [p.tp1, '#9cb894', 'alvo 1'], [p.tp2, '#9cb894', 'alvo 2']])
      linhasPlano.push(velas.createPriceLine({ price: preco, color: cor, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: titulo }))
  }
  return { mostrar, plano }
}
