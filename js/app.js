/* =========================================================
   INTERFAZ
   Pantallas, formularios y navegación. Cuatro vistas:
   Inicio · Productos · Recetas · Eventos (con presupuesto).
   ========================================================= */
(() => {
  'use strict';

  const C = Conversion;
  const $app = document.getElementById('app');
  const $nav = document.getElementById('nav');
  const $capa = document.getElementById('capa');
  const $capa2 = document.getElementById('capa2');
  const $toast = document.getElementById('toast');

  /* ---------- estado ---------- */
  let vista = 'inicio';
  let eventoAbierto = null;      // id del evento cuyo presupuesto se muestra
  let filtroProductos = '';
  let filtroPicker = '';

  let bProducto = null;          // borradores de formularios
  let bReceta = null;
  let bEvento = null;
  let productoAlGuardar = null;  // callback cuando se crea un producto desde una receta

  let capaAcciones = {};
  let capaInput = null;
  let capa2Acciones = {};

  const EMOJIS = ['🥪', '🍕', '🥤', '☕', '🍰', '🥗', '🍗', '🍤', '🧁', '🥟', '🌮', '🍹', '🍞', '🍩', '🍽️'];
  const FORMATO_EMOJI = {
    paquete: '📦', bolsa: '🛍️', caja: '📦', botella: '🧃', bandeja: '🍱',
    frasco: '🫙', pote: '🥣', lata: '🥫', unidad: '🍰', rollo: '🧻', sobre: '✉️', malla: '🧺',
  };

  /* ---------- utilidades ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const normaliza = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const emojiFormato = f => FORMATO_EMOJI[f] || '📦';

  function plural(palabra, n) {
    if (n === 1) return palabra;
    return /[aeiouáéíóú]$/i.test(palabra) ? palabra + 's' : palabra + 'es';
  }

  const unidadBase = familia => (familia === 'peso' ? 'g' : familia === 'volumen' ? 'ml' : 'un');

  function contenidoTexto(p) {
    const sufijo = p.unidad === 'un'
      ? (p.contenido === 1 ? 'unidad' : 'unidades')
      : C.UNIDADES[p.unidad].corto;
    return C.numero(p.contenido) + ' ' + sufijo;
  }

  function descripcionFormato(p) {
    return p.formato === 'unidad' ? 'trae ' + contenidoTexto(p) : esc(p.formato) + ' de ' + contenidoTexto(p);
  }

  function fechaLegible(iso) {
    if (!iso) return 'Sin fecha';
    const partes = iso.split('-').map(Number);
    if (partes.length !== 3 || partes.some(isNaN)) return iso;
    const f = new Date(partes[0], partes[1] - 1, partes[2]);
    const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
    if (partes[0] !== new Date().getFullYear()) opciones.year = 'numeric';
    const texto = f.toLocaleDateString('es-CL', opciones);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  let toastTimer = null;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('visible'), 2400);
  }

  /* ---------- tema claro / oscuro ---------- */
  const TEMA_CLAVE = 'calculadora-chef-tema';

  function aplicarTema(tema) {
    document.documentElement.dataset.tema = tema;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = tema === 'oscuro' ? '#1F1912' : '#FDF6EE';
  }

  function temaInicial() {
    try {
      const guardado = localStorage.getItem(TEMA_CLAVE);
      if (guardado === 'oscuro' || guardado === 'claro') return guardado;
    } catch (e) { /* sin almacenamiento */ }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  }

  function alternarTema() {
    const nuevo = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
    aplicarTema(nuevo);
    try { localStorage.setItem(TEMA_CLAVE, nuevo); } catch (e) { /* sin almacenamiento */ }
    render();
  }

  /* ---------- capas ---------- */
  function abrirPanel(html) {
    capaAcciones = {};
    capaInput = null;
    $capa.innerHTML = '<div class="fondo-capa"></div><section class="panel">' + html + '</section>';
    $capa.classList.add('visible');
    document.body.classList.add('sin-scroll');
  }

  function cerrarCapa() {
    $capa.classList.remove('visible');
    $capa.innerHTML = '';
    capaAcciones = {};
    capaInput = null;
    document.body.classList.remove('sin-scroll');
  }

  function cerrarCapa2() {
    $capa2.classList.remove('visible');
    $capa2.innerHTML = '';
    capa2Acciones = {};
  }

  /* Diálogo de confirmación (título y detalle ya escapados por quien llama) */
  function confirmar({ titulo, detalle, textoOk = '🗑️ Sí, eliminar', alOk }) {
    $capa2.innerHTML = `
      <div class="fondo-capa" data-accion="c2-cerrar"></div>
      <section class="hoja">
        <h3>${titulo}</h3>
        ${detalle ? `<p>${detalle}</p>` : ''}
        <button class="boton-peligro" data-accion="confirm-ok">${textoOk}</button>
        <div class="separador" style="height:10px"></div>
        <button class="boton-suave" data-accion="c2-cerrar">Cancelar</button>
      </section>`;
    $capa2.classList.add('visible');
    capa2Acciones = {
      'c2-cerrar': cerrarCapa2,
      'confirm-ok': () => { cerrarCapa2(); alOk(); },
    };
  }

  /* =========================================================
     VISTA: INICIO
     ========================================================= */
  function vistaInicio() {
    const productos = Datos.productos();
    const recetas = Datos.recetas();
    const eventos = Datos.eventos();
    const hoy = Datos.hoyISO();
    const proximos = eventos.filter(e => e.fecha && e.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const realizados = eventos.length - proximos.length;
    const oscuro = document.documentElement.dataset.tema === 'oscuro';

    let html = `<div class="fila-saludo">
      <div>
        <h1 class="saludo">¡Hola, Chef! 👩‍🍳</h1>
        <p class="saludo-sub">${fechaLegible(hoy)}</p>
      </div>
      <button class="boton-tema" data-accion="alternar-tema" title="Cambiar entre modo claro y oscuro">${oscuro ? '☀️' : '🌙'}</button>
    </div>`;

    if (!productos.length && !recetas.length && !eventos.length) {
      html += `<div class="tarjeta guia">
        <h2>¿Cómo funciona? 🍳</h2>
        <div class="paso-guia"><span class="numero">1</span><span>Anota tus <b>productos</b>: qué compras, cuánto trae cada paquete y su precio.</span></div>
        <div class="paso-guia"><span class="numero">2</span><span>Crea tus <b>recetas</b> con lo que usa cada porción.</span></div>
        <div class="paso-guia"><span class="numero">3</span><span>Arma tu <b>evento</b> y la app calcula cuánto comprar y cuánto gastarás.</span></div>
      </div>
      <div class="separador"></div>
      <button class="boton-principal" data-accion="nuevo-producto">🧺 Agregar mi primer producto</button>`;
      return html;
    }

    html += '<div class="subtitulo">Próximos eventos</div>';
    if (proximos.length) {
      html += '<div class="lista">' + proximos.slice(0, 3).map(e => tarjetaEvento(e, true)).join('') + '</div>';
    } else {
      html += `<div class="tarjeta vacio" style="padding:28px 20px">
        <span class="emoji">🗓️</span>
        <p>No tienes eventos agendados.</p>
        <button class="boton-suave" data-accion="nuevo-evento">➕ Crear un evento</button>
      </div>`;
    }

    html += `<div class="subtitulo">Tu cocina</div>
    <div class="mosaico">
      <button class="azulejo toque" data-accion="ir" data-destino="productos"><span class="ico">🧺</span><span class="num">${productos.length}</span><span class="eti">Productos</span></button>
      <button class="azulejo toque" data-accion="ir" data-destino="recetas"><span class="ico">🥪</span><span class="num">${recetas.length}</span><span class="eti">Recetas</span></button>
      <button class="azulejo toque" data-accion="ir" data-destino="eventos"><span class="ico">🎉</span><span class="num">${eventos.length}</span><span class="eti">Eventos</span></button>
      <button class="azulejo toque" data-accion="ir" data-destino="eventos"><span class="ico">✅</span><span class="num">${realizados}</span><span class="eti">Realizados</span></button>
    </div>

    <div class="separador"></div>
    <button class="boton-principal" data-accion="nuevo-evento">🎉 Nuevo evento</button>
    <div class="separador" style="height:10px"></div>
    <div class="fila-botones">
      <button class="boton-suave" data-accion="nuevo-producto">🧺 Producto</button>
      <button class="boton-suave" data-accion="nueva-receta">🥪 Receta</button>
    </div>`;
    return html;
  }

  function tarjetaEvento(ev, destacado) {
    const pres = Calculo.presupuesto(ev, Datos.receta, Datos.producto);
    return `<button class="tarjeta toque ${destacado ? 'evento-prox' : ''}" data-accion="abrir-evento" data-id="${ev.id}">
      <div class="fila-card">
        <div class="icono">🎉</div>
        <div class="centro">
          <b>${esc(ev.nombre)}</b>
          <small>${fechaLegible(ev.fecha)} · ${ev.invitados} invitados${ev.dias > 1 ? ' · ' + ev.dias + ' días' : ''}</small>
        </div>
        <div class="derecha"><b>${C.pesos(pres.totalCompra)}</b><small>presupuesto</small></div>
      </div>
    </button>`;
  }

  /* =========================================================
     VISTA: PRODUCTOS
     ========================================================= */
  function vistaProductos() {
    return `<div class="cabecera"><h1>🧺 Productos</h1><p>Lo que compras, con precio y contenido</p></div>
    <button class="boton-principal" data-accion="nuevo-producto">➕ Nuevo producto</button>
    <div class="separador"></div>
    <div class="buscador"><span>🔍</span><input data-campo="buscar-productos" placeholder="Busca: jam…" value="${esc(filtroProductos)}"></div>
    <div class="lista" id="lista-productos">${listaProductosHtml()}</div>`;
  }

  function listaProductosHtml() {
    const f = normaliza(filtroProductos);
    const lista = Datos.productos()
      .filter(p => !f || normaliza(p.nombre).includes(f) || normaliza(p.proveedor).includes(f))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (!lista.length) {
      return `<div class="vacio"><span class="emoji">🧺</span>
        <p>${f ? 'No encontré nada con "' + esc(filtroProductos) + '".' : 'Registra lo que compras: jamón, pan, bebida…'}</p></div>`;
    }
    return lista.map(p => `<button class="tarjeta toque" data-accion="editar-producto" data-id="${p.id}">
      <div class="fila-card">
        <div class="icono">${emojiFormato(p.formato)}</div>
        <div class="centro">
          <b>${esc(p.nombre)}</b>
          <small>${descripcionFormato(p)}${p.proveedor ? ' · ' + esc(p.proveedor) : ''}</small>
        </div>
        <div class="derecha"><b>${C.pesos(p.precio)}</b><small>${p.formato === 'unidad' ? 'cada una' : 'por ' + esc(p.formato)}</small></div>
      </div>
    </button>`).join('');
  }

  /* =========================================================
     VISTA: RECETAS
     ========================================================= */
  function vistaRecetas() {
    const recetas = Datos.recetas().slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    let html = `<div class="cabecera"><h1>🥪 Recetas</h1><p>Tus preparaciones y cuánto rinde cada envase</p></div>
    <button class="boton-principal" data-accion="nueva-receta">➕ Nueva receta</button>
    <div class="separador"></div>`;
    if (!recetas.length) {
      html += `<div class="tarjeta vacio"><span class="emoji">🥪</span>
        <p>Crea tu primera preparación: pancitos, vasos de jugo, porciones de torta…</p></div>`;
    } else {
      html += '<div class="lista">' + recetas.map(r => {
        const incompleta = Calculo.faltanProductos(r, Datos.producto);
        const costo = Calculo.costoPorcion(r, Datos.producto);
        const n = r.ingredientes.length;
        return `<button class="tarjeta toque" data-accion="editar-receta" data-id="${r.id}">
          <div class="fila-card">
            <div class="icono">${r.emoji || '🍽️'}</div>
            <div class="centro">
              <b>${esc(r.nombre)}</b>
              <small>${n} ingrediente${n === 1 ? '' : 's'}${incompleta ? ' · ⚠️ falta un producto' : ''}</small>
            </div>
            <div class="derecha"><b>${C.pesos(costo)}</b><small>por porción</small></div>
          </div>
        </button>`;
      }).join('') + '</div>';
    }
    return html;
  }

  /* =========================================================
     VISTA: EVENTOS (lista)
     ========================================================= */
  function vistaEventos() {
    const eventos = Datos.eventos();
    const hoy = Datos.hoyISO();
    const proximos = eventos.filter(e => e.fecha && e.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pasados = eventos.filter(e => !e.fecha || e.fecha < hoy).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    let html = `<div class="cabecera"><h1>🎉 Eventos</h1><p>Tus presupuestos de banquetería</p></div>
    <button class="boton-principal" data-accion="nuevo-evento">➕ Nuevo evento</button>`;

    if (!eventos.length) {
      html += `<div class="separador"></div><div class="tarjeta vacio"><span class="emoji">🗓️</span>
        <p>Crea un evento: eliges las recetas, dices cuántos invitados y la app calcula todo.</p></div>`;
    }
    if (proximos.length) {
      html += '<div class="subtitulo">Próximos</div><div class="lista">' + proximos.map(e => tarjetaEvento(e, true)).join('') + '</div>';
    }
    if (pasados.length) {
      html += '<div class="subtitulo">Anteriores</div><div class="lista">' + pasados.map(e => tarjetaEvento(e, false)).join('') + '</div>';
    }
    return html;
  }

  /* =========================================================
     VISTA: DETALLE DE EVENTO (presupuesto)
     ========================================================= */
  function vistaDetalleEvento() {
    const ev = Datos.evento(eventoAbierto);
    if (!ev) { eventoAbierto = null; return vistaEventos(); }
    const pres = Calculo.presupuesto(ev, Datos.receta, Datos.producto);

    let html = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <button class="volver" data-accion="volver-eventos">←</button>
      <div style="flex:1;min-width:0">
        <h1 style="font-size:23px;font-weight:800">🎉 ${esc(ev.nombre)}</h1>
        <p style="color:var(--tinta-suave);font-size:15px">${fechaLegible(ev.fecha)} · ${ev.invitados} invitados${ev.dias > 1 ? ' · ' + ev.dias + ' días' : ''}</p>
      </div>
    </div>
    <button class="boton-principal" data-accion="modificar-invitados" data-id="${ev.id}">👥 Modificar invitados (${ev.invitados})</button>`;

    if (pres.recetasIncompletas.length) {
      html += `<div class="separador"></div>
      <div class="aviso">⚠️ Falta un producto en: ${esc(pres.recetasIncompletas.join(', '))}. Revisa esas recetas para que el presupuesto esté completo.</div>`;
    }

    if (!pres.compras.length) {
      html += `<div class="separador"></div>
      <div class="tarjeta vacio"><span class="emoji">🧮</span>
        <p>Este evento aún no tiene preparaciones con productos.</p>
        <button class="boton-suave" data-accion="editar-evento" data-id="${ev.id}">✏️ Editar evento</button>
      </div>`;
    } else {
      html += `
      <div class="subtitulo">Presupuesto</div>
      <div class="total-grande">
        <div class="eti">Total ingredientes</div>
        <div class="monto">${C.pesos(pres.totalCompra)}</div>
        <div class="total-detalle">
          <div><b>${C.pesos(pres.costoPorInvitado)}</b><small>por invitado</small></div>
          <div><b>${pres.totalPaquetes}</b><small>envases</small></div>
          <div><b>${pres.productosDistintos}</b><small>productos</small></div>
        </div>
      </div>

      <div class="subtitulo">🛒 Lista de compras</div>
      <div class="lista">${pres.compras.map(tarjetaCompra).join('')}</div>
      ${pres.redondeo > 0.5 ? `<p class="sobra" style="margin-top:10px">Incluye ${C.pesos(pres.redondeo)} extra por comprar envases enteros.</p>` : ''}

      <div class="subtitulo">🍽️ Preparaciones</div>
      <div class="lista">${pres.porReceta.map(tarjetaRecetaEvento).join('')}</div>`;
    }

    html += `
    <div class="subtitulo">Opciones</div>
    <div class="fila-botones">
      <button class="boton-suave" data-accion="editar-evento" data-id="${ev.id}">✏️ Editar</button>
      <button class="boton-suave" data-accion="duplicar-evento" data-id="${ev.id}">📋 Duplicar</button>
    </div>
    <div class="separador" style="height:10px"></div>
    <button class="boton-peligro" data-accion="eliminar-evento" data-id="${ev.id}">🗑️ Eliminar evento</button>`;
    return html;
  }

  function tarjetaCompra(compra) {
    const p = compra.producto;
    const fam = C.familiaDe(p.unidad);
    return `<div class="tarjeta">
      <div class="fila-card">
        <div class="icono">${emojiFormato(p.formato)}</div>
        <div class="centro"><b>${esc(p.nombre)}</b>${p.proveedor ? '<small>' + esc(p.proveedor) + '</small>' : ''}</div>
        <div class="derecha"><b>${C.pesos(compra.costo)}</b></div>
      </div>
      <div class="compra-detalle">
        <div class="dato-mini"><small>Necesitas</small><b>${C.cantidadLegible(compra.necesarioBase, fam)}</b></div>
        <div class="dato-mini"><small>Comprar</small><b>${compra.paquetes} ${esc(plural(p.formato, compra.paquetes))}</b></div>
      </div>
      ${compra.sobraBase > 0.001 ? `<p class="sobra">Te sobrarán ${C.cantidadLegible(compra.sobraBase, fam)}</p>` : ''}
    </div>`;
  }

  function tarjetaRecetaEvento(pr) {
    const r = pr.receta;
    return `<button class="tarjeta toque" data-accion="editar-receta" data-id="${r.id}">
      <div class="fila-card">
        <div class="icono">${r.emoji || '🍽️'}</div>
        <div class="centro">
          <b>${esc(r.nombre)}</b>
          <small>${C.numero(pr.porciones, 0)} ${esc(r.porciones || 'porciones')} · ${esc(String(pr.porPersona).replace('.', ','))} por persona</small>
        </div>
        <div class="derecha"><b>${C.pesos(pr.costo)}</b></div>
      </div>
    </button>`;
  }

  /* =========================================================
     FORMULARIO: PRODUCTO
     ========================================================= */
  function formProducto(id, alGuardar) {
    const ex = id ? Datos.producto(id) : null;
    productoAlGuardar = alGuardar || null;
    bProducto = ex ? {
      id: ex.id,
      nombre: ex.nombre,
      formato: ex.formato,
      precioTexto: String(ex.precio),
      contenidoTexto: String(ex.contenido).replace('.', ','),
      unidad: ex.unidad,
      proveedor: ex.proveedor || '',
      notas: ex.notas || '',
    } : { id: null, nombre: '', formato: 'paquete', precioTexto: '', contenidoTexto: '', unidad: 'g', proveedor: '', notas: '' };
    renderFormProducto();
  }

  function pistaProducto() {
    const b = bProducto;
    const precio = C.parsePrecio(b.precioTexto);
    const cont = C.parseCantidad(b.contenidoTexto);
    if (!precio || !cont) return '💡 Escribe el precio y el contenido, y te muestro cuánto cuesta cada gramo.';
    const base = C.aBase(cont, b.unidad);
    const unitario = precio / base;
    const nombreUnidad = b.unidad === 'un' ? 'unidad' : (C.familiaDe(b.unidad) === 'peso' ? 'gramo' : 'ml');
    const precioTexto = unitario < 10 ? '$' + C.numero(unitario, 1) : C.pesos(unitario);
    return `💡 Cada ${esc(b.formato)} trae <b>${C.cantidadLegible(base, C.familiaDe(b.unidad))}</b> → cada ${nombreUnidad} te cuesta <b>${precioTexto}</b>.`;
  }

  function renderFormProducto() {
    const b = bProducto;
    abrirPanel(`
      <header class="cabecera-panel">
        <button class="volver" data-accion="cerrar">←</button>
        <h2>${b.id ? '✏️ Editar producto' : '🧺 Nuevo producto'}</h2>
      </header>
      <div class="cuerpo-panel">
        <label class="campo">¿Qué producto es?</label>
        <input class="entrada" data-campo="nombre" placeholder="Ej: Jamón Colonial" value="${esc(b.nombre)}">

        <label class="campo">¿Cómo se vende?</label>
        <div class="chips">${C.FORMATOS.map(f =>
          `<button class="chip ${f === b.formato ? 'activo' : ''}" data-accion="prod-formato" data-valor="${f}">${f}</button>`).join('')}</div>

        <label class="campo">¿Cuánto trae cada ${esc(b.formato)}? <small>(unidades, gramos, ml…)</small></label>
        <div class="fila-cantidad">
          <input class="entrada" data-campo="contenido" inputmode="decimal" placeholder="250" value="${esc(b.contenidoTexto)}">
          <div class="chips">${Object.keys(C.UNIDADES).map(u =>
            `<button class="chip ${u === b.unidad ? 'activo' : ''}" data-accion="prod-unidad" data-valor="${u}">${C.UNIDADES[u].corto}</button>`).join('')}</div>
        </div>

        <label class="campo">Precio de cada ${esc(b.formato)}</label>
        <div class="campo-precio"><span>$</span><input data-campo="precio" inputmode="numeric" placeholder="6.200" value="${esc(b.precioTexto)}"></div>
        <p class="pista" id="pista-producto">${pistaProducto()}</p>

        <label class="campo">¿Dónde lo compras? <small>(opcional)</small></label>
        <input class="entrada" data-campo="proveedor" placeholder="Ej: Jumbo" value="${esc(b.proveedor)}">

        <label class="campo">Notas <small>(opcional)</small></label>
        <input class="entrada" data-campo="notas" placeholder="Ej: pedir con 3 días de anticipación" value="${esc(b.notas)}">

        ${b.id ? '<div class="separador"></div><button class="boton-peligro" data-accion="prod-eliminar">🗑️ Eliminar producto</button>' : ''}
      </div>
      <footer class="pie-panel"><button class="boton-principal" data-accion="prod-guardar">✓ Guardar producto</button></footer>
    `);

    capaAcciones = {
      cerrar: cerrarFormProducto,
      'prod-formato': d => { b.formato = d.valor; renderFormProducto(); },
      'prod-unidad': d => { b.unidad = d.valor; renderFormProducto(); },
      'prod-guardar': guardarFormProducto,
      'prod-eliminar': () => eliminarProductoConfirm(b.id),
    };
    capaInput = (campo, el) => {
      if (campo === 'nombre') b.nombre = el.value;
      else if (campo === 'precio') b.precioTexto = el.value;
      else if (campo === 'contenido') b.contenidoTexto = el.value;
      else if (campo === 'proveedor') b.proveedor = el.value;
      else if (campo === 'notas') b.notas = el.value;
      const pista = document.getElementById('pista-producto');
      if (pista) pista.innerHTML = pistaProducto();
    };
  }

  function cerrarFormProducto() {
    if (productoAlGuardar) {
      productoAlGuardar = null;
      renderFormReceta();          // veníamos desde una receta: volvemos a ella
    } else {
      cerrarCapa();
    }
  }

  function guardarFormProducto() {
    const b = bProducto;
    const nombre = b.nombre.trim();
    const precio = C.parsePrecio(b.precioTexto);
    const contenido = C.parseCantidad(b.contenidoTexto);
    if (!nombre) return toast('Ponle nombre al producto 🙂');
    if (!precio || precio <= 0) return toast('Falta el precio');
    if (!contenido || contenido <= 0) return toast('Falta cuánto trae cada ' + b.formato);

    const guardado = Datos.guardarProducto({
      id: b.id, nombre, formato: b.formato, precio,
      contenido, unidad: b.unidad, contenidoBase: C.aBase(contenido, b.unidad),
      proveedor: b.proveedor.trim(), notas: b.notas.trim(),
    });
    toast('Producto guardado ✓');

    const alGuardar = productoAlGuardar;
    productoAlGuardar = null;
    if (alGuardar) { alGuardar(guardado); return; }

    cerrarCapa();
    if (vista === 'inicio') vista = 'productos';
    render();
  }

  function eliminarProductoConfirm(id) {
    const p = Datos.producto(id);
    if (!p) return;
    const usos = Datos.recetasQueUsan(id);
    confirmar({
      titulo: `¿Eliminar "${esc(p.nombre)}"?`,
      detalle: usos.length
        ? `Se usa en ${usos.length} receta${usos.length > 1 ? 's' : ''} (${esc(usos.map(r => r.nombre).join(', '))}). Esas recetas quedarán incompletas.`
        : 'Esta acción no se puede deshacer.',
      alOk: () => {
        Datos.eliminarProducto(id);
        productoAlGuardar = null;
        cerrarCapa();
        vista = 'productos';
        render();
        toast('Producto eliminado');
      },
    });
  }

  /* =========================================================
     FORMULARIO: RECETA
     ========================================================= */
  function formReceta(id) {
    const ex = id ? Datos.receta(id) : null;
    bReceta = ex ? {
      id: ex.id,
      nombre: ex.nombre,
      emoji: ex.emoji || '🍽️',
      porciones: ex.porciones || 'porciones',
      ingredientes: ex.ingredientes.map(i => ({
        productoId: i.productoId,
        unidad: i.unidad,
        cantidadTexto: C.textoEditable(i.cantidadBase, i.unidad),
      })),
    } : { id: null, nombre: '', emoji: '🥪', porciones: 'porciones', ingredientes: [] };
    renderFormReceta();
  }

  function lineaRendimiento(ing, p) {
    const cant = C.parseCantidad(ing.cantidadTexto);
    const nombrePorciones = (bReceta.porciones || '').trim() || 'porciones';
    if (!cant || cant <= 0) return '💡 Escribe la cantidad y te digo cuánto rinde.';
    const base = C.aBase(cant, ing.unidad);
    const rinde = Calculo.rendimiento(p, base);
    if (!rinde) return `⚠️ Un ${esc(p.formato)} no alcanza ni para una porción.`;
    return `💡 1 ${esc(p.formato)} (${C.cantidadLegible(p.contenidoBase, C.familiaDe(p.unidad))}) rinde para <b>${C.numero(rinde, 0)} ${esc(nombrePorciones)}</b>.`;
  }

  function lineaCostoPorcion() {
    let total = 0;
    let alguno = false;
    for (const ing of bReceta.ingredientes) {
      const p = Datos.producto(ing.productoId);
      const cant = C.parseCantidad(ing.cantidadTexto);
      if (!p || !cant) continue;
      total += Calculo.precioPorBase(p) * C.aBase(cant, ing.unidad);
      alguno = true;
    }
    if (!alguno) return '🧮 Aquí verás cuánto te cuesta cada porción.';
    return `🧮 Cada porción te cuesta aproximadamente <b>${C.pesos(total)}</b>.`;
  }

  function filaIngrediente(ing, i) {
    const p = Datos.producto(ing.productoId);
    if (!p) {
      return `<div class="ing">
        <div class="ing-cab"><b>⚠️ Producto eliminado</b>
        <button class="quitar" data-accion="rec-quitar" data-i="${i}">✕ Quitar</button></div>
        <p class="sobra">Este producto ya no existe en tu catálogo.</p>
      </div>`;
    }
    if (!C.sonCompatibles(ing.unidad, p.unidad)) ing.unidad = unidadBase(C.familiaDe(p.unidad));
    const unidades = C.unidadesDeFamilia(C.familiaDe(p.unidad));
    const selectorUnidad = unidades.length > 1
      ? `<div class="chips">${unidades.map(u =>
          `<button class="chip ${u === ing.unidad ? 'activo' : ''}" data-accion="rec-unidad" data-i="${i}" data-valor="${u}">${C.UNIDADES[u].corto}</button>`).join('')}</div>`
      : `<span class="por">${p.unidad === 'un' ? 'unidades' : C.UNIDADES[p.unidad].corto}</span>`;
    return `<div class="ing">
      <div class="ing-cab"><b>${esc(p.nombre)}</b>
      <button class="quitar" data-accion="rec-quitar" data-i="${i}">✕ Quitar</button></div>
      <div class="fila-cantidad">
        <span class="por">Por porción:</span>
        <input class="entrada" data-campo="rec-cant" data-i="${i}" inputmode="decimal" placeholder="3" value="${esc(ing.cantidadTexto)}">
        ${selectorUnidad}
      </div>
      <p class="pista" id="rend-${i}">${lineaRendimiento(ing, p)}</p>
    </div>`;
  }

  function refrescarLineasReceta() {
    bReceta.ingredientes.forEach((ing, i) => {
      const p = Datos.producto(ing.productoId);
      const linea = document.getElementById('rend-' + i);
      if (linea && p) linea.innerHTML = lineaRendimiento(ing, p);
    });
    const costo = document.getElementById('costo-porcion');
    if (costo) costo.innerHTML = lineaCostoPorcion();
  }

  function renderFormReceta() {
    const b = bReceta;
    const filas = b.ingredientes.map((ing, i) => filaIngrediente(ing, i)).join('');
    abrirPanel(`
      <header class="cabecera-panel">
        <button class="volver" data-accion="cerrar">←</button>
        <h2>${b.id ? '✏️ Editar receta' : '🥪 Nueva receta'}</h2>
      </header>
      <div class="cuerpo-panel">
        <label class="campo">¿Cómo se llama la preparación?</label>
        <input class="entrada" data-campo="rec-nombre" placeholder="Ej: Pancito cocktail jamón queso" value="${esc(b.nombre)}">

        <label class="campo">Elige un ícono</label>
        <div class="chips">${EMOJIS.map(e =>
          `<button class="chip chip-emoji ${e === b.emoji ? 'activo' : ''}" data-accion="rec-emoji" data-valor="${e}">${e}</button>`).join('')}</div>

        <label class="campo">¿Cómo se llaman las porciones? <small>(pancitos, vasos, porciones…)</small></label>
        <input class="entrada" data-campo="rec-porciones" value="${esc(b.porciones)}">

        <label class="campo">Ingredientes <small>(cantidad por porción)</small></label>
        ${filas || '<p class="pista">Agrega los ingredientes y te diré cuánto rinde cada envase. 👇</p>'}
        <button class="boton-suave" data-accion="rec-agregar">➕ Agregar ingrediente</button>

        <p class="pista" id="costo-porcion">${lineaCostoPorcion()}</p>

        ${b.id ? '<div class="separador"></div><button class="boton-peligro" data-accion="rec-eliminar">🗑️ Eliminar receta</button>' : ''}
      </div>
      <footer class="pie-panel"><button class="boton-principal" data-accion="rec-guardar">✓ Guardar receta</button></footer>
    `);

    capaAcciones = {
      cerrar: cerrarCapa,
      'rec-emoji': d => { b.emoji = d.valor; renderFormReceta(); },
      'rec-unidad': d => { b.ingredientes[+d.i].unidad = d.valor; renderFormReceta(); },
      'rec-quitar': d => { b.ingredientes.splice(+d.i, 1); renderFormReceta(); },
      'rec-agregar': abrirPickerProducto,
      'rec-guardar': guardarFormReceta,
      'rec-eliminar': () => eliminarRecetaConfirm(b.id),
    };
    capaInput = (campo, el) => {
      if (campo === 'rec-nombre') b.nombre = el.value;
      else if (campo === 'rec-porciones') { b.porciones = el.value; refrescarLineasReceta(); }
      else if (campo === 'rec-cant') {
        const i = +el.dataset.i;
        b.ingredientes[i].cantidadTexto = el.value;
        const p = Datos.producto(b.ingredientes[i].productoId);
        const linea = document.getElementById('rend-' + i);
        if (linea && p) linea.innerHTML = lineaRendimiento(b.ingredientes[i], p);
        const costo = document.getElementById('costo-porcion');
        if (costo) costo.innerHTML = lineaCostoPorcion();
      }
    };
  }

  function guardarFormReceta() {
    const b = bReceta;
    const nombre = b.nombre.trim();
    if (!nombre) return toast('Ponle nombre a la receta 🙂');
    if (!b.ingredientes.length) return toast('Agrega al menos un ingrediente');

    const ingredientes = [];
    for (const ing of b.ingredientes) {
      const p = Datos.producto(ing.productoId);
      if (!p) continue;                                  // limpia productos eliminados
      const cant = C.parseCantidad(ing.cantidadTexto);
      if (!cant || cant <= 0) return toast('Falta la cantidad de ' + p.nombre);
      ingredientes.push({ productoId: ing.productoId, unidad: ing.unidad, cantidadBase: C.aBase(cant, ing.unidad) });
    }
    if (!ingredientes.length) return toast('Agrega al menos un ingrediente');

    Datos.guardarReceta({
      id: b.id, nombre, emoji: b.emoji,
      porciones: (b.porciones || '').trim() || 'porciones',
      ingredientes,
    });
    cerrarCapa();
    if (vista === 'inicio') vista = 'recetas';
    render();
    toast('Receta guardada ✓');
  }

  function eliminarRecetaConfirm(id) {
    const r = Datos.receta(id);
    if (!r) return;
    const usos = Datos.eventosQueUsan(id);
    confirmar({
      titulo: `¿Eliminar "${esc(r.nombre)}"?`,
      detalle: usos.length
        ? `Se usa en ${usos.length} evento${usos.length > 1 ? 's' : ''} (${esc(usos.map(e => e.nombre).join(', '))}). Se quitará de esos presupuestos.`
        : 'Esta acción no se puede deshacer.',
      alOk: () => {
        Datos.eliminarReceta(id);
        cerrarCapa();
        vista = 'recetas';
        render();
        toast('Receta eliminada');
      },
    });
  }

  /* ---------- selector de producto para la receta ---------- */
  function abrirPickerProducto() {
    filtroPicker = '';
    renderPicker();
  }

  function listaPickerHtml() {
    const enReceta = new Set(bReceta.ingredientes.map(i => i.productoId));
    const f = normaliza(filtroPicker);
    const lista = Datos.productos()
      .filter(p => !enReceta.has(p.id))
      .filter(p => !f || normaliza(p.nombre).includes(f))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (!lista.length) {
      return `<div class="vacio"><span class="emoji">🧺</span>
        <p>${f ? 'No encontré nada con "' + esc(filtroPicker) + '".' : 'Ya agregaste todos tus productos. Puedes crear uno nuevo. 👇'}</p></div>`;
    }
    return lista.map(p => `<button class="tarjeta toque" data-accion="picker-elegir" data-id="${p.id}">
      <div class="fila-card">
        <div class="icono">${emojiFormato(p.formato)}</div>
        <div class="centro"><b>${esc(p.nombre)}</b><small>${descripcionFormato(p)}</small></div>
        <div class="derecha"><b>${C.pesos(p.precio)}</b></div>
      </div>
    </button>`).join('');
  }

  function renderPicker() {
    abrirPanel(`
      <header class="cabecera-panel">
        <button class="volver" data-accion="picker-volver">←</button>
        <h2>¿Qué ingrediente agregamos?</h2>
      </header>
      <div class="cuerpo-panel">
        <div class="buscador"><span>🔍</span><input data-campo="picker-buscar" placeholder="Busca: jam…" value="${esc(filtroPicker)}"></div>
        <div class="lista" id="lista-picker">${listaPickerHtml()}</div>
        <div class="separador"></div>
        <button class="boton-suave" data-accion="picker-crear">➕ Crear producto nuevo</button>
      </div>
    `);
    capaAcciones = {
      'picker-volver': renderFormReceta,
      'picker-elegir': d => {
        const p = Datos.producto(d.id);
        if (!p) return;
        bReceta.ingredientes.push({ productoId: p.id, unidad: unidadBase(C.familiaDe(p.unidad)), cantidadTexto: '' });
        renderFormReceta();
      },
      'picker-crear': () => formProducto(null, prod => {
        bReceta.ingredientes.push({ productoId: prod.id, unidad: unidadBase(C.familiaDe(prod.unidad)), cantidadTexto: '' });
        renderFormReceta();
      }),
    };
    capaInput = (campo, el) => {
      if (campo === 'picker-buscar') {
        filtroPicker = el.value;
        const lista = document.getElementById('lista-picker');
        if (lista) lista.innerHTML = listaPickerHtml();
      }
    };
  }

  /* =========================================================
     FORMULARIO: EVENTO
     ========================================================= */
  function formEvento(id) {
    const ex = id ? Datos.evento(id) : null;
    bEvento = ex ? {
      id: ex.id,
      nombre: ex.nombre,
      fecha: ex.fecha || '',
      invitadosTexto: String(ex.invitados || ''),
      diasTexto: String(ex.dias || 1),
      sel: new Map((ex.preparaciones || []).map(p => [p.recetaId, String(p.porPersona).replace('.', ',')])),
    } : {
      id: null, nombre: '', fecha: Datos.hoyISO(7),
      invitadosTexto: '30', diasTexto: '1', sel: new Map(),
    };
    renderFormEvento();
  }

  function lineaTotalReceta(r) {
    const b = bEvento;
    const inv = C.parseCantidad(b.invitadosTexto);
    const cant = C.parseCantidad(b.sel.get(r.id));
    if (!inv || !cant) return '💡 Escribe cuántos por persona.';
    const total = Math.ceil(inv * cant);
    return `💡 ${C.numero(inv, 0)} invitados × ${esc(String(b.sel.get(r.id)))} = <b>${C.numero(total, 0)} ${esc(r.porciones || 'porciones')}</b>`;
  }

  function filaSelReceta(r) {
    const b = bEvento;
    const activa = b.sel.has(r.id);
    const cuerpo = activa ? `
      <div class="sel-cuerpo">
        <div class="fila-cantidad">
          <span class="por">Por persona:</span>
          <div class="stepper" style="flex:1">
            <button class="paso" data-accion="ev-cant-paso" data-id="${r.id}" data-delta="-1">−</button>
            <input data-campo="ev-cant" data-id="${r.id}" inputmode="decimal" value="${esc(b.sel.get(r.id))}">
            <button class="paso" data-accion="ev-cant-paso" data-id="${r.id}" data-delta="1">+</button>
          </div>
        </div>
        <p class="pista" id="linea-${r.id}">${lineaTotalReceta(r)}</p>
      </div>` : '';
    return `<div class="sel-receta ${activa ? 'activa' : ''}">
      <button class="sel-cab" data-accion="ev-toggle" data-id="${r.id}">
        <span>${r.emoji || '🍽️'} ${esc(r.nombre)}</span><span class="marca">✓</span>
      </button>${cuerpo}</div>`;
  }

  function actualizarLinea(recetaId) {
    const el = document.getElementById('linea-' + recetaId);
    const r = Datos.receta(recetaId);
    if (el && r) el.innerHTML = lineaTotalReceta(r);
  }

  function actualizarTodasLasLineas() {
    for (const id of bEvento.sel.keys()) actualizarLinea(id);
  }

  function ajustarCampo(campo, delta, minimo) {
    const inp = $capa.querySelector(`[data-campo="${campo}"]`);
    if (!inp) return;
    const actual = C.parseCantidad(inp.value) || minimo;
    const nuevo = Math.max(minimo, Math.round(actual + delta));
    inp.value = nuevo;
    if (campo === 'ev-invitados') { bEvento.invitadosTexto = String(nuevo); actualizarTodasLasLineas(); }
    else if (campo === 'ev-dias') bEvento.diasTexto = String(nuevo);
  }

  function renderFormEvento() {
    const b = bEvento;
    const recetas = Datos.recetas().slice().sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
    const filas = recetas.length
      ? recetas.map(filaSelReceta).join('')
      : `<div class="vacio"><span class="emoji">🥪</span><p>Primero crea una receta en la pestaña Recetas.</p></div>`;

    abrirPanel(`
      <header class="cabecera-panel">
        <button class="volver" data-accion="cerrar">←</button>
        <h2>${b.id ? '✏️ Editar evento' : '🎉 Nuevo evento'}</h2>
      </header>
      <div class="cuerpo-panel">
        <label class="campo">¿Cómo se llama el evento?</label>
        <input class="entrada" data-campo="ev-nombre" placeholder="Ej: Cumpleaños Sofía" value="${esc(b.nombre)}">

        <label class="campo">¿Cuándo es?</label>
        <input class="entrada" type="date" data-campo="ev-fecha" value="${esc(b.fecha)}">

        <label class="campo">¿Cuántos invitados?</label>
        <div class="stepper">
          <button class="paso" data-accion="ev-inv" data-delta="-1">−</button>
          <input data-campo="ev-invitados" inputmode="numeric" value="${esc(b.invitadosTexto)}">
          <button class="paso" data-accion="ev-inv" data-delta="1">+</button>
        </div>

        <label class="campo">¿Cuántos días dura? <small>(solo como referencia)</small></label>
        <div class="stepper">
          <button class="paso" data-accion="ev-dias" data-delta="-1">−</button>
          <input data-campo="ev-dias" inputmode="numeric" value="${esc(b.diasTexto)}">
          <button class="paso" data-accion="ev-dias" data-delta="1">+</button>
        </div>

        <label class="campo">¿Qué vas a servir? <small>(y cuánto por persona)</small></label>
        ${filas}
      </div>
      <footer class="pie-panel"><button class="boton-principal" data-accion="ev-guardar">✓ Guardar y ver presupuesto</button></footer>
    `);

    capaAcciones = {
      cerrar: cerrarCapa,
      'ev-toggle': d => {
        if (b.sel.has(d.id)) b.sel.delete(d.id);
        else b.sel.set(d.id, '1');
        renderFormEvento();
      },
      'ev-inv': d => ajustarCampo('ev-invitados', Number(d.delta), 1),
      'ev-dias': d => ajustarCampo('ev-dias', Number(d.delta), 1),
      'ev-cant-paso': d => {
        const actual = C.parseCantidad(b.sel.get(d.id)) || 0;
        const nuevo = Math.max(1, Math.round(actual + Number(d.delta)));
        b.sel.set(d.id, String(nuevo));
        const inp = $capa.querySelector(`[data-campo="ev-cant"][data-id="${d.id}"]`);
        if (inp) inp.value = nuevo;
        actualizarLinea(d.id);
      },
      'ev-guardar': guardarFormEvento,
    };
    capaInput = (campo, el) => {
      if (campo === 'ev-nombre') b.nombre = el.value;
      else if (campo === 'ev-fecha') b.fecha = el.value;
      else if (campo === 'ev-invitados') { b.invitadosTexto = el.value; actualizarTodasLasLineas(); }
      else if (campo === 'ev-dias') b.diasTexto = el.value;
      else if (campo === 'ev-cant') { b.sel.set(el.dataset.id, el.value); actualizarLinea(el.dataset.id); }
    };
  }

  function guardarFormEvento() {
    const b = bEvento;
    const nombre = b.nombre.trim();
    if (!nombre) return toast('Ponle nombre al evento 🙂');
    const invitados = C.parseCantidad(b.invitadosTexto);
    if (!invitados || invitados < 1) return toast('¿Cuántos invitados vienen?');
    if (!b.sel.size) return toast('Elige al menos una preparación');

    const preparaciones = [];
    for (const [recetaId, texto] of b.sel) {
      const r = Datos.receta(recetaId);
      if (!r) continue;
      const cant = C.parseCantidad(texto);
      if (!cant || cant <= 0) return toast(`¿Cuántos "${r.nombre}" por persona?`);
      preparaciones.push({ recetaId, porPersona: cant });
    }
    if (!preparaciones.length) return toast('Elige al menos una preparación');

    const guardado = Datos.guardarEvento({
      id: b.id, nombre, fecha: b.fecha || '',
      invitados: Math.round(invitados),
      dias: Math.max(1, Math.round(C.parseCantidad(b.diasTexto) || 1)),
      preparaciones,
    });
    cerrarCapa();
    vista = 'eventos';
    eventoAbierto = guardado.id;
    render();
    toast('¡Evento guardado! 🎉');
  }

  /* ---------- modificar invitados (recalcula todo) ---------- */
  function modalInvitados(eventoId) {
    const ev = Datos.evento(eventoId);
    if (!ev) return;
    $capa2.innerHTML = `
      <div class="fondo-capa" data-accion="c2-cerrar"></div>
      <section class="hoja">
        <h3>👥 ¿Cuántos invitados?</h3>
        <p>El presupuesto se recalcula al instante.</p>
        <div class="stepper stepper-gigante">
          <button class="paso" data-accion="inv-delta" data-delta="-1">−</button>
          <input id="inv-num" inputmode="numeric" value="${ev.invitados}">
          <button class="paso" data-accion="inv-delta" data-delta="1">+</button>
        </div>
        <div class="fila-botones" style="margin-top:10px">
          <button class="boton-suave" data-accion="inv-delta" data-delta="-10">−10</button>
          <button class="boton-suave" data-accion="inv-delta" data-delta="10">+10</button>
        </div>
        <div class="separador"></div>
        <button class="boton-principal" data-accion="inv-listo">✓ Recalcular presupuesto</button>
      </section>`;
    $capa2.classList.add('visible');
    capa2Acciones = {
      'c2-cerrar': cerrarCapa2,
      'inv-delta': d => {
        const inp = document.getElementById('inv-num');
        const actual = C.parseCantidad(inp.value) || 0;
        inp.value = Math.max(1, Math.round(actual + Number(d.delta)));
      },
      'inv-listo': () => {
        const n = C.parseCantidad(document.getElementById('inv-num').value);
        if (!n || n < 1) return toast('Escribe cuántos invitados');
        ev.invitados = Math.round(n);
        Datos.guardarEvento(ev);
        cerrarCapa2();
        render();
        toast('Presupuesto recalculado ✨');
      },
    };
  }

  /* =========================================================
     ACCIONES GLOBALES Y NAVEGACIÓN
     ========================================================= */
  const acciones = {
    ir: d => { vista = d.destino; eventoAbierto = null; render(); },
    'alternar-tema': alternarTema,
    'nuevo-producto': () => formProducto(null),
    'editar-producto': d => formProducto(d.id),
    'nueva-receta': () => formReceta(null),
    'editar-receta': d => formReceta(d.id),
    'nuevo-evento': () => formEvento(null),
    'editar-evento': d => formEvento(d.id),
    'abrir-evento': d => { vista = 'eventos'; eventoAbierto = d.id; render(); },
    'volver-eventos': () => { eventoAbierto = null; render(); },
    'modificar-invitados': d => modalInvitados(d.id),
    'duplicar-evento': d => {
      const copia = Datos.duplicarEvento(d.id);
      if (copia) { eventoAbierto = copia.id; render(); toast('Evento duplicado 📋'); }
    },
    'eliminar-evento': d => {
      const ev = Datos.evento(d.id);
      confirmar({
        titulo: `¿Eliminar "${esc((ev && ev.nombre) || 'evento')}"?`,
        detalle: 'Esta acción no se puede deshacer.',
        alOk: () => {
          Datos.eliminarEvento(d.id);
          eventoAbierto = null;
          render();
          toast('Evento eliminado');
        },
      });
    },
  };

  function render() {
    document.querySelectorAll('#nav button').forEach(btn =>
      btn.classList.toggle('activo', btn.dataset.vista === vista));
    let html = '';
    if (vista === 'inicio') html = vistaInicio();
    else if (vista === 'productos') html = vistaProductos();
    else if (vista === 'recetas') html = vistaRecetas();
    else html = eventoAbierto ? vistaDetalleEvento() : vistaEventos();
    $app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function init() {
    aplicarTema(temaInicial());

    $nav.addEventListener('click', e => {
      const b = e.target.closest('button[data-vista]');
      if (!b) return;
      vista = b.dataset.vista;
      eventoAbierto = null;
      render();
    });

    $app.addEventListener('click', e => {
      const el = e.target.closest('[data-accion]');
      if (el && acciones[el.dataset.accion]) acciones[el.dataset.accion](el.dataset, el);
    });

    $app.addEventListener('input', e => {
      if (e.target.dataset.campo === 'buscar-productos') {
        filtroProductos = e.target.value;
        const lista = document.getElementById('lista-productos');
        if (lista) lista.innerHTML = listaProductosHtml();
      }
    });

    $capa.addEventListener('click', e => {
      const el = e.target.closest('[data-accion]');
      if (el && capaAcciones[el.dataset.accion]) {
        e.preventDefault();
        capaAcciones[el.dataset.accion](el.dataset, el);
      }
    });

    const manejarInputCapa = e => {
      const el = e.target;
      if (el.dataset && el.dataset.campo && capaInput) capaInput(el.dataset.campo, el);
    };
    $capa.addEventListener('input', manejarInputCapa);
    $capa.addEventListener('change', manejarInputCapa);

    $capa2.addEventListener('click', e => {
      const el = e.target.closest('[data-accion]');
      if (el && capa2Acciones[el.dataset.accion]) capa2Acciones[el.dataset.accion](el.dataset, el);
    });

    render();
  }

  init();
})();
