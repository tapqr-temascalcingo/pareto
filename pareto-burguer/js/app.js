/* =========================================================================
   Pareto interactivo · Restaurante Burguer
   Todo se calcula a partir de window.RESPUESTAS (js/datos.js).
   No hay números escritos a mano.
   ========================================================================= */
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // CONFIGURACIÓN (lo único que cambiarías para otro análisis)
  // ---------------------------------------------------------------------
  const CONFIG = {
    unidad: { singular: 'caso', plural: 'casos' },
    campoCausa: 'causas',                       // lista; la 1.ª opción = causa principal
    excluir: ['No experimenté ningún problema'],// respuestas que NO entran al Pareto
    meta: 80,
    nombresCortos: {
      'Demora en la entrega de alimentos o bebidas': 'Demora en la entrega',
      'Errores en los pedidos entregados': 'Errores en pedidos',
      'Falta de atención por parte del personal': 'Falta de atención',
      'Cobros incorrectos en la cuenta': 'Cobros incorrectos',
    },
    // Filtros (uno por columna de categoría importante)
    filtros: [
      { campo: 'genero',       etiqueta: 'Género' },
      { campo: 'rangoEdad',    etiqueta: 'Edad' },
      { campo: 'ocupacion',    etiqueta: 'Ocupación' },
      { campo: 'dias',         etiqueta: 'Día de la visita', multi: true,
        orden: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] },
      { campo: 'horarios',     etiqueta: 'Horario de llegada', multi: true },
      { campo: 'espera',       etiqueta: 'Tiempo de espera',
        orden: ['Menos de 10 minutos', 'De 10 a 20 minutos', 'De 21 a 30 minutos', 'Más de 30 minutos', 'No recuerdo'] },
      { campo: 'calificacion', etiqueta: 'Calificación' },
    ],
    // Columnas para el detalle de cada causa
    detalle: [
      { campo: 'etapas',       titulo: 'Etapa con mayor retraso', multi: true },
      { campo: 'espera',       titulo: 'Tiempo de espera' },
      { campo: 'dias',         titulo: 'Día de la visita', multi: true },
      { campo: 'horarios',     titulo: 'Horario de llegada', multi: true },
      { campo: 'mejoras',      titulo: 'Qué piden mejorar', multi: true },
      { campo: 'frecuencia',   titulo: 'Frecuencia con que tienen problemas' },
      { campo: 'calificacion', titulo: 'Calificación del servicio' },
      { campo: 'ocupacion',    titulo: 'Ocupación' },
      { campo: 'rangoEdad',    titulo: 'Edad' },
    ],
  };

  const DATOS = Array.isArray(window.RESPUESTAS) ? window.RESPUESTAS : [];
  const estado = { filtros: {} };          // campo -> valor elegido
  const $ = (sel) => document.querySelector(sel);

  // ---------------------------------------------------------------------
  // UTILIDADES
  // ---------------------------------------------------------------------
  const r1 = (x) => Math.round(x * 10) / 10;
  const fmt1 = (x) => r1(x).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct = (parte, total) => (total ? (parte / total) * 100 : 0);
  const comparaTexto = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, u = CONFIG.unidad) => (n === 1 ? u.singular : u.plural);
  const valores = (reg, campo) => {
    const v = reg[campo];
    if (Array.isArray(v)) return v;
    return v === null || v === undefined || v === '' ? [] : [v];
  };
  const corto = (nombre, max = 22) => {
    if (CONFIG.nombresCortos[nombre]) return CONFIG.nombresCortos[nombre];
    return nombre.length > max ? nombre.slice(0, max - 1).trim() + '…' : nombre;
  };
  // ---------------------------------------------------------------------
  // COLORES (solo diseño). Cada causa tiene un color fijo según su nombre:
  // se asigna por el orden del Pareto SIN filtros, así no cambia al filtrar.
  // oscuro/medio: fondos para texto blanco (contraste AA). claro: degradado.
  // ---------------------------------------------------------------------
  const PALETA = [
    { c: '#2563EB', oscuro: '#1E3A8A', medio: '#1E40AF', claro: '#93C5FD', suave: '#EFF6FF' }, // azul
    { c: '#F97316', oscuro: '#9A3412', medio: '#C2410C', claro: '#FDBA74', suave: '#FFF7ED' }, // naranja
    { c: '#0D9488', oscuro: '#134E4A', medio: '#0F766E', claro: '#5EEAD4', suave: '#F0FDFA' }, // turquesa
    { c: '#16A34A', oscuro: '#14532D', medio: '#15803D', claro: '#86EFAC', suave: '#F0FDF4' }, // verde
    { c: '#EAB308', oscuro: '#713F12', medio: '#A16207', claro: '#FDE047', suave: '#FEFCE8' }, // amarillo
  ];
  let ordenColores = null;
  function colorDe(causa) {
    if (!ordenColores) ordenColores = calcularPareto(DATOS).filas.map((f) => f.causa);
    let i = ordenColores.indexOf(causa);
    if (i < 0) { ordenColores.push(causa); i = ordenColores.length - 1; }
    return PALETA[i % PALETA.length];
  }

  // Orden: mayor frecuencia primero; empates por orden alfabético
  const ordenarConteo = (pares) => pares.sort((a, b) => b[1] - a[1] || comparaTexto(a[0], b[0]));

  // ---------------------------------------------------------------------
  // CÁLCULO
  // ---------------------------------------------------------------------
  function aplicarFiltros(datos) {
    return datos.filter((reg) =>
      Object.entries(estado.filtros).every(([campo, valor]) => valores(reg, campo).includes(valor)));
  }

  function calcularPareto(regs) {
    const casos = [];
    let excluidos = 0;
    for (const reg of regs) {
      const lista = valores(reg, CONFIG.campoCausa);
      if (!lista.length || CONFIG.excluir.includes(lista[0])) { excluidos++; continue; }
      casos.push({ reg, principal: lista[0], secundarias: lista.slice(1).filter((c) => !CONFIG.excluir.includes(c)) });
    }
    const total = casos.length;
    const conteo = new Map();
    casos.forEach((c) => conteo.set(c.principal, (conteo.get(c.principal) || 0) + 1));

    let acum = 0;
    let vitalCerrado = false;
    const filas = ordenarConteo([...conteo.entries()]).map(([causa, n], i) => {
      acum += n;
      const acumPct = pct(acum, total);
      // Vital: todas las causas hasta la primera que alcanza o pasa la meta (inclusive)
      const vital = !vitalCerrado;
      if (acumPct >= CONFIG.meta - 1e-9) vitalCerrado = true;
      return { rango: i + 1, causa, corto: corto(causa), n, pct: pct(n, total), acum, acumPct, vital };
    });

    // Causas secundarias (se muestran aparte, NO se suman)
    const sec = new Map();
    casos.forEach((c) => c.secundarias.forEach((s) => sec.set(s, (sec.get(s) || 0) + 1)));

    return { casos, total, excluidos, respuestas: regs.length, filas, secundarias: ordenarConteo([...sec.entries()]) };
  }

  function verificar(p) {
    const suma = p.filas.reduce((s, f) => s + f.n, 0);
    const ultimo = p.filas.length ? p.filas[p.filas.length - 1].acumPct : 100;
    const checks = [
      { ok: suma === p.total, texto: `Suma de barras = ${suma} · total analizado = ${p.total}` },
      { ok: p.total === 0 || r1(ultimo) === 100, texto: `Último % acumulado = ${fmt1(ultimo)}%` },
      { ok: p.total + p.excluidos === p.respuestas, texto: `${p.total} analizados + ${p.excluidos} excluidos = ${p.respuestas} respuestas` },
    ];
    checks.forEach((c) => { if (!c.ok) console.error('[Pareto] No cuadra:', c.texto); });
    return checks;
  }

  // ---------------------------------------------------------------------
  // FILTROS
  // ---------------------------------------------------------------------
  function opcionesDe(f) {
    const conteo = new Map();
    DATOS.forEach((r) => valores(r, f.campo).forEach((v) => conteo.set(v, (conteo.get(v) || 0) + 1)));
    const claves = [...conteo.keys()];
    if (f.orden) {
      claves.sort((a, b) => {
        const ia = f.orden.indexOf(a), ib = f.orden.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || comparaTexto(a, b);
      });
    } else claves.sort(comparaTexto);
    return claves.map((k) => [k, conteo.get(k)]);
  }

  function construirFiltros() {
    const cont = $('#filtros');
    cont.innerHTML = CONFIG.filtros.map((f, i) => `
      <div class="filtro">
        <label for="f${i}">${esc(f.etiqueta)}</label>
        <select id="f${i}" data-campo="${f.campo}">
          <option value="">Todas</option>
          ${opcionesDe(f).map(([v, n]) => `<option value="${esc(v)}">${esc(v)} (${n})</option>`).join('')}
        </select>
      </div>`).join('');
    cont.querySelectorAll('select').forEach((sel) => sel.addEventListener('change', () => {
      if (sel.value) estado.filtros[sel.dataset.campo] = sel.value;
      else delete estado.filtros[sel.dataset.campo];
      actualizar();
    }));
    $('#btnLimpiar').addEventListener('click', () => { estado.filtros = {}; actualizar(); });
  }

  function pintarEstadoFiltros() {
    const activos = Object.entries(estado.filtros);
    document.querySelectorAll('#filtros select').forEach((sel) => {
      sel.value = estado.filtros[sel.dataset.campo] || '';
      sel.classList.toggle('activo', !!sel.value);
    });
    $('#btnLimpiar').hidden = !activos.length;
    const caja = $('#estadoFiltro');
    if (!activos.length) { caja.innerHTML = 'Mostrando <strong>&nbsp;todas las respuestas&nbsp;</strong> (sin filtros).'; return; }
    caja.innerHTML = `<span class="badge-filtro">⚠ Filtro activo</span>` + activos.map(([campo, v]) => {
      const f = CONFIG.filtros.find((x) => x.campo === campo);
      return `<span class="chip">${esc(f.etiqueta)}: ${esc(v)} <button type="button" data-quitar="${campo}" aria-label="Quitar filtro ${esc(f.etiqueta)}">✕</button></span>`;
    }).join('');
    caja.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', () => {
      delete estado.filtros[b.dataset.quitar]; actualizar();
    }));
  }

  function textoFiltros() {
    const activos = Object.entries(estado.filtros);
    if (!activos.length) return '';
    return activos.map(([c, v]) => `${CONFIG.filtros.find((x) => x.campo === c).etiqueta.toLowerCase()}: ${v}`).join('; ');
  }

  // ---------------------------------------------------------------------
  // TARJETAS
  // ---------------------------------------------------------------------
  function pintarTarjetas(p) {
    const vitales = p.filas.filter((f) => f.vital);
    const top = p.filas[0];
    const sumaVital = vitales.length ? vitales[vitales.length - 1].acumPct : 0;
    $('#tarjetas').innerHTML = `
      <article class="tarjeta">
        <div class="tarjeta__icono" aria-hidden="true">📋</div>
        <div class="tarjeta__etq">Total analizado</div>
        <div class="tarjeta__valor">${p.total} <small>${plural(p.total)}</small></div>
        <div class="tarjeta__sub">de ${p.respuestas} respuestas · ${p.excluidos} sin problema (excluidas)</div>
      </article>
      <article class="tarjeta tarjeta--naranja">
        <div class="tarjeta__icono" aria-hidden="true">🥇</div>
        <div class="tarjeta__etq">Causa N.° 1</div>
        <div class="tarjeta__valor">${top ? fmt1(top.pct) + '%' : '—'}</div>
        <div class="tarjeta__sub" title="${top ? esc(top.causa) : ''}">${top ? esc(top.causa) + ` (${top.n} ${plural(top.n)})` : 'Sin casos'}</div>
      </article>
      <article class="tarjeta tarjeta--turquesa">
        <div class="tarjeta__icono" aria-hidden="true">🎯</div>
        <div class="tarjeta__etq">Causas que explican el ${CONFIG.meta}%</div>
        <div class="tarjeta__valor">${vitales.length} <small>de ${p.filas.length}</small></div>
        <div class="tarjeta__sub">${vitales.length ? vitales.map((v) => esc(v.corto)).join(', ') : '—'}</div>
      </article>
      <article class="tarjeta tarjeta--verde">
        <div class="tarjeta__icono" aria-hidden="true">📊</div>
        <div class="tarjeta__etq">Suman las causas vitales</div>
        <div class="tarjeta__valor">${p.total ? fmt1(sumaVital) + '%' : '—'}</div>
        <div class="tarjeta__sub">${vitales.reduce((s, v) => s + v.n, 0)} de ${p.total} ${plural(p.total)}</div>
      </article>`;
  }

  // ---------------------------------------------------------------------
  // GRÁFICA (SVG hecho a mano)
  // ---------------------------------------------------------------------
  const tooltip = $('#tooltip');
  function mostrarTooltip(html, x, y) {
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const r = tooltip.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
    tooltip.style.left = Math.max(8, left) + 'px';
    tooltip.style.top = Math.max(8, top) + 'px';
  }
  const ocultarTooltip = () => { tooltip.hidden = true; };
  const htmlTooltip = (f, total) => `
    <strong><span class="punto" style="background:${colorDe(f.causa).c}"></span>${esc(f.causa)}</strong>
    <div class="fila"><span>Frecuencia</span><span>${f.n} de ${total}</span></div>
    <div class="fila"><span>% del total</span><span>${fmt1(f.pct)}%</span></div>
    <div class="fila"><span>% acumulado</span><span>${fmt1(f.acumPct)}%</span></div>
    <div class="fila"><span>Tipo</span><span>${f.vital ? 'Vital' : 'Trivial'}</span></div>
    <div style="opacity:.7;margin-top:.3rem">Clic para ver el detalle</div>`;

  function pasoBonito(max, objetivo = 5) {
    const bruto = Math.max(1, max / objetivo);
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const n = bruto / mag;
    const paso = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
    return Math.max(1, Math.round(paso));
  }

  function partirEtiqueta(txt, max) {
    const palabras = txt.split(' ');
    const lineas = [];
    let actual = '';
    palabras.forEach((p) => {
      if ((actual + ' ' + p).trim().length > max && actual) { lineas.push(actual); actual = p; }
      else actual = (actual + ' ' + p).trim();
    });
    if (actual) lineas.push(actual);
    return lineas.slice(0, 3);
  }

  function dibujarGrafica(p, animar = false) {
    const cont = $('#grafica');
    ocultarTooltip();
    cont.classList.toggle('animar', !!animar);
    if (!p.total) {
      cont.innerHTML = `<div class="vacio">No hay ${CONFIG.unidad.plural} con los filtros seleccionados.<br>Prueba quitando algún filtro.</div>`;
      return;
    }
    const proyector = document.body.classList.contains('proyector');
    const W = Math.max(320, cont.clientWidth);
    const movil = W < 560;
    const esc1 = (proyector ? 1.25 : 1) * (movil ? 0.9 : 1);
    const fs = (n) => Math.round(n * esc1);
    const H = movil ? 380 : proyector ? 520 : 460;
    const m = { t: 34, r: movil ? 46 : 60, b: fs(movil ? 64 : 74), l: movil ? 40 : 56 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const n = p.filas.length;
    const banda = pw / n;
    const anchoBarra = Math.min(banda * 0.64, 170);
    // El eje izquierdo llega al total: así una barra y el % acumulado comparten escala
    const y = (v) => m.t + ph - (v / p.total) * ph;
    const yp = (v) => m.t + ph - (v / 100) * ph;
    const cx = (i) => m.l + banda * i + banda / 2;

    const paso = pasoBonito(p.total, movil ? 4 : 5);
    let ejeIzq = '';
    for (let v = 0; v <= p.total; v += paso) {
      ejeIzq += `<line x1="${m.l}" x2="${m.l + pw}" y1="${y(v)}" y2="${y(v)}" stroke="#eceef4" />
        <text x="${m.l - 10}" y="${y(v) + 4}" text-anchor="end" font-size="${fs(13)}" fill="#5B677A">${v}</text>`;
    }
    let ejeDer = '';
    for (let v = 0; v <= 100; v += 20) {
      ejeDer += `<line x1="${m.l + pw}" x2="${m.l + pw + 5}" y1="${yp(v)}" y2="${yp(v)}" stroke="#9ca3af" />
        <text x="${m.l + pw + 9}" y="${yp(v) + 4}" font-size="${fs(13)}" fill="${v === CONFIG.meta ? '#0F172A' : '#5B677A'}" font-weight="${v === CONFIG.meta ? 700 : 400}">${v}%</text>`;
    }

    const nVital = p.filas.filter((f) => f.vital).length;
    const defs = [`<linearGradient id="gLinea" gradientUnits="userSpaceOnUse" x1="${m.l}" y1="0" x2="${m.l + pw}" y2="0">
        <stop offset="0" stop-color="#2563EB"/><stop offset="1" stop-color="#0D9488"/></linearGradient>`];

    const barras = p.filas.map((f, i) => {
      const col = colorDe(f.causa);
      const x = cx(i) - anchoBarra / 2;
      const yTop = y(f.n);
      const h = Math.max(1, m.t + ph - yTop);
      const adentro = h > fs(56);
      const lblY1 = adentro ? yTop + fs(24) : yTop - fs(26);
      const lblY2 = adentro ? yTop + fs(44) : yTop - fs(9);
      const r = Math.min(6, anchoBarra / 4, h);
      // Barra con esquinas superiores redondeadas, anclada a la base
      const d = `M${x},${m.t + ph} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + anchoBarra - r} Q${x + anchoBarra},${yTop} ${x + anchoBarra},${yTop + r} V${m.t + ph} Z`;
      let forma;
      if (f.vital) {
        // Vital: degradado vertical (claro arriba, intenso abajo) + sombra suave del mismo color
        defs.push(`<linearGradient id="gB${i}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${col.claro}"/><stop offset=".55" stop-color="${col.c}"/><stop offset="1" stop-color="${col.medio}"/></linearGradient>
          <filter id="sB${i}" x="-50%" y="-20%" width="200%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="${col.c}" flood-opacity=".38"/></filter>`);
        forma = `<path class="forma" d="${d}" fill="url(#gB${i})" filter="url(#sB${i})"/>`;
      } else {
        // Trivial: mismo color en pastel translúcido con borde punteado
        forma = `<path class="forma" d="${d}" fill="${col.c}" fill-opacity=".35" stroke="${col.c}" stroke-width="1.5" stroke-dasharray="4 3" stroke-linejoin="round"/>`;
      }
      // Números: blanco sobre píldora del tono oscuro (AA) en vitales; tinta oscura en pastel o fuera de la barra
      let etiquetas;
      if (adentro && f.vital) {
        const tN = String(f.n), tP = fmt1(f.pct) + '%';
        const pillW = Math.min(Math.max(tN.length * fs(18) * 0.64, tP.length * fs(13) * 0.6) + fs(18), Math.max(anchoBarra - 8, fs(52)));
        etiquetas = `<rect x="${cx(i) - pillW / 2}" y="${yTop + fs(6)}" width="${pillW}" height="${fs(45)}" rx="${fs(10)}" fill="${col.oscuro}"/>
          <text x="${cx(i)}" y="${lblY1}" text-anchor="middle" font-size="${fs(18)}" font-weight="800" fill="#ffffff">${tN}</text>
          <text x="${cx(i)}" y="${lblY2}" text-anchor="middle" font-size="${fs(13)}" font-weight="600" fill="#ffffff">${tP}</text>`;
      } else {
        etiquetas = `<text x="${cx(i)}" y="${lblY1}" text-anchor="middle" font-size="${fs(18)}" font-weight="800" fill="#0F172A">${f.n}</text>
          <text x="${cx(i)}" y="${lblY2}" text-anchor="middle" font-size="${fs(13)}" font-weight="600" fill="#334155">${fmt1(f.pct)}%</text>`;
      }
      const lineas = partirEtiqueta(f.corto, movil ? 11 : 16);
      const etiquetaX = lineas.map((l, k) => `<tspan x="${cx(i)}" dy="${k === 0 ? 0 : fs(16)}">${esc(l)}</tspan>`).join('');
      return `
        <g class="barra ${f.vital ? 'barra--vital' : 'barra--trivial'}" tabindex="0" role="button" data-i="${i}" style="--d:${i * 90}ms"
           aria-label="${esc(f.causa)}: ${f.n} ${plural(f.n)}, ${fmt1(f.pct)} por ciento, acumulado ${fmt1(f.acumPct)} por ciento. Abrir detalle.">
          <rect x="${m.l + banda * i}" y="${m.t}" width="${banda}" height="${ph + m.b}" fill="transparent" class="foco" rx="8"/>
          <g class="lift">
            ${forma}
            <g class="etq">${etiquetas}</g>
          </g>
          <text x="${cx(i)}" y="${m.t + ph + fs(22)}" text-anchor="middle" font-size="${fs(13.5)}" fill="#0F172A" font-weight="${f.vital ? 700 : 500}">${etiquetaX}</text>
        </g>`;
    }).join('');

    // Zona de fondo detrás de las causas vitales
    const zona = nVital ? `
        <rect x="${m.l}" y="${m.t - fs(26)}" width="${banda * nVital}" height="${ph + fs(26)}" rx="10" fill="#2563EB" fill-opacity=".06"/>
        <text class="zona-txt" x="${m.l + 8}" y="${m.t - fs(9)}" font-size="${fs(12)}" font-weight="700" fill="#1E3A8A">Pocas causas vitales</text>` : '';

    // Línea de % acumulado: degradado azul → turquesa, se dibuja de izquierda a derecha
    const puntos = p.filas.map((f, i) => [cx(i), yp(f.acumPct)]);
    const largo = Math.ceil(puntos.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - puntos[i - 1][0], q[1] - puntos[i - 1][1]) : 0), 0)) + 2;
    const ptsTxt = puntos.map((q) => q.join(',')).join(' ');
    const trazo = `style="stroke-dasharray:${largo};--len:${largo}"`;
    const linea = `<g pointer-events="none">
        <polyline class="linea-halo" points="${ptsTxt}" fill="none" stroke="#ffffff" stroke-opacity=".9" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" ${trazo}/>
        <polyline class="linea" points="${ptsTxt}" fill="none" stroke="url(#gLinea)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" ${trazo}/>
      </g>`;
    const marcas = p.filas.map((f, i) => `
      <circle cx="${puntos[i][0]}" cy="${puntos[i][1]}" r="${fs(6)}" fill="#ffffff" stroke="url(#gLinea)" stroke-width="2.5" class="pto" data-i="${i}"/>
      <text x="${puntos[i][0] + fs(9)}" y="${puntos[i][1] - fs(9)}" font-size="${fs(12.5)}" font-weight="700" fill="#1E3A8A" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${fmt1(f.acumPct)}%</text>`).join('');

    // Línea de la meta (80%) con etiqueta tipo píldora
    const yM = yp(CONFIG.meta);
    const txtMeta = `Meta ${CONFIG.meta}%`;
    const metaW = txtMeta.length * fs(12) * 0.62 + fs(20), metaH = fs(22);
    const meta = `<line x1="${m.l}" x2="${m.l + pw}" y1="${yM}" y2="${yM}" stroke="#F43F5E" stroke-width="2" stroke-dasharray="7 6"/>`;
    const metaPill = `<g class="meta-pill" pointer-events="none">
        <rect x="${m.l + pw - metaW - 6}" y="${yM - metaH / 2}" width="${metaW}" height="${metaH}" rx="${metaH / 2}" fill="#FFF1F2" stroke="#F43F5E" stroke-width="1.5"/>
        <text x="${m.l + pw - 6 - metaW / 2}" y="${yM + fs(4.3)}" text-anchor="middle" font-size="${fs(12)}" font-weight="700" fill="#BE123C">${txtMeta}</text>
      </g>`;

    cont.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
           aria-label="Diagrama de Pareto con ${n} causas. Detalle en la tabla de datos.">
        <defs>${defs.join('')}</defs>
        ${zona}
        ${ejeIzq}
        <line x1="${m.l}" x2="${m.l + pw}" y1="${m.t + ph}" y2="${m.t + ph}" stroke="#9ca3af"/>
        <line x1="${m.l + pw}" x2="${m.l + pw}" y1="${m.t}" y2="${m.t + ph}" stroke="#d1d5db"/>
        ${ejeDer}
        <text x="${m.l - 10}" y="${m.t - 14}" text-anchor="end" font-size="${fs(12)}" fill="#5B677A">${CONFIG.unidad.plural}</text>
        <text x="${m.l + pw + 9}" y="${m.t - 14}" font-size="${fs(12)}" fill="#5B677A">% acum.</text>
        ${meta}
        ${barras}
        ${linea}
        <g class="marcas" pointer-events="none">${marcas}</g>
        ${metaPill}
      </svg>`;

    cont.querySelectorAll('.barra').forEach((g) => {
      const f = p.filas[+g.dataset.i];
      g.addEventListener('mousemove', (e) => mostrarTooltip(htmlTooltip(f, p.total), e.clientX, e.clientY));
      g.addEventListener('mouseleave', ocultarTooltip);
      g.addEventListener('focus', () => { const b = g.getBoundingClientRect(); mostrarTooltip(htmlTooltip(f, p.total), b.left + b.width / 2, b.top + 40); });
      g.addEventListener('blur', ocultarTooltip);
      g.addEventListener('click', () => { ocultarTooltip(); abrirDetalle(f.causa); });
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalle(f.causa); } });
    });
  }

  function pintarVerificacion(p) {
    $('#verificacion').innerHTML = verificar(p)
      .map((c) => `<span class="${c.ok ? 'ok' : 'error'}">${c.ok ? '✔' : '✖ No cuadra:'} ${esc(c.texto)}</span>`).join('');
  }

  // ---------------------------------------------------------------------
  // TABLA Y SECUNDARIAS
  // ---------------------------------------------------------------------
  function pintarTabla(p) {
    const t = $('#tabla');
    if (!p.total) { t.innerHTML = '<tbody><tr><td class="vacio">Sin datos con estos filtros.</td></tr></tbody>'; return; }
    t.innerHTML = `
      <thead><tr><th>#</th><th>Causa</th><th>Frecuencia</th><th>%</th><th>% acumulado</th></tr></thead>
      <tbody>${p.filas.map((f) => `
        <tr data-causa="${esc(f.causa)}" tabindex="0" title="Ver detalle">
          <td>${f.rango}</td>
          <td><span class="punto" style="${f.vital ? `background:${colorDe(f.causa).c}` : `background:${colorDe(f.causa).c}59;border:1.5px dashed ${colorDe(f.causa).c}`}"></span>${esc(f.causa)}${f.vital ? ' <small style="color:var(--vital);font-weight:700">· vital</small>' : ''}</td>
          <td>${f.n}</td><td>${fmt1(f.pct)}%</td><td>${fmt1(f.acumPct)}%</td>
        </tr>`).join('')}</tbody>
      <tfoot><tr><td></td><td>Total</td><td>${p.filas.reduce((s, f) => s + f.n, 0)}</td><td>${fmt1(p.filas.reduce((s, f) => s + f.pct, 0))}%</td><td></td></tr></tfoot>`;
    t.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', () => abrirDetalle(tr.dataset.causa));
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirDetalle(tr.dataset.causa); });
    });
  }

  // Lista con barras: 4 categorías más altas + "Otros (n categorías)"
  function listaBarras(regs, campo, base, top = 4) {
    const conteo = new Map();
    regs.forEach((r) => new Set(valores(r, campo)).forEach((v) => conteo.set(v, (conteo.get(v) || 0) + 1)));
    const orden = ordenarConteo([...conteo.entries()]);
    let filas = orden.slice(0, top).map(([k, n]) => ({ k, n }));
    const resto = orden.slice(top);
    if (resto.length) {
      const claves = new Set(resto.map(([k]) => k));
      // Personas (no menciones) que caen en alguna de las categorías agrupadas
      const nOtros = regs.filter((r) => valores(r, campo).some((v) => claves.has(v))).length;
      filas.push({ k: `Otros (${resto.length} ${resto.length === 1 ? 'categoría' : 'categorías'})`, n: nOtros, otros: true, titulo: resto.map(([k, n]) => `${k}: ${n}`).join(' · ') });
    }
    if (!filas.length) return '<p class="nota">Sin datos.</p>';
    return `<ul class="lista">${filas.map((f) => `
      <li class="${f.otros ? 'otros' : ''}" title="${esc(f.titulo || f.k)}: ${f.n} de ${base} (${fmt1(pct(f.n, base))}%)">
        <span class="nombre">${esc(f.k)}</span><span class="valor">${f.n} · ${fmt1(pct(f.n, base))}%</span>
        <span class="pista"><span class="relleno" style="width:${pct(f.n, base)}%"></span></span>
      </li>`).join('')}</ul>`;
  }

  function pintarSecundarias(p) {
    const cont = $('#secundarias');
    if (!p.secundarias.length) { cont.innerHTML = '<p class="nota">Nadie marcó causas adicionales con estos filtros.</p>'; return; }
    const conSec = p.casos.filter((c) => c.secundarias.length).length;
    cont.innerHTML = `<p style="margin:.6rem 0 0"><strong>${conSec}</strong> de ${p.total} ${plural(p.total)} (${fmt1(pct(conSec, p.total))}%) marcaron más de un problema.</p>
      <ul class="lista">${p.secundarias.map(([k, n]) => `
        <li title="${esc(k)}"><span class="nombre">${esc(k)}</span><span class="valor">${n} · ${fmt1(pct(n, p.total))}%</span>
        <span class="pista"><span class="relleno" style="width:${pct(n, p.total)}%;background:#0D9488"></span></span></li>`).join('')}</ul>
      <p class="nota">% calculado sobre los ${p.total} ${plural(p.total)} analizados.</p>`;
  }

  // ---------------------------------------------------------------------
  // INDICADORES DE CADA CAUSA
  // ---------------------------------------------------------------------
  const ESPERA_LARGA = ['De 21 a 30 minutos', 'Más de 30 minutos'];
  const FRECUENTE = ['Algunas veces', 'Casi siempre', 'Siempre'];
  function indicadores(regs) {
    const n = regs.length;
    const cal = regs.map((r) => r.calNum).filter((v) => typeof v === 'number');
    return {
      calProm: cal.length ? cal.reduce((a, b) => a + b, 0) / cal.length : null,
      malas: regs.filter((r) => r.calNum !== null && r.calNum <= 2).length,
      esperaLarga: regs.filter((r) => ESPERA_LARGA.includes(r.espera)).length,
      frecuente: regs.filter((r) => FRECUENTE.includes(r.frecuencia)).length,
      n,
    };
  }

  // ---------------------------------------------------------------------
  // DETALLE (modal)
  // ---------------------------------------------------------------------
  const dialogo = $('#detalle');
  let ultimoPareto = null;

  function abrirDetalle(causa) {
    const p = ultimoPareto;
    const fila = p.filas.find((f) => f.causa === causa);
    if (!fila) return;
    const casos = p.casos.filter((c) => c.principal === causa);
    const regs = casos.map((c) => c.reg);
    const ind = indicadores(regs);
    const conSec = casos.filter((c) => c.secundarias.length).length;
    const filtro = textoFiltros();

    $('#dEyebrow').textContent = `Causa N.° ${fila.rango} · ${fila.vital ? 'vital' : 'trivial'}${filtro ? ' · Filtro: ' + filtro : ''}`;
    $('#dTitulo').textContent = causa;
    const col = colorDe(causa);
    dialogo.style.setProperty('--causa', col.c);
    dialogo.style.setProperty('--causa-oscuro', col.oscuro);
    dialogo.style.setProperty('--causa-medio', col.medio);
    dialogo.style.setProperty('--causa-claro', col.claro);
    dialogo.style.setProperty('--causa-suave', col.suave);

    const mini = (valor, etq) => `<div class="mini"><div class="mini__valor">${valor}</div><div class="mini__etq">${etq}</div></div>`;
    const secTxt = (() => {
      const sec = new Map();
      casos.forEach((c) => c.secundarias.forEach((s) => sec.set(s, (sec.get(s) || 0) + 1)));
      return ordenarConteo([...sec.entries()]);
    })();

    $('#dCuerpo').innerHTML = `
      <div class="mini-tarjetas">
        ${mini(fila.n, `${plural(fila.n)} (causa principal)`)}
        ${mini(fmt1(fila.pct) + '%', `del total analizado (${p.total})`)}
        ${mini(ind.calProm === null ? '—' : fmt1(ind.calProm) + '<small style="font-size:.9rem;color:var(--tinta-2)"> / 5</small>', 'calificación promedio')}
        ${mini(fmt1(pct(ind.malas, ind.n)) + '%', `calificó “Mala” o “Muy mala” (${ind.malas})`)}
        ${mini(fmt1(pct(ind.esperaLarga, ind.n)) + '%', `esperó más de 20 min (${ind.esperaLarga})`)}
        ${mini(fmt1(pct(ind.frecuente, ind.n)) + '%', `tiene problemas “algunas veces” o más (${ind.frecuente})`)}
      </div>
      <div class="detalle-grid">
        ${CONFIG.detalle.map((d) => `
          <div class="bloque">
            <h3>${esc(d.titulo)}</h3>
            ${d.multi ? '<p class="nota">Opción múltiple: puede sumar más de 100%</p>' : ''}
            ${listaBarras(regs, d.campo, ind.n)}
          </div>`).join('')}
        <div class="bloque">
          <h3>También marcaron (secundarias)</h3>
          <p class="nota">${conSec} de ${ind.n} marcaron otro problema; no se suma al Pareto</p>
          ${secTxt.length ? `<ul class="lista">${secTxt.map(([k, n]) => `
            <li title="${esc(k)}"><span class="nombre">${esc(k)}</span><span class="valor">${n} · ${fmt1(pct(n, ind.n))}%</span>
            <span class="pista"><span class="relleno" style="width:${pct(n, ind.n)}%"></span></span></li>`).join('')}</ul>` : '<p class="nota">Ninguno.</p>'}
        </div>
      </div>`;

    if (typeof dialogo.showModal === 'function') { if (!dialogo.open) dialogo.showModal(); }
    else dialogo.setAttribute('open', '');
    dialogo.scrollTop = 0;
  }
  $('#dCerrar').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); }); // clic fuera

  // ---------------------------------------------------------------------
  // INTERPRETACIÓN AUTOMÁTICA
  // ---------------------------------------------------------------------
  function masComun(regs, campo, excluir = []) {
    const conteo = new Map();
    regs.forEach((r) => new Set(valores(r, campo)).forEach((v) => { if (!excluir.includes(v)) conteo.set(v, (conteo.get(v) || 0) + 1); }));
    const o = ordenarConteo([...conteo.entries()]);
    return o.length ? { k: o[0][0], n: o[0][1] } : null;
  }

  function pintarInterpretacion(p) {
    const caja = $('#interpretacion');
    const filtro = textoFiltros();
    if (!p.total) {
      caja.innerHTML = `<p>Con el filtro <strong>${esc(filtro)}</strong> no hay ${CONFIG.unidad.plural} que reportaran un problema, así que no hay Pareto que interpretar.</p>`;
      return;
    }
    const vitales = p.filas.filter((f) => f.vital);
    const top = p.filas[0];
    const sumaVital = vitales[vitales.length - 1].acumPct;
    const regsTop = p.casos.filter((c) => c.principal === top.causa).map((c) => c.reg);
    const etapa = masComun(regsTop, 'etapas', ['No experimenté retrasos']);
    const mejora = masComun(regsTop, 'mejoras', ['Ninguno, el servicio fue adecuado']);
    const indTop = indicadores(regsTop);
    const nombres = vitales.map((v) => `«${esc(v.causa.toLowerCase())}»`);
    const lista = nombres.length > 1 ? nombres.slice(0, -1).join(', ') + ' y ' + nombres.slice(-1) : nombres[0];

    const ps = [];
    ps.push(`${filtro ? `Con el filtro <strong>${esc(filtro)}</strong> se` : 'Se'} analizaron <strong>${p.total} ${plural(p.total)}</strong> de clientes que reportaron un problema (${p.excluidos} ${p.excluidos === 1 ? 'respuesta dijo' : 'respuestas dijeron'} que no tuvieron ninguno).`);
    ps.push(vitales.length === 1
      ? `<strong>Una sola causa explica el ${fmt1(sumaVital)}% de los ${CONFIG.unidad.plural}</strong> (de ${p.filas.length} causas distintas).`
      : `<strong>${vitales.length} de ${p.filas.length} causas explican el ${fmt1(sumaVital)}% de los ${CONFIG.unidad.plural}</strong>.`);
    ps.push(`La N.° 1 es <strong>${esc(top.causa.toLowerCase())}</strong> con <strong>${fmt1(top.pct)}%</strong> (${top.n} ${plural(top.n)}).` +
      (p.filas[1] ? ` Le sigue ${esc(p.filas[1].causa.toLowerCase())} con ${fmt1(p.filas[1].pct)}%.` : ''));
    ps.push(`Por eso conviene <strong>atacar primero ${lista}</strong>: resolver ${vitales.length === 1 ? 'esa causa' : 'esas causas'} eliminaría la mayor parte de los problemas con el menor esfuerzo.`);
    const pistas = [];
    if (etapa) pistas.push(`el retraso se siente sobre todo <strong>${esc(etapa.k.toLowerCase())}</strong> (${fmt1(pct(etapa.n, regsTop.length))}%)`);
    if (indTop.n) pistas.push(`<strong>${fmt1(pct(indTop.esperaLarga, indTop.n))}%</strong> esperó más de 20 minutos`);
    if (mejora) pistas.push(`lo que más piden mejorar es <strong>${esc(mejora.k.toLowerCase())}</strong> (${fmt1(pct(mejora.n, regsTop.length))}%)`);
    if (pistas.length) ps.push(`Dentro de la causa N.° 1, ${pistas.join('; ')}.`);
    if (p.filas.length >= 4 && vitales.length / p.filas.length > 0.5)
      ps.push('Ojo: los problemas están bastante repartidos; aquí no se cumple tan claro la regla 80/20.');
    if (p.total < 10)
      ps.push(`⚠ Con solo ${p.total} ${plural(p.total)} las conclusiones son poco confiables; tómalas como pista, no como prueba.`);
    caja.innerHTML = ps.map((t) => `<p>${t}</p>`).join('');
  }

  // ---------------------------------------------------------------------
  // CICLO PRINCIPAL
  // ---------------------------------------------------------------------
  function actualizar() {
    const regs = aplicarFiltros(DATOS);
    const p = calcularPareto(regs);
    ultimoPareto = p;
    pintarEstadoFiltros();
    pintarTarjetas(p);
    dibujarGrafica(p, true);
    pintarVerificacion(p);
    pintarInterpretacion(p);
    pintarTabla(p);
    pintarSecundarias(p);
    if (dialogo.open) dialogo.close();
  }

  $('#btnProyector').addEventListener('click', (e) => {
    const on = document.body.classList.toggle('proyector');
    e.currentTarget.setAttribute('aria-pressed', String(on));
    dibujarGrafica(ultimoPareto);
  });
  let tRes;
  window.addEventListener('resize', () => { clearTimeout(tRes); tRes = setTimeout(() => dibujarGrafica(ultimoPareto), 120); });

  if (!DATOS.length) {
    document.querySelector('main').innerHTML = '<section class="panel"><p>No se encontraron datos. Revisa que <code>js/datos.js</code> esté junto a este archivo.</p></section>';
    return;
  }
  construirFiltros();
  actualizar();
})();
