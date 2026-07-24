/* =========================================================
   PERSISTENCIA
   Guarda productos, recetas y eventos en el navegador
   (localStorage). La app parte vacía: la usuaria registra
   sus propios productos, recetas y eventos.
   ========================================================= */
const Datos = (() => {
  'use strict';

  const CLAVE = 'calculadora-chef-v1';

  /* Ids de los antiguos datos de ejemplo: se retiran una sola vez
     de los navegadores que alcanzaron a recibirlos. */
  const IDS_EJEMPLO = [
    'p-pan', 'p-jamon', 'p-queso', 'p-mayo', 'p-bebida', 'p-cafe', 'p-torta',
    'r-pancito', 'r-bebida', 'r-cafe', 'r-torta',
    'e-sofia',
  ];

  let db = null;

  function uid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /* Fecha de "hoy" según el reloj de Santiago de Chile,
     aunque el teléfono esté configurado en otra zona horaria */
  function hoyISO(diasExtra = 0) {
    let f;
    try {
      // en-CA entrega directamente AAAA-MM-DD
      const texto = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const [a, m, d] = texto.split('-').map(Number);
      f = new Date(a, m - 1, d);
    } catch (e) {
      f = new Date();
    }
    f.setDate(f.getDate() + diasExtra);
    const p = n => String(n).padStart(2, '0');
    return f.getFullYear() + '-' + p(f.getMonth() + 1) + '-' + p(f.getDate());
  }

  /* Medidas chilenas de cocina, precargadas pero 100% editables */
  function medidasChilenas() {
    return [
      { id: 'md-taza',        nombre: 'taza',        familia: 'volumen', factor: 200 },
      { id: 'md-cucharada',   nombre: 'cucharada',   familia: 'volumen', factor: 15 },
      { id: 'md-cucharadita', nombre: 'cucharadita', familia: 'volumen', factor: 5 },
      { id: 'md-docena',      nombre: 'docena',      familia: 'unidad',  factor: 12 },
    ];
  }

  function vacia() {
    return { productos: [], recetas: [], eventos: [], medidas: medidasChilenas(), ejemploRetirado: true };
  }

  function cargar() {
    if (db) return db;
    try {
      const crudo = localStorage.getItem(CLAVE);
      db = crudo ? JSON.parse(crudo) : vacia();
    } catch (e) {
      db = vacia();
    }
    if (!Array.isArray(db.productos)) db.productos = [];
    if (!Array.isArray(db.recetas)) db.recetas = [];
    if (!Array.isArray(db.eventos)) db.eventos = [];
    if (!Array.isArray(db.medidas)) {
      db.medidas = medidasChilenas();   // primera vez con esta versión
      guardar();
    }
    if (!db.ejemploRetirado) {
      db.productos = db.productos.filter(p => !IDS_EJEMPLO.includes(p.id));
      db.recetas = db.recetas.filter(r => !IDS_EJEMPLO.includes(r.id));
      db.eventos = db.eventos.filter(e => !IDS_EJEMPLO.includes(e.id));
      db.ejemploRetirado = true;
      guardar();
    }
    Conversion.registrar(db.medidas);
    return db;
  }

  /* Aviso a la interfaz cuando un guardado falla (cuota llena, modo privado…) */
  let avisarFalla = null;
  const siFallaGuardado = fn => { avisarFalla = fn; };

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(db));
    } catch (e) {
      if (avisarFalla) avisarFalla();
    }
  }

  /* Relee desde localStorage (otra pestaña pudo haber escrito) */
  function recargar() {
    db = null;
    return cargar();
  }

  /* ---------- CRUD genérico ---------- */
  function guardarEn(lista, obj) {
    if (obj.id) {
      const i = lista.findIndex(x => x.id === obj.id);
      if (i >= 0) lista[i] = obj; else lista.push(obj);
    } else {
      obj.id = uid();
      lista.push(obj);
    }
    guardar();
    return obj;
  }

  function eliminarDe(lista, id) {
    const i = lista.findIndex(x => x.id === id);
    if (i >= 0) lista.splice(i, 1);
    guardar();
  }

  /* ---------- Productos ---------- */
  const productos = () => cargar().productos;
  const producto = id => cargar().productos.find(p => p.id === id) || null;
  const guardarProducto = p => guardarEn(cargar().productos, p);
  const eliminarProducto = id => eliminarDe(cargar().productos, id);
  const recetasQueUsan = productoId =>
    cargar().recetas.filter(r => r.ingredientes.some(i => i.productoId === productoId));

  /* ---------- Recetas ---------- */
  const recetas = () => cargar().recetas;
  const receta = id => cargar().recetas.find(r => r.id === id) || null;
  const guardarReceta = r => guardarEn(cargar().recetas, r);
  const eliminarReceta = id => {
    eliminarDe(cargar().recetas, id);
    for (const e of cargar().eventos) {
      e.preparaciones = (e.preparaciones || []).filter(p => p.recetaId !== id);
    }
    guardar();
  };
  const eventosQueUsan = recetaId =>
    cargar().eventos.filter(e => (e.preparaciones || []).some(p => p.recetaId === recetaId));

  /* ---------- Medidas personalizadas ---------- */
  const medidas = () => cargar().medidas;
  const medida = id => cargar().medidas.find(m => m.id === id) || null;

  function guardarMedida(m) {
    const d = cargar();
    const previa = m.id ? d.medidas.find(x => x.id === m.id) : null;
    const factorPrevio = previa ? previa.factor : null;
    const guardada = guardarEn(d.medidas, m);
    // Si cambió la equivalencia, todo lo que la usa se recalcula solo
    if (factorPrevio && factorPrevio !== guardada.factor) {
      for (const p of d.productos) {
        if (p.unidad === guardada.id) p.contenidoBase = p.contenido * guardada.factor;
      }
      for (const r of d.recetas) {
        for (const ing of r.ingredientes) {
          if (ing.unidad === guardada.id) ing.cantidadBase = (ing.cantidadBase / factorPrevio) * guardada.factor;
        }
      }
    }
    Conversion.registrar(d.medidas);
    guardar();
    return guardada;
  }

  function eliminarMedida(id) {
    const d = cargar();
    eliminarDe(d.medidas, id);
    Conversion.registrar(d.medidas);
    guardar();
  }

  function usosDeMedida(id) {
    const d = cargar();
    const enProductos = d.productos.filter(p => p.unidad === id);
    const enRecetas = d.recetas.filter(r => r.ingredientes.some(i => i.unidad === id));
    return { productos: enProductos, recetas: enRecetas, total: enProductos.length + enRecetas.length };
  }

  /* ---------- Eventos ---------- */
  const eventos = () => cargar().eventos;
  const evento = id => cargar().eventos.find(e => e.id === id) || null;
  const guardarEvento = e => guardarEn(cargar().eventos, e);
  const eliminarEvento = id => eliminarDe(cargar().eventos, id);

  function duplicarEvento(id) {
    const original = evento(id);
    if (!original) return null;
    const copia = JSON.parse(JSON.stringify(original));
    copia.id = uid();
    copia.nombre = original.nombre + ' (copia)';
    cargar().eventos.push(copia);
    guardar();
    return copia;
  }

  /* =========================================================
     RESPALDO Y RESTAURACIÓN
     El archivo importado NUNCA se confía: cada campo se valida,
     se recorta y los valores derivados se recalculan.
     ========================================================= */
  function exportar() {
    const d = cargar();
    return JSON.stringify({
      app: 'calculadora-chef',
      version: 2,
      fecha: new Date().toISOString(),
      medidas: d.medidas,
      productos: d.productos,
      recetas: d.recetas,
      eventos: d.eventos,
    }, null, 2);
  }

  const soloTexto = (v, largo) => (typeof v === 'string' ? v.slice(0, largo || 200) : '');
  const soloNumero = v => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);

  function validarRespaldo(texto) {
    if (typeof texto !== 'string' || !texto || texto.length > 2000000) return null;
    let crudo;
    try { crudo = JSON.parse(texto); } catch (e) { return null; }
    if (!crudo || typeof crudo !== 'object'
      || !Array.isArray(crudo.productos) || !Array.isArray(crudo.recetas) || !Array.isArray(crudo.eventos)) {
      return null;
    }
    const UNIDADES_VALIDAS = { g: 1, kg: 1, ml: 1, l: 1, un: 1 };

    const conMedidas = Array.isArray(crudo.medidas);
    const medidasLimpias = (conMedidas ? crudo.medidas : []).slice(0, 100).map(m => {
      if (!m || typeof m !== 'object') return null;
      const nombre = soloTexto(m.nombre, 20).trim();
      const factor = soloNumero(m.factor);
      const familia = (m.familia === 'peso' || m.familia === 'volumen' || m.familia === 'unidad') ? m.familia : null;
      if (!nombre || !factor || !familia) return null;
      return { id: soloTexto(m.id, 60) || uid(), nombre, familia, factor };
    }).filter(Boolean);

    const unidadValida = u => !!UNIDADES_VALIDAS[u] || medidasLimpias.some(m => m.id === u);
    const factorDe = u => {
      if (u === 'kg' || u === 'l') return 1000;
      const m = medidasLimpias.find(x => x.id === u);
      return m ? m.factor : 1;
    };

    const productos = crudo.productos.slice(0, 500).map(p => {
      if (!p || typeof p !== 'object') return null;
      const nombre = soloTexto(p.nombre).trim();
      const precio = soloNumero(p.precio);
      const contenido = soloNumero(p.contenido);
      if (!nombre || !precio || !contenido) return null;
      const unidad = unidadValida(p.unidad) ? p.unidad : 'un';
      return {
        id: soloTexto(p.id, 60) || uid(),
        nombre,
        formato: soloTexto(p.formato, 30) || 'paquete',
        precio: Math.round(precio),
        contenido,
        unidad,
        contenidoBase: contenido * factorDe(unidad),   // recalculado, no confiado
        proveedor: soloTexto(p.proveedor),
        notas: soloTexto(p.notas),
      };
    }).filter(Boolean);

    const recetas = crudo.recetas.slice(0, 300).map(r => {
      if (!r || typeof r !== 'object' || !Array.isArray(r.ingredientes)) return null;
      const nombre = soloTexto(r.nombre).trim();
      if (!nombre) return null;
      const ingredientes = r.ingredientes.slice(0, 50).map(i => {
        if (!i || typeof i !== 'object' || typeof i.productoId !== 'string') return null;
        const cantidadBase = soloNumero(i.cantidadBase);
        if (!cantidadBase) return null;
        return {
          productoId: i.productoId.slice(0, 60),
          cantidadBase,
          unidad: unidadValida(i.unidad) ? i.unidad : 'un',
        };
      }).filter(Boolean);
      if (!ingredientes.length) return null;
      return {
        id: soloTexto(r.id, 60) || uid(),
        nombre,
        emoji: soloTexto(r.emoji, 8) || '🍽️',
        porciones: soloTexto(r.porciones, 40) || 'porciones',
        ingredientes,
      };
    }).filter(Boolean);

    const eventos = crudo.eventos.slice(0, 300).map(e => {
      if (!e || typeof e !== 'object') return null;
      const nombre = soloTexto(e.nombre).trim();
      const invitados = soloNumero(e.invitados);
      if (!nombre || !invitados) return null;
      const preparaciones = (Array.isArray(e.preparaciones) ? e.preparaciones : []).slice(0, 100).map(p => {
        if (!p || typeof p !== 'object' || typeof p.recetaId !== 'string') return null;
        const porPersona = soloNumero(p.porPersona);
        if (!porPersona) return null;
        return { recetaId: p.recetaId.slice(0, 60), porPersona };
      }).filter(Boolean);
      return {
        id: soloTexto(e.id, 60) || uid(),
        nombre,
        fecha: (typeof e.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.fecha)) ? e.fecha : '',
        invitados: Math.round(invitados),
        dias: Math.max(1, Math.round(soloNumero(e.dias) || 1)),
        preparaciones,
      };
    }).filter(Boolean);

    return { productos, recetas, eventos, medidas: medidasLimpias, conMedidas };
  }

  function reemplazar(datos) {
    const d = cargar();
    d.productos = datos.productos;
    d.recetas = datos.recetas;
    d.eventos = datos.eventos;
    if (datos.conMedidas) d.medidas = datos.medidas;   // respaldos antiguos conservan las medidas actuales
    Conversion.registrar(d.medidas);
    guardar();
  }

  return {
    productos, producto, guardarProducto, eliminarProducto, recetasQueUsan,
    recetas, receta, guardarReceta, eliminarReceta, eventosQueUsan,
    eventos, evento, guardarEvento, eliminarEvento, duplicarEvento,
    medidas, medida, guardarMedida, eliminarMedida, usosDeMedida,
    hoyISO, recargar, siFallaGuardado,
    exportar, validarRespaldo, reemplazar,
  };
})();
