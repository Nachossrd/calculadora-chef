/* =========================================================
   MOTOR DE CONVERSIÓN
   Convierte entre gramos, kilos, ml, litros y unidades, más
   las medidas que la usuaria defina (taza, cucharada, puñado…).
   Entiende fracciones (1/4, 1 1/2), decimales con coma (2,5)
   y el punto de miles chileno (1.500).
   Todo se guarda internamente en unidades base: g, ml, un.
   ========================================================= */
const Conversion = (() => {
  'use strict';

  /* Unidades fijas, siempre disponibles */
  const UNIDADES = {
    g:  { familia: 'peso',    factor: 1,    nombre: 'gramos',      corto: 'g'  },
    kg: { familia: 'peso',    factor: 1000, nombre: 'kilos',       corto: 'kg' },
    ml: { familia: 'volumen', factor: 1,    nombre: 'mililitros',  corto: 'ml' },
    l:  { familia: 'volumen', factor: 1000, nombre: 'litros',      corto: 'L'  },
    un: { familia: 'unidad',  factor: 1,    nombre: 'unidades',    corto: 'un' },
  };

  /* Medidas definidas por la usuaria: id → {nombre, familia, factor} */
  let personalizadas = {};

  function registrar(medidas) {
    personalizadas = {};
    for (const m of (medidas || [])) {
      if (m && m.id && typeof m.factor === 'number' && m.factor > 0) {
        personalizadas[m.id] = { familia: m.familia, factor: m.factor, nombre: m.nombre, corto: m.nombre };
      }
    }
  }

  /* Definición de una unidad; si no existe, se trata como 'unidades' */
  function def(unidad) {
    return UNIDADES[unidad] || personalizadas[unidad] || UNIDADES.un;
  }

  const corto = unidad => def(unidad).corto;

  // Formatos de compra: solo etiquetas, el contenido real va en la unidad de medida
  const FORMATOS = ['paquete', 'bolsa', 'caja', 'botella', 'bandeja', 'frasco', 'pote', 'lata', 'unidad', 'rollo', 'sobre', 'malla'];

  /* Convierte texto a número. Acepta:
     "3"  "2,5"  "2.5"  "1/4"  "3/4"  "1 1/2"  "1.500" (miles) */
  function parseCantidad(texto) {
    if (typeof texto === 'number') return isFinite(texto) ? texto : null;
    if (texto === null || texto === undefined) return null;
    let t = String(texto).trim();
    if (!t) return null;
    // Punto como separador de miles al estilo chileno: "1.500" → 1500
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
    t = t.replace(',', '.');
    if (t[0] === '.') t = '0' + t;   // ",5" o ".5" → 0.5

    const mixto = t.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixto) {
      const den = parseInt(mixto[3], 10);
      return den ? parseFloat(mixto[1]) + parseInt(mixto[2], 10) / den : null;
    }
    const frac = t.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (frac) {
      const den = parseFloat(frac[2]);
      return den ? parseFloat(frac[1]) / den : null;
    }
    if (!/^\d+(\.\d+)?$/.test(t)) return null;
    const n = parseFloat(t);
    return isFinite(n) ? n : null;
  }

  /* Precio en pesos chilenos: "6.200" o "6200" → 6200.
     El peso no usa decimales: "1.990,50" y "1990.50" → 1990 */
  function parsePrecio(texto) {
    if (typeof texto === 'number') return Math.round(texto);
    const entero = String(texto || '').split(',')[0].replace(/\.\d{1,2}$/, '');
    const digitos = entero.replace(/[^\d]/g, '');
    return digitos ? parseInt(digitos, 10) : null;
  }

  /* Cantidad en cierta unidad → cantidad en unidad base (g / ml / un) */
  function aBase(cantidad, unidad) {
    return cantidad * def(unidad).factor;
  }

  /* Cantidad base → cantidad en la unidad indicada */
  function desdeBase(base, unidad) {
    return base / def(unidad).factor;
  }

  function familiaDe(unidad) {
    return def(unidad).familia;
  }

  /* Unidades de una familia: fijas primero, luego las de la usuaria */
  function unidadesDeFamilia(familia) {
    return Object.keys(UNIDADES).filter(k => UNIDADES[k].familia === familia)
      .concat(Object.keys(personalizadas).filter(k => personalizadas[k].familia === familia));
  }

  /* Todas las unidades elegibles al registrar un producto */
  function unidadesElegibles() {
    return Object.keys(UNIDADES).concat(Object.keys(personalizadas));
  }

  function sonCompatibles(unidadA, unidadB) {
    return familiaDe(unidadA) === familiaDe(unidadB);
  }

  /* Número con formato chileno: punto de miles, coma decimal */
  function numero(n, decimales = 2) {
    const factor = Math.pow(10, decimales);
    const redondeado = Math.round(n * factor) / factor;
    return redondeado.toLocaleString('es-CL', { maximumFractionDigits: decimales });
  }

  /* Pesos chilenos: 24800 → "$24.800" */
  function pesos(n) {
    return '$' + Math.round(n || 0).toLocaleString('es-CL');
  }

  /* Muestra una cantidad base en la unidad más cómoda de leer:
     810 → "810 g" · 1500 → "1,5 kg" · 200 (volumen) → "200 ml" */
  function cantidadLegible(base, familia) {
    if (familia === 'peso') {
      return base >= 1000 ? numero(base / 1000) + ' kg' : numero(base) + ' g';
    }
    if (familia === 'volumen') {
      return base >= 1000 ? numero(base / 1000) + ' L' : numero(base) + ' ml';
    }
    return numero(base) + (Math.round(base * 100) / 100 === 1 ? ' unidad' : ' unidades');
  }

  /* Para rellenar inputs: base → texto editable en la unidad elegida ("2,5") */
  function textoEditable(base, unidad) {
    const v = desdeBase(base, unidad);
    const limpio = Math.round(v * 1000) / 1000;
    return String(limpio).replace('.', ',');
  }

  return {
    UNIDADES, FORMATOS,
    registrar, corto, unidadesElegibles,
    parseCantidad, parsePrecio,
    aBase, desdeBase, familiaDe, unidadesDeFamilia, sonCompatibles,
    numero, pesos, cantidadLegible, textoEditable,
  };
})();
