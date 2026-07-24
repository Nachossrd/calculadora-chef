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

  function hoyISO(diasExtra = 0) {
    const f = new Date();
    f.setDate(f.getDate() + diasExtra);
    const p = n => String(n).padStart(2, '0');
    return f.getFullYear() + '-' + p(f.getMonth() + 1) + '-' + p(f.getDate());
  }

  function vacia() {
    return { productos: [], recetas: [], eventos: [], ejemploRetirado: true };
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
    if (!db.ejemploRetirado) {
      db.productos = db.productos.filter(p => !IDS_EJEMPLO.includes(p.id));
      db.recetas = db.recetas.filter(r => !IDS_EJEMPLO.includes(r.id));
      db.eventos = db.eventos.filter(e => !IDS_EJEMPLO.includes(e.id));
      db.ejemploRetirado = true;
      guardar();
    }
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
      version: 1,
      fecha: new Date().toISOString(),
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

    const productos = crudo.productos.slice(0, 500).map(p => {
      if (!p || typeof p !== 'object') return null;
      const nombre = soloTexto(p.nombre).trim();
      const precio = soloNumero(p.precio);
      const contenido = soloNumero(p.contenido);
      if (!nombre || !precio || !contenido) return null;
      const unidad = UNIDADES_VALIDAS[p.unidad] ? p.unidad : 'un';
      return {
        id: soloTexto(p.id, 60) || uid(),
        nombre,
        formato: soloTexto(p.formato, 30) || 'paquete',
        precio: Math.round(precio),
        contenido,
        unidad,
        contenidoBase: Conversion.aBase(contenido, unidad),   // recalculado, no confiado
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
          unidad: UNIDADES_VALIDAS[i.unidad] ? i.unidad : 'un',
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

    return { productos, recetas, eventos };
  }

  function reemplazar(datos) {
    const d = cargar();
    d.productos = datos.productos;
    d.recetas = datos.recetas;
    d.eventos = datos.eventos;
    guardar();
  }

  return {
    productos, producto, guardarProducto, eliminarProducto, recetasQueUsan,
    recetas, receta, guardarReceta, eliminarReceta, eventosQueUsan,
    eventos, evento, guardarEvento, eliminarEvento, duplicarEvento,
    hoyISO, recargar, siFallaGuardado,
    exportar, validarRespaldo, reemplazar,
  };
})();
