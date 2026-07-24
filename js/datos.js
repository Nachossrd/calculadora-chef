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

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(db));
    } catch (e) {
      /* almacenamiento lleno o bloqueado: la app sigue funcionando en memoria */
    }
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

  return {
    productos, producto, guardarProducto, eliminarProducto, recetasQueUsan,
    recetas, receta, guardarReceta, eliminarReceta, eventosQueUsan,
    eventos, evento, guardarEvento, eliminarEvento, duplicarEvento,
    hoyISO,
  };
})();
