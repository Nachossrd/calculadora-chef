/* =========================================================
   MOTOR DE CÁLCULO
   Rendimientos, costos por porción y presupuesto de eventos.
   Recibe funciones para buscar productos/recetas, así no
   depende de cómo se guardan los datos.
   ========================================================= */
const Calculo = (() => {
  'use strict';

  /* ¿Cuántas porciones salen de UN paquete/envase del producto?
     Ej: paquete de 250 g, cada pancito usa 3 g → 83 pancitos */
  function rendimiento(producto, cantidadBasePorPorcion) {
    if (!producto || !producto.contenidoBase || !cantidadBasePorPorcion) return null;
    return Math.floor(producto.contenidoBase / cantidadBasePorPorcion);
  }

  /* Precio de 1 g / 1 ml / 1 unidad del producto */
  function precioPorBase(producto) {
    return producto.contenidoBase ? producto.precio / producto.contenidoBase : 0;
  }

  /* ¿Se puede usar este ingrediente? El producto debe existir y su unidad
     ser de la misma familia (ej: si el producto pasó de gramos a unidades,
     la receta antigua queda inválida y se marca, en vez de calcular mal). */
  function utilizable(ing, producto) {
    return !!producto && Conversion.sonCompatibles(ing.unidad || 'un', producto.unidad);
  }

  /* Costo exacto de UNA porción de la receta (sin redondear paquetes) */
  function costoPorcion(receta, obtenerProducto) {
    let total = 0;
    for (const ing of receta.ingredientes) {
      const p = obtenerProducto(ing.productoId);
      if (utilizable(ing, p)) total += precioPorBase(p) * ing.cantidadBase;
    }
    return total;
  }

  /* Rendimiento de cada ingrediente de una receta */
  function rendimientos(receta, obtenerProducto) {
    const lista = [];
    for (const ing of receta.ingredientes) {
      const p = obtenerProducto(ing.productoId);
      if (!utilizable(ing, p)) continue;
      lista.push({ producto: p, ingrediente: ing, porciones: rendimiento(p, ing.cantidadBase) });
    }
    return lista;
  }

  /* ¿La receta tiene ingredientes con problemas?
     (producto eliminado, o cuya unidad cambió de familia) */
  function faltanProductos(receta, obtenerProducto) {
    return receta.ingredientes.some(ing => !utilizable(ing, obtenerProducto(ing.productoId)));
  }

  /* =========================================================
     PRESUPUESTO DE UN EVENTO
     - Junta ingredientes repetidos entre recetas (no duplica compras)
     - Redondea siempre hacia arriba a paquetes enteros
     - Calcula total, costo por invitado, costo por receta y excedentes
     ========================================================= */
  function presupuesto(evento, obtenerReceta, obtenerProducto) {
    const invitados = evento.invitados || 0;
    const porReceta = [];
    const necesidades = new Map();   // productoId → cantidad base necesaria
    let costoExactoTotal = 0;
    let recetasIncompletas = [];

    for (const item of (evento.preparaciones || [])) {
      const receta = obtenerReceta(item.recetaId);
      if (!receta) continue;

      const porciones = Math.ceil(invitados * (item.porPersona || 0));
      const costoUna = costoPorcion(receta, obtenerProducto);
      const costoExacto = costoUna * porciones;
      costoExactoTotal += costoExacto;

      if (faltanProductos(receta, obtenerProducto)) recetasIncompletas.push(receta.nombre);

      porReceta.push({
        receta,
        porPersona: item.porPersona,
        porciones,
        costo: costoExacto,
      });

      for (const ing of receta.ingredientes) {
        const p = obtenerProducto(ing.productoId);
        if (!utilizable(ing, p)) continue;
        necesidades.set(p.id, (necesidades.get(p.id) || 0) + ing.cantidadBase * porciones);
      }
    }

    const compras = [];
    let totalCompra = 0;
    let totalPaquetes = 0;

    for (const [productoId, base] of necesidades) {
      const producto = obtenerProducto(productoId);
      if (!producto || !producto.contenidoBase) continue;
      const paquetes = Math.ceil(base / producto.contenidoBase);   // compra mínima: siempre hacia arriba
      const costo = paquetes * producto.precio;
      const sobra = paquetes * producto.contenidoBase - base;
      compras.push({ producto, necesarioBase: base, paquetes, costo, sobraBase: sobra });
      totalCompra += costo;
      totalPaquetes += paquetes;
    }
    compras.sort((a, b) => b.costo - a.costo);
    porReceta.sort((a, b) => b.costo - a.costo);

    return {
      porReceta,
      compras,
      totalCompra,
      totalPaquetes,
      productosDistintos: compras.length,
      costoPorInvitado: invitados ? totalCompra / invitados : 0,
      redondeo: Math.max(0, totalCompra - costoExactoTotal),   // lo que agrega comprar paquetes enteros
      recetasIncompletas,
    };
  }

  return { rendimiento, precioPorBase, costoPorcion, rendimientos, faltanProductos, presupuesto };
})();
