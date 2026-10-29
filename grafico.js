// O gráfico do Jarvis (Lightweight Charts 5): as velas, as linhas do SV3, as EMA 200 e 80, os tetos e suportes com nome, a
// caixa da Ásia, o Fibonacci de 4 h, as velas de confirmação e os sinais com o resultado (com uma dica ao passar o rato), as
// posições com o stop e, num painel por baixo, o estocástico 5,3,3. Horas de Lisboa; as velas do dia com a data do dia
// de forex (começam às 17:00 de Nova Iorque, na véspera).
const L = window.LightweightCharts
const LX = 'Europe/Lisbon', NB = ' '
const TFS = { '1s': 1, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }
const fmt = (v, c) => { const s = Math.abs(v).toFixed(c).split('.'); return (v < 0 ? '-' : '') + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB) + (s[1] ? ',' + s[1] : '') }
const hora = t => new Date(t * 1000).toLocaleTimeString('pt-PT', { timeZone: LX, hour: '2-digit', minute: '2-digit' })
const horaS = t => new Date(t * 1000).toLocaleTimeString('pt-PT', { timeZone: LX, hour: '2-digit', minute: '2-digit', second: '2-digit' })
const data = t => new Date(t * 1000).toLocaleDateString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit' })
const NOMES = { teto: 'venda no teto', sv3: 'SV3', pico: 'venda depois do pico', incrivel: 'INCRÍVEL' }
// 24/10 («ainda está feio»): as cores do gráfico vêm de uma paleta. No escuro, as nossas (rosa velho, verde salva, areia);
// no claro, as clássicas do TradingView (vermelho e verde-água, laranja nas médias), todas da mesma família das velas,
// com os textos um pouco mais fundos para se lerem no branco
// 24/10 («mete mais opções tipo de cor»): cinco cores para o gráfico. Cada uma traz o fundo da escala, a grelha, as
// velas e a família das linhas, caixas e marcas (r vermelho, g verde, a laranja/areia, c cinzento; rt/gt/at/ct os textos)
const CORES = {
  escuro: { r: '204,147,144', g: '156,184,148', a: '214,195,159', c: '139,144,150', rt: '#cc9390', gt: '#9cb894', at: '#d6c39f', ct: '#8f959c',
    vs: '#9cb894', vd: '#cc9390', pu: 'rgba(156,184,148,.7)', pd: 'rgba(204,147,144,.7)', rotulo: 'rgba(15,17,19,0.86)', hr: '#2a2f35',
    texto: '#8f959c', grelha: 'rgba(255,255,255,0.035)', borda: '#23272c', mira: '#3a4047', etiqueta: '#2a2f35', linhaPreco: '#6f757c' },
  noite: { r: '239,83,80', g: '38,166,154', a: '255,152,0', c: '120,123,134', rt: '#ef5350', gt: '#26a69a', at: '#ff9800', ct: '#868993',
    vs: '#26a69a', vd: '#ef5350', pu: '#26a69a', pd: '#ef5350', rotulo: 'rgba(19,23,34,0.88)', hr: '#2a2e39',
    texto: '#b2b5be', grelha: 'rgba(42,46,57,0.55)', borda: '#2a2e39', mira: '#758696', etiqueta: '#363a45', linhaPreco: '#758696' },
  preto: { r: '204,147,144', g: '156,184,148', a: '214,195,159', c: '150,150,150', rt: '#d9a19e', gt: '#a9c4a1', at: '#dccaa6', ct: '#9a9a9a',
    vs: '#ececec', vd: '#6b6b6b', pu: '#ececec', pd: '#6b6b6b', rotulo: 'rgba(0,0,0,0.86)', hr: '#262626',
    texto: '#9a9a9a', grelha: 'rgba(255,255,255,0.05)', borda: '#222222', mira: '#4a4a4a', etiqueta: '#2a2a2a', linhaPreco: '#7a7a7a' },
  branco: { r: '239,83,80', g: '38,166,154', a: '242,153,74', c: '120,123,134', rt: '#d9443f', gt: '#15897d', at: '#d9822b', ct: '#787b86',
    vs: '#26a69a', vd: '#ef5350', pu: '#26a69a', pd: '#ef5350', rotulo: 'rgba(255,255,255,0.92)', hr: '#e0e3eb',
    texto: '#131722', grelha: '#f0f3fa', borda: '#e0e3eb', mira: '#9598a1', etiqueta: '#131722', linhaPreco: '#9598a1' },
  papel: { r: '178,98,92', g: '93,138,85', a: '176,130,60', c: '130,124,114', rt: '#a65752', gt: '#4f7d4b', at: '#9a7238', ct: '#7a7368',
    vs: '#5d8a55', vd: '#b2625c', pu: '#5d8a55', pd: '#b2625c', rotulo: 'rgba(247,243,234,0.94)', hr: '#e2dac9',
    texto: '#5a544b', grelha: 'rgba(60,45,25,0.06)', borda: '#e2dac9', mira: '#b9b0a0', etiqueta: '#4a443b', linhaPreco: '#b9b0a0' }
}
let P = CORES.escuro
const R = a => 'rgba(' + P.r + ',' + a + ')', G = a => 'rgba(' + P.g + ',' + a + ')', A = a => 'rgba(' + P.a + ',' + a + ')', C = a => 'rgba(' + P.c + ',' + a + ')'
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
  const bate = yy => yy < 0 || ocupados.some(o => x < o.x + o.w && o.x < x + w && yy < o.y + o.h && o.y < yy + h)   // acima do ecrã não se lê
  let livre = y
  for (let n = 1; n <= 8 && bate(livre); n++) livre = y + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * (h + 2)
  if (bate(livre)) livre = y
  ocupados.push({ x, y: livre, w, h })
  return livre
}
const ocupar = o => { if (!ocupados) { ocupados = []; queueMicrotask(() => { ocupados = null }) } ocupados.push(o) }
const ocupado = o => !!ocupados && ocupados.some(q => o.x < q.x + q.w && q.x < o.x + o.w && o.y < q.y + q.h && q.y < o.y + o.h)

// uma caixa de preço (com ou sem horas): o fundo por baixo das velas e o nome por cima delas. `x` dá o sítio de uma hora
// (xDe, em criarGrafico)
class Caixa {
  constructor(o, x) {
    this.o = o; this.x = x
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
      let x1 = o.de != null ? this.x(o.de) : -Infinity, x2 = o.ate != null ? this.x(o.ate) : Infinity
      // sem velas, ou acabou antes da primeira vela (no 1 s, um aviso de há horas já não se desenha)
      if (x1 == null || x2 == null || x2 === -Infinity || x1 === Infinity) return
      if (x1 === -Infinity) x1 = 0
      if (x2 === Infinity) x2 = W
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
      if (!o.texto || y2 < 0 || y1 > sc.mediaSize.height) return
      c.font = (11 * r) + 'px -apple-system, sans-serif'
      // o nome vai por cima da caixa. 25/10 (gráfico mais perto, no 1 s e no telemóvel): com o topo dela fora do ecrã vai para
      // dentro, no fundo dela; se a caixa tapa o ecrã todo, fica em cima à direita (à esquerda está a legenda do telemóvel)
      const H = sc.mediaSize.height, w = c.measureText(o.texto).width
      let yt = y1 - 16, esq = o.esq
      if (yt < 2) { if (y2 <= H && y2 - 17 >= 2) yt = y2 - 17; else { yt = 2; esq = false } }
      const x = esq ? x1 + 6 : x2 - 8 - w / r, y = lugarLivre(x - 4, yt, w / r + 8, 15) + 11
      c.fillStyle = P.rotulo; c.fillRect((x - 4) * r, (y - 11) * k, w + 8 * r, 15 * k)
      c.fillStyle = o.cor; c.fillText(o.texto, x * r, y * k)
    })
  }
}

