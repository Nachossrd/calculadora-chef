/* =========================================================
   PERSISTENCIA
   Guarda productos, recetas y eventos en el navegador
   (localStorage). La primera vez carga ejemplos para que
   la app no parta vacía.
   ========================================================= */
const Datos = (() => {
  'use strict';

  const CLAVE = 'calculadora-chef-v1';
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
    return { productos: [], recetas: [], eventos: [], sembrada: false, mostrarBienvenida: false };
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
    if (!db.sembrada && !db.productos.length && !db.recetas.length && !db.eventos.length) {
      sembrar();
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

  /* ---------- Bienvenida ---------- */
  const mostrarBienvenida = () => !!cargar().mostrarBienvenida;
  function cerrarBienvenida() {
    cargar().mostrarBienvenida = false;
    guardar();
  }

  /* ---------- Datos de ejemplo ---------- */
  function sembrar() {
    db.productos = [
      { id: 'p-pan',    nombre: 'Pan cocktail',      formato: 'bolsa',   precio: 2800,  contenido: 50,  unidad: 'un', contenidoBase: 50,   proveedor: 'Amasandería', notas: '' },
      { id: 'p-jamon',  nombre: 'Jamón Colonial',    formato: 'paquete', precio: 6200,  contenido: 250, unidad: 'g',  contenidoBase: 250,  proveedor: 'Jumbo',       notas: '' },
      { id: 'p-queso',  nombre: 'Queso laminado',    formato: 'paquete', precio: 5200,  contenido: 500, unidad: 'g',  contenidoBase: 500,  proveedor: 'Jumbo',       notas: '' },
      { id: 'p-mayo',   nombre: 'Mayonesa',          formato: 'pote',    precio: 2590,  contenido: 750, unidad: 'g',  contenidoBase: 750,  proveedor: 'Líder',       notas: '' },
      { id: 'p-bebida', nombre: 'Bebida 3 litros',   formato: 'botella', precio: 2590,  contenido: 3,   unidad: 'l',  contenidoBase: 3000, proveedor: 'Líder',       notas: '' },
      { id: 'p-cafe',   nombre: 'Café instantáneo',  formato: 'frasco',  precio: 5990,  contenido: 170, unidad: 'g',  contenidoBase: 170,  proveedor: 'Jumbo',       notas: '' },
      { id: 'p-torta',  nombre: 'Torta de mil hojas', formato: 'unidad', precio: 28000, contenido: 30,  unidad: 'un', contenidoBase: 30,   proveedor: 'Pastelería',  notas: 'Cada torta rinde 30 porciones' },
    ];
    db.recetas = [
      {
        id: 'r-pancito', nombre: 'Pancito cocktail jamón queso', emoji: '🥪', porciones: 'pancitos',
        ingredientes: [
          { productoId: 'p-pan',   cantidadBase: 1, unidad: 'un' },
          { productoId: 'p-jamon', cantidadBase: 3, unidad: 'g' },
          { productoId: 'p-queso', cantidadBase: 4, unidad: 'g' },
          { productoId: 'p-mayo',  cantidadBase: 2, unidad: 'g' },
        ],
      },
      {
        id: 'r-bebida', nombre: 'Vaso de bebida', emoji: '🥤', porciones: 'vasos',
        ingredientes: [{ productoId: 'p-bebida', cantidadBase: 180, unidad: 'ml' }],
      },
      {
        id: 'r-cafe', nombre: 'Taza de café', emoji: '☕', porciones: 'tazas',
        ingredientes: [{ productoId: 'p-cafe', cantidadBase: 2, unidad: 'g' }],
      },
      {
        id: 'r-torta', nombre: 'Porción de torta', emoji: '🍰', porciones: 'porciones',
        ingredientes: [{ productoId: 'p-torta', cantidadBase: 1, unidad: 'un' }],
      },
    ];
    db.eventos = [
      {
        id: 'e-sofia', nombre: 'Cumpleaños Sofía', fecha: hoyISO(16), invitados: 45, dias: 2,
        preparaciones: [
          { recetaId: 'r-pancito', porPersona: 6 },
          { recetaId: 'r-bebida',  porPersona: 2 },
          { recetaId: 'r-cafe',    porPersona: 1 },
          { recetaId: 'r-torta',   porPersona: 1 },
        ],
      },
    ];
    db.sembrada = true;
    db.mostrarBienvenida = true;
    guardar();
  }

  return {
    productos, producto, guardarProducto, eliminarProducto, recetasQueUsan,
    recetas, receta, guardarReceta, eliminarReceta, eventosQueUsan,
    eventos, evento, guardarEvento, eliminarEvento, duplicarEvento,
    mostrarBienvenida, cerrarBienvenida, hoyISO,
  };
})();
