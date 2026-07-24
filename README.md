# 🍳 Calculadora de la Chef

Calculadora de compras y presupuestos para eventos y banquetería. No es un
inventario ni un ERP: respondes **qué vas a preparar, para cuántas personas y
cuánto cuesta cada producto**, y la app calcula todo lo demás — conversiones,
rendimientos, redondeo a envases enteros y presupuesto final.

## Cómo usarla

Abre `index.html` en cualquier navegador (doble clic basta; no necesita
internet ni instalación). En el celular: copia la carpeta al teléfono o súbela
a cualquier hosting estático (Netlify, Vercel, GitHub Pages).

Los datos se guardan **en el navegador** (localStorage): si cambias de
navegador o de aparato, no se traspasan solos.

La app parte vacía: primero registras tus productos (qué compras, cuánto trae
cada paquete y su precio), después tus recetas y al final armas el evento.
Tiene modo claro y oscuro (botón 🌙/☀️ en la pantalla de inicio).

## Los 4 módulos

1. **🧺 Productos** — lo que compras: precio, formato (paquete, bolsa,
   botella…) y contenido (250 g, 3 L, 50 unidades…).
2. **🥪 Recetas** — cada preparación con sus ingredientes por porción. La app
   muestra al tiro cuánto rinde cada envase ("1 paquete de jamón rinde para
   83 pancitos") y cuánto cuesta cada porción.
3. **🎉 Eventos** — invitados × cantidad por persona por receta. Botón grande
   de "Modificar invitados" que recalcula todo.
4. **🛒 Presupuesto** — dentro de cada evento: qué comprar, cuántos envases
   (siempre redondeado hacia arriba), cuánto sobra, total, costo por invitado
   y costo por preparación.

## Arquitectura (para funcionalidades futuras)

| Archivo | Responsabilidad |
| --- | --- |
| `js/conversion.js` | Motor de conversión: g/kg, ml/L, fracciones (1/4, 1 1/2), decimales con coma, formato chileno de números y pesos. |
| `js/calculo.js` | Motor de cálculo: rendimientos, costo por porción, presupuesto (agrupa ingredientes repetidos entre recetas, redondea envases, calcula excedentes). |
| `js/datos.js` | Persistencia en localStorage + datos de ejemplo. CRUD de productos, recetas y eventos; duplicar evento. |
| `js/app.js` | Interfaz: vistas, formularios, buscador, navegación. Sin frameworks. |

Los motores no conocen la interfaz (reciben funciones para buscar datos), así
que agregar margen de ganancia, PDF, lista de compras imprimible o comparación
de proveedores solo requiere sumar funciones sobre el objeto que devuelve
`Calculo.presupuesto()`.

**Importante al publicar cambios:** cada vez que se modifique un `.css` o
`.js`, hay que subir el número de versión en DOS lugares para que todos los
navegadores (y el modo offline) reciban lo nuevo:

1. Las URLs de `index.html`: `?v=4` → `?v=5`.
2. En `sw.js`: la constante `CACHE` y la lista `ARCHIVOS`.

La app es instalable (PWA): funciona sin internet y, agregada a la pantalla
de inicio, el navegador no borra sus datos por falta de uso. Aun así, el
respaldo a archivo (Inicio → Copia de seguridad) es la red de seguridad real.