// linhas de preço entre duas horas, tracejadas, com o nome na ponta direita (os TP, a entrada e o stop dos sinais, 22/10:
// «como é que eu sei onde é o TP1?»). Os nomes afastam-se uns dos outros quando as linhas estão muito juntas.
class Linhas {
  constructor(o, x) { this.o = o; this.x = x; this.vistas = [{ zOrder: () => 'top', renderer: () => ({ draw: t => this.desenha(t) }) }] }
  attached(p) { this.chart = p.chart; this.serie = p.series }
  detached() {}
  updateAllViews() {}
  paneViews() { return this.vistas }
  desenha(t) {
    const o = this.o
    t.useBitmapCoordinateSpace(sc => {
      const c = sc.context, r = sc.horizontalPixelRatio, k = sc.verticalPixelRatio, ts = this.chart.timeScale(), W = sc.mediaSize.width, m = ts.options().barSpacing / 2
      let x1 = this.x(o.de), x2 = o.ate != null ? this.x(o.ate) : Infinity
      if (x1 == null || x2 == null || x2 === -Infinity || x1 === Infinity) return
      x1 = x1 === -Infinity ? 0 : x1 - m
      x2 = x2 === Infinity ? W : x2 + m
      if (x2 <= x1) return
      const itens = o.itens.map(it => ({ ...it, y: this.serie.priceToCoordinate(it.preco) })).filter(it => it.y != null)
      c.save()
      c.lineWidth = r; c.setLineDash([4 * r, 3 * r])
      for (const it of itens) { c.strokeStyle = it.cor; c.beginPath(); c.moveTo(x1 * r, Math.round(it.y * k) + 0.5); c.lineTo(x2 * r, Math.round(it.y * k) + 0.5); c.stroke() }
      // os nomes: por ordem de altura, pelo menos 15 px entre eles, e o grupo centrado nas linhas. 25/10 (os preços da
      // Liquidez à direita): quando bate noutro nome, o grupo muda de sítio inteiro; cada nome a fugir sozinho baralhava a
      // ordem numa caixa pequena (o TP2 ia parar 40 pips acima do TP3)
      const rot = itens.filter(it => it.texto).sort((a, b) => a.y - b.y), GAP = 15
      rot.forEach((it, n) => { it.yr = n && it.y - rot[n - 1].yr < GAP ? rot[n - 1].yr + GAP : it.y })
      const desvio = rot.length ? rot.reduce((s, it) => s + it.y - it.yr, 0) / rot.length : 0
      c.setLineDash([]); c.font = (11 * r) + 'px -apple-system, sans-serif'; c.textBaseline = 'middle'
      for (const it of rot) { it.w = c.measureText(it.texto).width; it.x = x2 - it.w / r - 6 }
      // (procura até 30 px acima ou abaixo; sem lugar, fica à altura certa)
      const lugar = (it, dy) => ({ x: it.x - 4, y: it.yr + desvio + dy - 7.5, w: it.w / r + 8, h: 15 }), bate = dy => rot.some(it => ocupado(lugar(it, dy)))
      let dy = 0
      for (let n = 1; n <= 10 && bate(dy); n++) dy = (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 6
      if (bate(dy)) dy = 0
      for (const it of rot) {
        const q = lugar(it, dy)
        ocupar(q)
        c.fillStyle = P.rotulo; c.fillRect(q.x * r, q.y * k, it.w + 8 * r, 15 * k)
        c.fillStyle = it.cor; c.fillText(it.texto, it.x * r, (q.y + 7.5) * k)
      }
      c.restore()
    })
  }
}

// 24/10 («estes títulos ficam bué confusos», «não quero perder os nomes em cima delas»): os nomes das setas e dos pontos
// desenhados à parte. Ficam por cima da seta numa venda e por baixo numa compra, como antes, mas com um contorno da cor do
// fundo (leem-se por cima das velas e das caixas) e nunca uns em cima dos outros nem em cima de outra seta ou ponto. Sem
// lugar, o nome de uma seta encosta-se à esquerda ou à direita dela, ou sobe (desce) uma linha, até duas; o de um ponto
// passa para o lado do ponto e, se nem assim couber, não se escreve (o ponto e a dica do rato continuam lá)
class Rotulos {
  constructor(itens, x) { this.itens = itens; this.x = x; this.vistas = [{ zOrder: () => 'top', renderer: () => ({ draw: t => this.desenha(t) }) }] }
  attached(p) { this.chart = p.chart; this.serie = p.series }
  detached() {}
  updateAllViews() {}
  paneViews() { return this.vistas }
  desenha(t) {
    t.useBitmapCoordinateSpace(sc => {
      const c = sc.context, r = sc.horizontalPixelRatio, k = sc.verticalPixelRatio, ts = this.chart.timeScale(), W = sc.mediaSize.width, H = sc.mediaSize.height
      // as medidas das setas como a biblioteca as faz: o tamanho vem do espaço entre velas, com uma margem, e as da mesma
      // vela empilham-se
      const S = Math.min(Math.max(ts.options().barSpacing, 12), 30), margem = Math.max(S * 0.1, 3), ALT = 14
      const L = this.itens.map(it => ({ ...it, x: this.x(it.time), y: this.serie.priceToCoordinate(it.preco) }))
        .filter(it => it.x != null && it.y != null && it.x > -80 && it.x < W + 80 && (!it.seta || (it.y > -30 && it.y < H + 30)))
      // primeiro o sítio de cada seta e de cada ponto fica ocupado; depois os nomes, os das setas antes dos dos pontos
      for (const it of L) {
        const f = S * it.tam
        if (it.ponto) { it.yc = it.y + (it.desvio || 0) * f / 2; ocupar({ x: it.x - f / 2, y: it.yc - f / 2, w: f, h: f }); continue }
        // a seta no preço da entrada: a ponta toca-lhe, por cima numa venda e por baixo numa compra
        if (it.seta) { ocupar({ x: it.x - f / 2, y: it.cima ? it.y - f : it.y, w: f, h: f }); it.base = it.cima ? it.y - f - 2 : it.y + f + 2; continue }
        ocupar({ x: it.x - f / 2, y: it.cima ? it.y - margem - (it.n + 1) * f - it.n * margem : it.y + margem + it.n * (f + margem), w: f, h: f })
        it.base = it.cima ? it.y - it.pilha * (f + margem) - 2 : it.y + it.pilha * (f + margem) + 2
      }
      L.sort((a, b) => (a.ponto ? 1 : 0) - (b.ponto ? 1 : 0))
      c.save()
      // 26/10 («supostamente essa que fechou era de venda»): a seta de uma compra ficava por baixo da vela, a 14 pips da entrada
      // e com o stop por cima dela, e parecia uma venda. Agora a ponta fica no preço da entrada, como no MT5; o contorno
      // (o da letra dos nomes) deixa-a ver-se por cima de uma vela da mesma cor
      c.lineJoin = 'round'; c.lineWidth = 2.5 * r; c.strokeStyle = P.rotulo
      for (const it of L) if (it.seta) {
        const f = S * it.tam, s = it.cima ? -1 : 1, x = it.x, y = it.y, cab = f * 0.55, h = f / 2, ha = Math.max(1, f / 7)
        c.beginPath()
        c.moveTo(x * r, y * k); c.lineTo((x + h) * r, (y + s * cab) * k); c.lineTo((x + ha) * r, (y + s * cab) * k); c.lineTo((x + ha) * r, (y + s * f) * k)
        c.lineTo((x - ha) * r, (y + s * f) * k); c.lineTo((x - ha) * r, (y + s * cab) * k); c.lineTo((x - h) * r, (y + s * cab) * k); c.closePath()
        c.stroke(); c.fillStyle = it.cor; c.fill()
      }
      c.font = '500 ' + (11 * r) + 'px -apple-system, sans-serif'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 3 * r; c.strokeStyle = P.rotulo
      const dentro = y => Math.max(1, Math.min(H - ALT - 1, y))
      for (const it of L) {
        const w = c.measureText(it.texto).width / r + 4, f = S * it.tam, lugares = []
        if (it.ponto) {
          const y = dentro(it.cima ? it.yc - f / 2 - 2 - ALT : it.yc + f / 2 + 2), yl = dentro(it.yc - ALT / 2)
          lugares.push([it.x - w / 2, y], [it.x + f / 2 + 2, yl], [it.x - f / 2 - 2 - w, yl])
        } else for (let n = 0; n < 3; n++) {
          const y = dentro(it.cima ? it.base - ALT - n * (ALT + 2) : it.base + n * (ALT + 2))
          lugares.push([it.x - w / 2, y], [it.x - 6, y], [it.x + 6 - w, y])
        }
        const l = lugares.find(([x, y]) => !ocupado({ x, y, w, h: ALT })) || (it.ponto ? null : lugares[0])
        if (!l) continue
        ocupar({ x: l[0], y: l[1], w, h: ALT })
        c.strokeText(it.texto, (l[0] + 2) * r, (l[1] + ALT / 2) * k); c.fillStyle = it.cor; c.fillText(it.texto, (l[0] + 2) * r, (l[1] + ALT / 2) * k)
      }
      c.restore()
    })
  }
}

// 25/10 (o nome do suporte ficava por baixo do «alvo 1»): os nomes das linhas de preço (plano, posições, Fibo), que a
// biblioteca escreve à direita, dentro do gráfico, ficam marcados antes dos outros nomes; esses fogem deles
class Reserva {
  constructor(linhas) { this.linhas = linhas; this.vistas = [{ zOrder: () => 'top', renderer: () => ({ draw: t => this.desenha(t) }) }] }
  attached(p) { this.serie = p.series }
  detached() {}
  updateAllViews() {}
  paneViews() { return this.vistas }
  desenha(t) {
    t.useMediaCoordinateSpace(({ context: c, mediaSize: { width: W } }) => {
      c.font = '11px -apple-system, sans-serif'
      for (const l of this.linhas()) {
        const o = l.options(), y = o.title ? this.serie.priceToCoordinate(o.price) : null
        if (y != null) { const w = c.measureText(o.title).width + 14; ocupar({ x: W - w, y: y - 8, w, h: 16 }) }
      }
    })
  }
}

function marca(s, casas) {
  const r = s.resultado, aberta = !r || r.estado === 'aberta'
  const bom = r?.eur != null ? r.eur >= 0 : r?.r != null ? r.r >= 0 : null
  const cor = aberta || bom == null ? P.at : bom ? P.gt : P.rt
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

// 24/10 («estes títulos e os outros também ficam bué confusos»): as setas das estratégias e dos avisos já não levam nome
// por cima das velas. O nome, os preços e como acabou aparecem ao passar o rato, como nos Sinais. A cor da seta de uma
// estratégia diz como acabou (verde ganhou, vermelho perdeu, areia ainda a decorrer); a ponta, o lado
const ganhou = x => /^tp/.test(x.fim) || (x.fim === 'tempo' && x.pips > 0)
const corEstr = x => x.fim === 'aberta' ? P.at : ganhou(x) ? P.gt : P.rt
const FIM_ESTR = { tp3: 'chegou ao TP3', tp1: 'chegou ao TP2 e saiu no TP1', stop: 'bateu no stop', tempo: 'fechou ao fim de 24 h' }
function dicaEstr(x, casas) {
  const res = x.fim === 'aberta' ? 'ainda a decorrer' : '<b style="color:' + corEstr(x) + '">' + (ganhou(x) ? '✓ ' : '✗ ') + (FIM_ESTR[x.fim] || x.fim) + '</b> · '
    + (x.pips >= 0 ? '+' : '-') + fmt(Math.abs(x.pips), 1) + ' pips'
  return '<b>' + x.nome + ', ' + x.lado + '</b> às ' + hora(x.t) + ' de ' + data(x.t) + '<br>entrada ' + fmt(x.entrada, casas) + ' · stop ' + fmt(x.sl, casas) + ' · TP3 ' + fmt(x.tps[2], casas) + '<br>' + res
}
// 26/10: os números dos avisos do dia, como no Telegram («#7»); três ou mais seguidos ficam «#2 a #6»
export function numerosAviso(l) {
  const L = l.filter(Boolean), out = []
  for (let i = 0; i < L.length;) {
    let j = i
    while (j + 1 < L.length && L[j + 1] === L[j] + 1) j++
    out.push(j - i >= 2 ? '#' + L[i] + ' a #' + L[j] : L.slice(i, j + 1).map(k => '#' + k).join(' '))
    i = j + 1
  }
  return out.join(' ')
}
// o aviso do bot: os TP por onde passou e como acabou pela regra (TP3, de volta ao TP1 depois do TP2, ou stop)
const TIPO_ALVO = { teto: ' de teto', pico: ' depois do pico', incrivel: ' INCRÍVEL', sv3: ' do SV3' }
const CURTO_SINAL = { teto: 'Teto', pico: 'Pico', incrivel: 'INCRÍVEL', sv3: 'SV3' }
function dicaAlvo(p, n, casas, nome) {
  const quando = t => hora(t) + (data(t) === data(p.t) ? '' : ' de ' + data(t)), e = p.fim?.estado
  const tps = p.hits.map((t, k) => t != null && !(e === 'tp3' && k === 2) ? 'TP' + (k + 1) + ' às ' + quando(t) : null).filter(Boolean).join(' · ')
  const fim = !p.fim ? 'ainda aberto' : '<b style="color:' + (e === 'stop' ? P.rt : P.gt) + '">'
    + ({ tp3: '✓ fechou no TP3', tp1: '✓ saiu no TP1, depois do TP2', stop: '✗ stop' }[e] || e) + ' às ' + quando(p.fim.exato ?? p.fim.t) + '</b>'
  return '<b>' + (p.num ? '#' + p.num + ' ' : '') + (p.lado === 'venda' ? 'Venda' : 'Compra') + (TIPO_ALVO[p.tipo] || (nome ? ' · ' + nome : '')) + (n > 1 ? ' ×' + n : '') + '</b> às ' + hora(p.t) + ' de ' + data(p.t)
    + '<br>entrada ' + fmt(p.entrada, casas) + ' · stop ' + fmt(p.sl, casas) + ' · TP3 ' + fmt(p.tps[2], casas) + (tps ? '<br>' + tps : '') + '<br>' + fim
}

export function criarGrafico(el, { pedirHistoria = null } = {}) {
  let casas = 2, chave = '', caixas = [], linhasPos = [], linhasFibo = [], porTempo = new Map(), velaPorTempo = new Map(), notas = new Map(), tfAtual = '15m', estK = null, estD = null, estLinhas = [], ultimaVez = null, ultimoPlano = null
  let n = 0, mexeu = false, serieVelas = []   // quantas velas, se ele já mexeu no gráfico e as velas como estão na série
  const rot = t => tfAtual === '1d' ? t + 43200 : t   // a vela do dia começa às 17:00 de NY da véspera: mostra-se a data do dia
  const movel = matchMedia('(max-width: 1000px), (max-height: 520px)')   // o telemóvel, como no estilo.css
  const chart = L.createChart(el, {
    autoSize: true,
    kineticScroll: { touch: true, mouse: false },
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: P.ct, fontSize: movel.matches ? 10 : 11, attributionLogo: false,
      panes: { separatorColor: '#23272c', separatorHoverColor: 'rgba(255,255,255,0.04)', enableResize: false } },
    grid: { vertLines: { color: 'rgba(255,255,255,0.035)' }, horzLines: { color: 'rgba(255,255,255,0.035)' } },
    // mais preços na escala (24/10); no telemóvel menos, para não se amontoarem com as etiquetas (25/10)
    rightPriceScale: { borderColor: '#23272c', scaleMargins: { top: 0.08, bottom: 0.06 }, tickMarkDensity: movel.matches ? 2.5 : 1.2 },
    timeScale: { borderColor: '#23272c', timeVisible: true, secondsVisible: false, rightOffset: 8, lockVisibleTimeRangeOnResize: true, tickMarkFormatter: (t, tipo) => tipo <= 2 ? data(rot(t)) : tipo === 4 ? horaS(t) : hora(t) },
    localization: { locale: 'pt-PT', timeFormatter: t => tfAtual === '1d' ? data(rot(t)) : data(t) + ' ' + (tfAtual === '1s' ? horaS(t) : hora(t)) },
    // 25/10 («tenho o rato mais abaixo e ele só assimila acima»): a cruz segue o rato e a escala da direita diz o preço onde ele
    // está; antes colava ao fecho da vela por baixo do rato (o modo íman, que é o de origem)
    crosshair: { mode: L.CrosshairMode.Normal, vertLine: { color: '#3a4047', labelBackgroundColor: '#2a2f35' }, horzLine: { color: '#3a4047', labelBackgroundColor: '#2a2f35' } }
  })
  // 25/10 (1 s): o sítio de uma hora no gráfico. Uma hora sem vela (as dos avisos são de 15 min; no 1 s há segundos sem preço
  // novo) fica na vela seguinte, como as setas da biblioteca; antes da primeira vela dá -Infinity e depois da última +Infinity
  const xDe = t => {
    const ts = chart.timeScale(), x = ts.timeToCoordinate(t), V = serieVelas
    if (x != null || !V.length) return x
    if (t < V[0].time) return -Infinity
    if (t > V.at(-1).time) return Infinity
    let a = 0, b = V.length - 1
    while (a < b) { const m = (a + b) >> 1; if (V[m].time < t) a = m + 1; else b = m }
    return ts.logicalToCoordinate(a)
  }
  // 25/10 («tava super longe»; no telemóvel «quero algo mais espaçoso»): no 1 s e no telemóvel a escala do preço segue as velas
  // que se veem. Cada linha só a alarga até uma altura das velas acima ou abaixo delas: as LT do 4 h, a 180 $ do preço,
  // achatavam as velas de 1 s numa risca. O que fica mais longe sai do ecrã e volta ao arrastar o gráfico
  let faixa = null
  const faixaVelas = () => {
    const lr = chart.timeScale().getVisibleLogicalRange(), V = serieVelas, u = V.at(-1)
    if (!lr || !u) return null
    const k = lr.from + '|' + lr.to + '|' + V.length + '|' + u.high + '|' + u.low
    if (faixa?.k === k) return faixa
    let lo = Infinity, hi = -Infinity
    for (let i = Math.max(0, Math.ceil(lr.from)), f = Math.min(V.length - 1, Math.floor(lr.to)); i <= f; i++) { lo = Math.min(lo, V[i].low); hi = Math.max(hi, V[i].high) }
    return faixa = { k, lo, hi }
  }
  const perto = base => {
    const r = base()
    if (!r?.priceRange || !(tfAtual === '1s' || movel.matches)) return r
    const v = faixaVelas()
    if (!v || !(v.hi >= v.lo)) return r
    const h = Math.max(v.hi - v.lo, v.hi * 2e-4), lo = Math.max(r.priceRange.minValue, v.lo - h), hi = Math.min(r.priceRange.maxValue, v.hi + h)
    return lo <= hi ? { ...r, priceRange: { minValue: lo, maxValue: hi } } : null
  }
  // no telemóvel a escala da direita sem o espaço dos milhares (4000,20): fica mais estreita
  const fmtEixo = p => movel.matches ? p.toFixed(casas).replace('.', ',') : fmt(p, casas)
  const velas = chart.addSeries(L.CandlestickSeries, { upColor: P.gt, downColor: P.rt, borderUpColor: P.gt, borderDownColor: P.rt,
    wickUpColor: G(.7), wickDownColor: R(.7), priceLineColor: '#6f757c' })
  const linha = (cor, w, estilo = 0) => chart.addSeries(L.LineSeries, { color: cor, lineWidth: w, lineStyle: estilo, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: perto })
  const verm = linha(R(.9), 2), cinza = linha(C(.8), 1, 2), verde = linha(G(.9), 2), ema = linha(A(.7), 1)
  const ema80 = linha(A(.5), 1, 2)
  // as linhas de tendência (4 h grossa, 1 h fina), com o preço onde passam agora no eixo; tracejadas quando partiram
  const linhasLT = new Map()
  const serieLT = k => {
    if (!linhasLT.has(k)) {
      const [tf, lado] = k.split('|')
      linhasLT.set(k, chart.addSeries(L.LineSeries, { color: lado === 'subida' ? G(.85) : R(.85), lineWidth: tf === '4h' ? 2 : 1, priceLineVisible: false,
        crosshairMarkerVisible: false, title: 'LT ' + (tf === '4h' ? '4 h' : '1 h'), priceFormat: { type: 'custom', minMove: 1e-5, formatter: fmtEixo }, autoscaleInfoProvider: perto }, 0))
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
  // 25/10 («preciso que o gráfico tenha mais tempo para trás»): a janela que vem de minuto a minuto continua a mesma; quando ele
  // chega com o gráfico à ponta esquerda, pedem-se as velas de antes, aos bocados de 2000, e ficam guardadas por símbolo e
  // tempo. Cada janela nova cola-se a elas pela hora (o que sai da janela fica na história: não há buracos)
  const historias = new Map(), aPedir = new Set(), semMais = new Set(), PRECOS = ['verm', 'cinza', 'verde', 'ema200', 'ema80'], SERIES = ['velas', ...PRECOS, 'k', 'd']
  // 28/10: as velas do ouro vêm cada uma com a diferença da hora dela (diferenca.mjs no servidor), que não muda com a de
  // agora: as guardadas já não se acertam
  function comHistoria(d) {
    const h = historias.get(d.simbolo + '|' + d.tf)
    if (!h || !d.velas.length) return d
    const w0 = d.velas[0].time, cola = (a, b) => { let i = a.length; while (i > 0 && a[i - 1].time >= w0) i--; return [...a.slice(0, i), ...b] }
    const D = { ...d, velas: cola(h.velas, d.velas), sv3: { verm: cola(h.verm, d.sv3.verm), cinza: cola(h.cinza, d.sv3.cinza), verde: cola(h.verde, d.sv3.verde) },
      ema200: cola(h.ema200, d.ema200), ema80: cola(h.ema80, d.ema80 || []), estoc: d.estoc && { k: cola(h.k, d.estoc.k), d: cola(h.d, d.estoc.d) } }
    Object.assign(h, { velas: D.velas, ...D.sv3, ema200: D.ema200, ema80: D.ema80 }, D.estoc && { k: D.estoc.k, d: D.estoc.d })
    return D
  }
  function receberHistoria(r) {
    const k = r.simbolo + '|' + r.tf, linhaH = a => r.t.map((t, i) => a[i] == null ? { time: t } : { time: t, value: a[i] })
    aPedir.delete(k)
    if (r.fim) semMais.add(k)
    if (!r.t?.length) return
    const novo = { velas: r.t.map((t, i) => ({ time: t, open: r.o[i], high: r.h[i], low: r.l[i], close: r.c[i] })), ...Object.fromEntries([...PRECOS, 'k', 'd'].map(q => [q, linhaH(r[q])])) }
    const h = historias.get(k)
    if (h) { const t0 = h.velas[0]?.time ?? Infinity; for (const q of SERIES) h[q] = [...novo[q].filter(x => x.time < t0), ...h[q]] }
    else { historias.set(k, novo); if (historias.size > 6) historias.delete(historias.keys().next().value) }
    if (k === chave && ultimaVez) mostrar(...ultimaVez)
  }
  // só quando foi ele a arrastar (no telemóvel o gráfico nasce sem largura e a vista dava a ponta esquerda logo ao abrir)
  function talvezHistoria(lr) {
    if (!lr || !mexeu || !(lr.from < 30) || !pedirHistoria || !ultimaVez) return
    const d = ultimaVez[0], k = d.simbolo + '|' + d.tf
    if (aPedir.has(k) || semMais.has(k) || !d.velas.length) return
    aPedir.add(k)
    pedirHistoria(d.simbolo, d.tf, (historias.get(k)?.velas[0] ?? d.velas[0]).time).then(receberHistoria, () => setTimeout(() => aPedir.delete(k), 30e3))
  }
  chart.timeScale().subscribeVisibleLogicalRangeChange(lr => { requestAnimationFrame(porQuadro); talvezHistoria(lr) })
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
      + (quantos ? linha('TP1', n(0), P.gt) + linha('TP2', n(1), P.gt) + linha('TP3', n(2), P.gt) + linha('Stop', st, P.rt)
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
      estK = chart.addSeries(L.LineSeries, { ...op, color: P.at, lastValueVisible: true }, 1)
      estD = chart.addSeries(L.LineSeries, { ...op, color: C(.8), lineStyle: 2, lastValueVisible: false }, 1)
      estLinhas = [[80, R], [20, G]].map(([p, f]) => [estK.createPriceLine({ price: p, color: f(.5), lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' }), f])
      chart.panes()[0].setStretchFactor(movel.matches ? 7 : 4.5); chart.panes()[1].setStretchFactor(1)   // no telemóvel mais baixo
    }
    estK.setData(d.estoc.k); estD.setData(d.estoc.d)
    requestAnimationFrame(porTitulo)
  }
  const dica = el.querySelector('#dica')
  // as últimas velas enchem o gráfico, também quando a janela muda de tamanho ou volta a aparecer, até ele mexer no
  // gráfico (rodinha ou arrastar); duplo clique volta ao início. No computador são 130 velas de 15 min ou 110 das outras.
  // 25/10 («tava super longe», «no mobile quero algo mais espaçoso»): no 1 s e no telemóvel contam-se pela largura, para cada
  // vela ter 12 px no 1 s do computador e 8 px no telemóvel (eram 300 velas de 1 s, e no telemóvel 130 em 300 px)
  const quantas = () => {
    const w = (el.clientWidth || 800) - 60   // sem a escala da direita
    if (tfAtual === '1s' || movel.matches) return Math.max(30, Math.round(w / (movel.matches ? 8 : 12)))
    return tfAtual === '15m' ? 130 : 110
  }
  const ajustar = () => { if (n) chart.timeScale().setVisibleLogicalRange({ from: n - quantas(), to: n + 6 }) }
  movel.addEventListener('change', () => {
    chart.applyOptions({ layout: { fontSize: movel.matches ? 10 : 11 }, rightPriceScale: { tickMarkDensity: movel.matches ? 2.5 : 1.2 } })
    if (estK) chart.panes()[0].setStretchFactor(movel.matches ? 7 : 4.5)
    if (!mexeu) ajustar()
  })
  el.addEventListener('wheel', () => { mexeu = true }, { passive: true })
  el.addEventListener('pointerdown', () => { mexeu = true })
  el.addEventListener('dblclick', () => { mexeu = false; ajustar(); chart.priceScale('right').applyOptions({ autoScale: true }) })
  new ResizeObserver(() => { if (!mexeu) ajustar(); requestAnimationFrame(() => { porTitulo(); porQuadro() }) }).observe(el)
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !mexeu) ajustar() })
  chart.subscribeCrosshairMove(p => {
    const nesta = m => p?.time != null ? m.get(p.time) || [] : [], s = nesta(porTempo), v = nesta(velaPorTempo), e = nesta(notas)
    if ((!s.length && !v.length && !e.length) || !p.point) { dica.style.display = 'none'; return }
    dica.innerHTML = [...s.map(x => dicaDe(x, casas)), ...e, ...v.map(dicaVela)].join('<hr style="border:0;border-top:1px solid ' + P.hr + ';margin:6px 0">')
    dica.style.display = 'block'
    dica.style.left = Math.min(p.point.x + 14, el.clientWidth - 310) + 'px'
    dica.style.top = Math.max(8, p.point.y - 70) + 'px'
  })

  function mostrar(d0, camadas) {
    ultimaVez = [d0, camadas]
    const d = comHistoria(d0)
    const nova = d.simbolo + '|' + d.tf !== chave
    chave = d.simbolo + '|' + d.tf; casas = d.casas; tfAtual = d.tf
    chart.applyOptions({ timeScale: { secondsVisible: d.tf === '1s' } })
    velas.applyOptions({ priceFormat: { type: 'custom', minMove: 1 / 10 ** casas, formatter: fmtEixo } })   // cada painel com o seu formato
    velas.setData(d.velas); serieVelas = d.velas.slice()
    // as setas de antes da primeira vela (no 1 s, os avisos de há horas) iam parar à primeira vela
    const naJanela = m => !serieVelas.length || m.time >= serieVelas[0].time
    const ou = (on, dados) => on ? dados : []
    verm.setData(ou(camadas.sv3, d.sv3.verm)); cinza.setData(ou(camadas.sv3, d.sv3.cinza)); verde.setData(ou(camadas.sv3, d.sv3.verde))
    ema.setData(ou(camadas.ema, d.ema200)); ema80.setData(ou(camadas.ema, d.ema80 || []))
    estocastico(!!camadas.estoc && !!d.estoc, d)
    for (const c of caixas) velas.detachPrimitive(c)
    caixas = [new Reserva(() => [...linhasPlano, ...linhasPos, ...linhasFibo])]
    velas.attachPrimitive(caixas[0])
    const junta = o => { const c = new Caixa(o, xDe); velas.attachPrimitive(c); caixas.push(c) }
    const alinhar = t => t - t % TFS[d.tf]
    // as caixas dos alvos: verde da entrada ao TP3, vermelha da entrada ao stop, da vela do sinal até ao fim (TP3 ou stop;
    // aberta, até à direita); o TP1, o TP2, o TP3 e o stop marcados no preço, na vela em que lá chegou
    // 23/10 («tá tudo bugado», «uma em cima da outra? antes tava mais clean», «a box deveria estar bem colocada»): cada caixa
    // começa na vela do sinal, com a entrada nela, e nunca fica uma em cima da outra. Os avisos repetidos (o mesmo lado, até
    // 1 h depois do anterior) fazem uma caixa só («Venda ×3» na dica); o quadro continua a contar cada aviso. Quando chega outro
    // aviso com a caixa ainda aberta, ela acaba na vela antes do novo; o que fez depois vê-se ao passar o rato.
    // Se o último aviso ainda está aberto e a caixa do grupo dele já fechou, ganha a sua caixa na vela dele.
    // com uma estratégia escolhida, só as caixas dela. 25/10 («deveria estar nesses filtros»): os avisos do bot também se
    // escolhem na lista, por tipo (bot-teto, bot-pico, ...); escolhidos, só esses aparecem, mesmo com a camada Alvos desligada
    const ev = camadas.estrVer || [], tiposBot = new Set(ev.filter(v => v.startsWith('bot-')).map(v => v.slice(4)))
    const alvos = tiposBot.size ? (d.alvos?.lista || []).filter(p => tiposBot.has(p.tipo)) : camadas.alvos && !ev.length ? d.alvos?.lista || [] : [], mAlvos = [], grupos = []
    for (const p of alvos) { const g = grupos.at(-1), u = g?.at(-1); if (u && u.lado === p.lado && p.time - u.time <= 3600) g.push(p); else grupos.push([p]) }
    const fim = alvos.at(-1), rep = grupos.at(-1)?.[0], solto = fim && !fim.fim && rep !== fim && rep.fim ? fim : null, ultimo = solto || rep
    const juntaL = o => { const c = new Linhas(o, xDe); velas.attachPrimitive(c); caixas.push(c) }, fp = x => fmt(x, casas)   // 24/10 («às vezes estou em 4445,00 e é 4445,10»): com as duas casas
    const precos = p => [{ preco: p.sl, cor: P.rt, texto: 'stop ' + fp(p.sl) }, { preco: p.entrada, cor: P.at, texto: 'entrada ' + fp(p.entrada) },
      ...p.tps.map((preco, k) => ({ preco, cor: P.gt, texto: 'TP' + (k + 1) + ' ' + fp(preco) + (p.hits[k] ? ' ✓' : '') }))]
    const caixa = (p, de, ate) => {
      junta({ de, ate, velas: true, hi: Math.max(p.entrada, p.tps[2]), lo: Math.min(p.entrada, p.tps[2]), fundo: G(0.10), borda: G(0.30) })
      junta({ de, ate, velas: true, hi: Math.max(p.entrada, p.sl), lo: Math.min(p.entrada, p.sl), fundo: R(0.12), borda: R(0.30) })
    }
    // 24/10 («estes títulos ficam bué confusos», «não quero perder os nomes em cima delas»): os nomes continuam por cima das
    // setas e ao lado dos pontos, desenhados em Rotulos (legíveis por cima das velas e sem se taparem). E ao passar o rato pela
    // vela do aviso, ou pela de um TP ou do stop, aparece o aviso todo: os preços, os TP por onde passou e como acabou
    notas = new Map()
    const nota = (t, h) => { const l = notas.get(t) || []; if (!l.includes(h)) l.push(h); notas.set(t, l) }
    const porVela = new Map(d.velas.map(v => [v.time, v])), rotulos = []
    const nomeSeta = (time, cima, texto, cor, tam, entrada) => {
      if (entrada != null) { rotulos.push({ time, preco: entrada, cima, texto, cor, tam, seta: true }); return }
      const v = porVela.get(time); if (v) rotulos.push({ time, preco: cima ? v.high : v.low, cima, texto, cor, tam })
    }
    // 25/10 («que estratégia está a ser usada?»): os avisos das estratégias (CHoCH, Liquidez, ...) diziam só «Compra» ou
    // «Venda». Agora levam o nome curto por cima da seta e o nome todo ao passar o rato; os do BOT SV3 ficam como estavam
    const estrDe = new Map((d.estrategias?.ids || []).map(x => [x.id, x]))
    // 26/10 («esta?», de uma compra Liquidez que bateu no stop 2 minutos depois e parecia aberta): o nome de um aviso que já
    // acabou diz como acabou, ✓ ou ✗, como nos Sinais. Quando a caixa é cortada pelo seguinte, já o diz por extenso («· stop às»)
    const acabou = p => { const f = p.regra || p.fim; return f ? (f.estado === 'stop' ? ' ✗' : ' ✓') : '' }
    // 26/10: à frente, o número do aviso no dia, o mesmo do Telegram («#7»)
    const seta = (p, extra = '', g = [p]) => {
      const v = p.lado === 'venda', cor = v ? P.rt : P.gt, nums = numerosAviso(g.map(q => q.num))
      nomeSeta(p.time, v, (nums ? nums + ' ' : '') + (v ? 'Venda' : 'Compra') + (p.tipo === 'teto' ? ' de teto' : TIPO_ALVO[p.tipo] ? '' : ' · ' + (estrDe.get(p.tipo)?.curto || p.tipo)) + extra, cor, 0.7, p.entrada)
    }
    const pontos = (p, visto, h) => {
      const ponto = (t, o, texto, desvio = 0) => { mAlvos.push({ time: t, shape: 'circle', size: 0.5, ...o }); nota(t, h); rotulos.push({ ponto: true, time: t, preco: o.price, cima: desvio < 0, desvio, texto, cor: o.color, tam: 0.5 }) }
      p.hits.forEach((t, k) => { if (t != null && visto(t)) ponto(t, { position: 'atPriceMiddle', price: p.tps[k], color: P.gt }, 'TP' + (k + 1)) })
      if (p.fim?.estado === 'stop' && visto(p.fim.t)) ponto(p.fim.t, { position: 'atPriceMiddle', price: p.sl, color: P.rt }, 'stop')
      // 24/10: com a regra, o preço voltou ao TP1 depois do TP2 e o aviso fechou aí. O ponto e o nome ficam do lado de onde o
      // preço voltou (por cima numa venda): no meio ficava em cima da vela verde e não se lia
      if (p.fim?.estado === 'tp1' && visto(p.fim.t)) { const v = p.lado === 'venda'; ponto(p.fim.t, { position: v ? 'atPriceTop' : 'atPriceBottom', price: p.tps[0], color: P.gt }, 'saiu no TP1', v ? -1 : 1) }
    }
    // 24/10 («este TP3, tu metes esta box: isso quer dizer que a trade só vai até essa box?»): o nome do aviso diz o que ele
    // fez depois de a caixa fechar e a que horas (de Lisboa, com o dia quando já é outro)
    const diaLx = t => new Date(t * 1000).toLocaleDateString('pt-PT', { timeZone: LX, day: '2-digit', month: '2-digit' })
    const quando = (t, de) => (diaLx(t) === diaLx(de) ? ' às ' : ' a ' + diaLx(t) + ' às ') + new Date(t * 1000).toLocaleTimeString('pt-PT', { timeZone: LX, hour: '2-digit', minute: '2-digit' })
    grupos.forEach((g, i) => {
      const p = g[0], prox = i + 1 < grupos.length ? grupos[i + 1][0].time : solto && g.includes(solto) ? solto.time : null
      const corte = prox != null && (!p.fim || p.fim.t >= prox) ? prox - TFS[d.tf] : null, ate = corte ?? (p.fim ? p.fim.t : null)
      const visto = t => corte == null || t <= corte, melhor = p.hits.filter(Boolean).length, antes = p.hits.filter(t => t != null && visto(t)).length
      const fd = p.fim && !visto(p.fim.t) ? p.fim : null, n = g.length - (solto && g.includes(solto) ? 1 : 0)
      const depois = corte == null ? '' : fd ? (({ tp1: ' · saiu no TP1', stop: ' · stop' })[fd.estado] ?? ' · TP3') + quando(fd.exato ?? fd.t, p.time)
        : melhor > antes ? ' · TP' + melhor + quando(p.hits[melhor - 1], p.time) : ''
      const h = dicaAlvo(p, n, casas, estrDe.get(p.tipo)?.nome)
      caixa(p, p.time, ate)
      // as linhas do TP1 e do TP2 dentro da caixa verde; no último sinal, todas com o preço escrito e um ✓ no TP tocado
      // 23/10 («isto fica sempre do lado direito, para não confundir»): os preços do último aviso vão sempre até à direita
      // do gráfico, mesmo com a caixa já fechada
      juntaL({ de: p.time, ate: p === ultimo ? null : ate, itens: p === ultimo ? precos(p) : [0, 1].map(k => ({ preco: p.tps[k], cor: G(0.45) })) })
      if (!camadas.sinais) { seta(p, (n > 1 ? ' ×' + n : '') + (depois || acabou(p)), g.filter(q => q !== solto)); for (const q of g) if (q !== solto) nota(q.time, h) }
      pontos(p, visto, h)
    })
    if (solto) {
      const h = dicaAlvo(solto, 1, casas, estrDe.get(solto.tipo)?.nome)
      caixa(solto, solto.time, null); juntaL({ de: solto.time, ate: null, itens: precos(solto) })
      if (!camadas.sinais) { seta(solto, acabou(solto)); nota(solto.time, h) }
      pontos(solto, t => t >= solto.time, h)
    }
    marcasAlvos.setMarkers(mAlvos.filter(naJanela).sort((a, b) => a.time - b.time))
    if (camadas.alvos) quadroAlvos(d.alvos, d.simbolo === 'XAUUSD'); else quadro.style.display = 'none'
    requestAnimationFrame(porQuadro)
    porTempo = new Map()
    if (camadas.sinais) for (const s of d.sinais) porTempo.set(s.time, [...(porTempo.get(s.time) || []), s])
    marcadores.setMarkers(camadas.sinais ? d.sinais.map(s => marca(s, casas)).filter(naJanela).sort((a, b) => a.time - b.time) : [])
    // 25/10 («n entendo o que são essas setas, mete o nome por cima»): os avisos do bot na camada Sinais também com o nome,
    // por cima numa venda e por baixo numa compra, e ✓ ou ✗ quando já acabou. Só o tipo (a ponta da seta já diz o lado):
    // com «Venda de teto» em todas, os nomes atropelavam-se onde há muitas
    if (camadas.sinais) for (const s of d.sinais) {
      const cor = marca(s, casas).color
      nomeSeta(s.time, s.lado === 'venda', (CURTO_SINAL[s.tipo] || s.tipo) + (cor === P.gt ? ' ✓' : cor === P.rt ? ' ✗' : ''), cor, 0.7)
    }
    // as entradas das estratégias (camada Estratégias): a seta do lado com o nome curto, ✓ se ganhou e ✗ se perdeu. A seta e
    // o nome têm a cor de como acabou (verde ganhou, vermelho perdeu, areia ainda a decorrer); antes era a do lado, e um
    // «Liquidez ✓» de venda saía a vermelho. Podem vir várias ao mesmo tempo. 29/10: a «ZIMBA FX: todas juntas» (id edney) tem
    // as entradas dela, as das cinco do mesmo lado (antes mostrava as de cada uma das cinco)
    const ver = camadas.estrVer || [], EL = ver.length ? (d.estrategias?.lista || []).filter(x => ver.includes(x.id)) : []
    marcasEstr.setMarkers([])
    for (const x of [...EL].sort((a, b) => a.time - b.time)) {
      nota(x.time, dicaEstr(x, casas))
      nomeSeta(x.time, x.lado === 'venda', x.curto + (x.fim === 'aberta' ? '' : ganhou(x) ? ' ✓' : ' ✗'), corEstr(x), 0.8, x.entrada)
    }
    // as setas da mesma vela empilham-se (como na biblioteca): cada nome sabe quantas há e vai para fora da pilha. No
    // telemóvel também (25/10, «no telemóvel mete como antes, parece que só tem as setas, não tem o nome do CHoCH»)
    const pilhas = new Map(), daPilha = it => it.time + '|' + it.cima + '|' + it.tam
    for (const it of rotulos) if (!it.ponto && !it.seta) { it.n = pilhas.get(daPilha(it)) || 0; pilhas.set(daPilha(it), it.n + 1) }
    for (const it of rotulos) if (!it.ponto && !it.seta) it.pilha = pilhas.get(daPilha(it))
    if (rotulos.length) { const ro = new Rotulos(rotulos, xDe); velas.attachPrimitive(ro); caixas.push(ro) }
    // 24/10 («para essas estratégias também podes meter as boxes»): a caixa de cada entrada, como as dos avisos (verde até
    // ao TP3, vermelha até ao stop), da vela da entrada até ao fim dela; nunca por cima da seguinte. 25/10 («mete o TP, a
    // entrada, o TP2, o TP3»): as linhas do TP1 e do TP2 dentro de cada caixa e, na última entrada, todas com o preço escrito,
    // com ✓ nos TP a que chegou (TP3: os três; saiu no TP1: o TP1 e o TP2). 25/10 («mete isto à direita, se não fica
    // difícil»): os preços da última entrada vão sempre até à direita do gráfico, mesmo já fechada, como os do último aviso
    // do bot; no meio das velas não se liam
    const feitos = x => x.fim === 'tp3' ? 3 : x.fim === 'tp1' ? 2 : 0
    EL.forEach((x, i) => {
      const prox = EL[i + 1]?.time, ate = x.ate == null ? prox ?? null : prox != null ? Math.min(x.ate, prox) : x.ate, ult = i === EL.length - 1
      caixa(x, x.time, ate)
      juntaL({ de: x.time, ate: ult ? null : ate, itens: ult ? precos({ ...x, hits: [0, 1, 2].map(k => k < feitos(x) || null) }) : [0, 1].map(k => ({ preco: x.tps[k], cor: G(0.45) })) })
    })
    // 25/10 (os preços da Liquidez à direita): as caixas da Ásia, do diário e dos níveis juntam-se depois dos avisos e das
    // entradas: desenham-se a seguir e os nomes delas é que sobem ou descem, os preços da entrada ficam colados à direita
    if (camadas.asia && d.asia && (d.tf === '15m' || d.tf === '1h'))
      junta({ de: alinhar(d.asia.de), ate: alinhar(d.asia.ate), hi: d.asia.hi, lo: d.asia.lo, fundo: A(0.05), borda: A(0.55), tracejado: true, texto: 'caixa da Ásia', cor: P.at, esq: true })
    // o mapa do diário: caixas a toda a largura, tracejadas, por baixo dos níveis do dia
    if (camadas.diario) for (const z of d.diario || []) {
      const cor = z.lado === 'venda' ? P.r : z.lado === 'compra' ? P.g : P.a
      junta({ hi: z.hi, lo: z.lo, fundo: 'rgba(' + cor + ',0.06)', borda: 'rgba(' + cor + ',0.45)', tracejado: true, esq: true, cor: 'rgb(' + cor + ')',
        texto: 'diário · ' + ({ major: 'Major Key', swing: 'swing', intradia: 'intradía' }[z.tipo] || z.tipo) + ' · ' + z.toques + (z.toques === 1 ? ' toque' : ' toques') })
    }
    if (camadas.niveis) for (const z of d.zonas) {
      const meia = 0.6 * 10 ** -(casas === 2 ? 0 : casas - 1)
      junta({ hi: Math.max(z.hi, z.mid + meia), lo: Math.min(z.lo, z.mid - meia), fundo: z.tipo === 'teto' ? R(0.13) : G(0.13),
        texto: z.tipo + ' ' + fmt(z.mid, casas === 2 ? 1 : casas) + ' · ' + z.nome, cor: z.tipo === 'teto' ? P.rt : P.gt })
    }
    velaPorTempo = new Map()
    const pads = camadas.velas ? d.padroes || [] : []
    for (const v of pads) velaPorTempo.set(v.time, [...(velaPorTempo.get(v.time) || []), v])
    marcasVelas.setMarkers(pads.map(v => ({ time: v.time, position: v.lado === 'compra' ? 'belowBar' : 'aboveBar', shape: 'circle', size: 0.5,
      color: v.confirmada ? (v.lado === 'compra' ? P.gt : P.rt) : P.ct })).filter(naJanela).sort((a, b) => a.time - b.time))
    const vistas = new Set()
    if (camadas.linhas) for (const l of d.linhas || []) {
      const k = l.tf + '|' + l.lado, sr = serieLT(k)
      vistas.add(k); sr.applyOptions({ lineStyle: l.partida ? 2 : l.valida ? 0 : 1, lastValueVisible: !l.partida, title: l.partida ? '' : 'LT ' + (l.tf === '4h' ? '4 h' : '1 h') }); sr.setData(l.pontos)
    }
    for (const [k, sr] of linhasLT) if (!vistas.has(k)) sr.setData([])
    for (const p of linhasFibo) velas.removePriceLine(p)
    linhasFibo = []
    if (camadas.fibo && d.fibo) for (const n of d.fibo.niveis) linhasFibo.push(velas.createPriceLine({ price: n.p, color: A(.6), lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'Fibo ' + FIBO[n.r] }))
    for (const p of linhasPos) velas.removePriceLine(p)
    linhasPos = []
    if (camadas.posicoes) for (const p of d.posicoes) {
      linhasPos.push(velas.createPriceLine({ price: p.preco, color: P.at, lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: p.lado + ' ' + fmt(p.lotes, 2) }))
      if (p.sl > 0) linhasPos.push(velas.createPriceLine({ price: p.sl, color: P.rt, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'stop' }))
      if (p.tp > 0) linhasPos.push(velas.createPriceLine({ price: p.tp, color: P.gt, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'TP' }))
    }
    n = d.velas.length
    // 25/10 («tás a abrir o gráfico de 1 s sempre assim, tem que ser maior»): ao arrastar a régua do preço a escala fica à mão,
    // e o 1 s abria com a dos 15 min (3 960 a 4 026, as velas numa risca). Cada gráfico abre com a escala automática
    if (nova) { mexeu = false; chart.priceScale('right').applyOptions({ autoScale: true }); ajustar() }
  }
  // o plano no gráfico: a entrada, o stop e os dois alvos (tracejados, com o nome no eixo)
  let linhasPlano = []
  function plano(p) {
    ultimoPlano = p
    for (const l of linhasPlano) velas.removePriceLine(l)
    linhasPlano = []
    if (!p) return
    for (const [preco, cor, titulo] of [[p.entrada, P.at, 'entrada'], [p.sl, P.rt, 'stop'], [p.tp1, P.gt, 'alvo 1'], [p.tp2, P.gt, 'alvo 2']])
      linhasPlano.push(velas.createPriceLine({ price: preco, color: cor, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: titulo }))
  }
  // 25/10 («vês estas linhas? faz algo deste tipo, com e sem linhas»): as linhas da grelha atrás das velas, ligadas ou não
  let comGrelha = true
  function grelha(on) { comGrelha = on; chart.applyOptions({ grid: { vertLines: { visible: on }, horzLines: { visible: on } } }) }
    // 24/10 (modo claro): troca a paleta, pinta de novo o que já está no gráfico e redesenha as caixas e as marcas
  function tema(nome) {
    P = CORES[nome === true ? 'branco' : nome] || CORES.escuro
    chart.applyOptions({ layout: { textColor: P.texto, panes: { separatorColor: P.borda } }, grid: { vertLines: { color: P.grelha, visible: comGrelha }, horzLines: { color: P.grelha, visible: comGrelha } },
      rightPriceScale: { borderColor: P.borda }, timeScale: { borderColor: P.borda },
      crosshair: { vertLine: { color: P.mira, labelBackgroundColor: P.etiqueta }, horzLine: { color: P.mira, labelBackgroundColor: P.etiqueta } } })
    velas.applyOptions({ upColor: P.vs, downColor: P.vd, borderUpColor: P.vs, borderDownColor: P.vd, wickUpColor: P.pu, wickDownColor: P.pd, priceLineColor: P.linhaPreco })
    verm.applyOptions({ color: R(.9) }); cinza.applyOptions({ color: C(.8) }); verde.applyOptions({ color: G(.9) }); ema.applyOptions({ color: A(.7) }); ema80.applyOptions({ color: A(.5) })
    for (const [k, sr] of linhasLT) sr.applyOptions({ color: k.endsWith('subida') ? G(.85) : R(.85) })
    if (estK) { estK.applyOptions({ color: P.at }); estD.applyOptions({ color: C(.8) }); for (const [l, f] of estLinhas) l.applyOptions({ color: f(.5) }) }
    if (ultimaVez) mostrar(...ultimaVez)
    plano(ultimoPlano)
  }
  // 25/10 («mete ai 1 segundo»): no gráfico de 1 s o preço de cada segundo acaba a última vela ou junta a seguinte, sem
  // refazer o resto (que se refaz com a análise). 25/10 («o gráfico de 15 min tem que mexer»): nos outros tempos o preço de
  // cada segundo acaba a vela de agora (máximo, mínimo e fecho) ou abre a seguinte. Devolve a hora da última vela
  function vivo(v) {
    const u = serieVelas.at(-1)
    if (!u || v.time < u.time) return null
    let w = v
    if (tfAtual !== '1s') {
      const dur = TFS[tfAtual], px = v.close
      w = v.time < u.time + dur ? { time: u.time, open: u.open, high: Math.max(u.high, px), low: Math.min(u.low, px), close: px }
        : { time: u.time + Math.floor((v.time - u.time) / dur) * dur, open: px, high: px, low: px, close: px }
    }
    velas.update(w)
    if (w.time > u.time) { n++; serieVelas.push(w) } else serieVelas[serieVelas.length - 1] = w
    return w.time
  }
  return { mostrar, plano, tema, grelha, vivo }
}
