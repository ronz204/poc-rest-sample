# Render Tree: DOM, CSSOM y el proceso de renderizado

## El problema que resuelve

El navegador recibe HTML y CSS como texto plano. Texto que no puede dibujar directamente en pantalla. Para convertirlo en píxeles necesita construir estructuras intermedias, combinarlas y ejecutar una serie de pasos en orden. Ese proceso completo se llama **Critical Rendering Path**.

---

## DOM — Document Object Model

Cuando el navegador descarga el HTML, lo **parsea** (analiza carácter por carácter) y construye un árbol de objetos en memoria llamado **DOM**. Cada etiqueta HTML se convierte en un nodo del árbol.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Mi página</title>
  </head>
  <body>
    <h1>Hola</h1>
    <p>Texto <span>destacado</span></p>
  </body>
</html>
```

Se convierte en:

```
Document
└── html
    ├── head
    │   └── title
    │       └── "Mi página"  (nodo de texto)
    └── body
        ├── h1
        │   └── "Hola"
        └── p
            ├── "Texto "
            └── span
                └── "destacado"
```

El DOM es la representación **estructural** del documento. Define qué elementos existen y cómo se anidan, pero no sabe nada de colores, tamaños ni layouts.

### El DOM es vivo

No es una foto estática. JavaScript puede modificarlo en cualquier momento: agregar nodos, eliminarlos, cambiar atributos. Cuando el DOM cambia, el navegador tiene que recalcular qué parte de la página actualizar.

---

## CSSOM — CSS Object Model

En paralelo al DOM, el navegador parsea el CSS y construye el **CSSOM**: un árbol equivalente que representa todas las reglas de estilo y cómo se aplican a cada elemento.

```css
body { font-size: 16px; }
h1   { color: navy; font-size: 2em; }
p    { color: gray; }
span { font-weight: bold; }
```

Se convierte en:

```
root
└── body  [font-size: 16px]
    ├── h1    [color: navy, font-size: 32px]  ← 2em de 16px
    └── p     [color: gray, font-size: 16px]  ← hereda body
        └── span  [font-weight: bold, color: gray, font-size: 16px]  ← hereda p
```

Cada nodo del CSSOM tiene sus estilos **computados**: ya no hay `em`, `inherit` ni `%` — todo está resuelto a valores absolutos.

### Por qué el CSSOM bloquea el renderizado

El navegador no puede construir el Render Tree hasta tener el CSSOM completo. La razón: una regla CSS al final del archivo puede sobrescribir estilos definidos al principio. No hay forma segura de renderizar nada hasta haber procesado todo el CSS.

Esto hace al CSS **render-blocking**: mientras se descarga y parsea un archivo CSS, el navegador detiene el renderizado completo.

> Por eso `<link rel="stylesheet">` va en el `<head>`: para que el CSS empiece a descargarse lo antes posible y el bloqueo sea lo más corto posible.

---

## Render Tree

Una vez que el DOM y el CSSOM están construidos, el navegador los **combina** en el Render Tree: un nuevo árbol que contiene solo los elementos visibles, cada uno con sus estilos computados finales.

```
DOM                    CSSOM                  Render Tree
───────────────        ────────────────       ──────────────────────
html                   body [16px]            body [16px]
├── head               ├── h1 [navy,32px]     ├── h1 [navy, 32px]
│   └── title          └── p [gray]               └── "Hola"
└── body                   └── span [bold]    └── p [gray, 16px]
    ├── h1                                        ├── "Texto "
    └── p                                         └── span [bold, gray]
        └── span                                      └── "destacado"
```

### Qué elementos se excluyen del Render Tree

No todo el DOM entra al Render Tree:

- Nodos del `<head>` (title, meta, scripts, links) — no se renderizan.
- Elementos con `display: none` — no ocupan espacio ni se pintan.
- Comentarios HTML.

> **`display: none` vs `visibility: hidden`:** con `display: none` el nodo no existe en el Render Tree. Con `visibility: hidden` sí existe (ocupa espacio), pero es invisible. Son comportamientos distintos.

---

## El Critical Rendering Path completo

El Render Tree es solo el punto medio. Para llegar a píxeles en pantalla el navegador ejecuta cuatro pasos más:

```
HTML  ──parse──▶  DOM  ─┐
                         ├──▶  Render Tree ──▶  Layout ──▶  Paint ──▶  Composite
CSS   ──parse──▶  CSSOM ─┘
```

### 1. Layout (Reflow)

El navegador recorre el Render Tree y calcula la **posición y tamaño exacto** de cada elemento en pantalla: dónde empieza, cuánto mide, cómo afecta a los elementos vecinos.

El resultado es la **caja** de cada elemento (box model: content + padding + border + margin).

```
┌─────────────────── margin ───────────────────┐
│  ┌──────────────── border ────────────────┐  │
│  │  ┌───────────── padding ────────────┐  │  │
│  │  │         content (texto)          │  │  │
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

Layout es costoso. Cambiar el tamaño de un elemento puede afectar la posición de todos los que lo rodean, forzando un recálculo en cascada. A esto se le llama **reflow**.

### 2. Paint

Una vez que el navegador sabe dónde va cada cosa, pinta los píxeles: colores de fondo, bordes, texto, sombras, imágenes. No todos los elementos se pintan en el mismo orden ni en la misma capa.

### 3. Composite

El navegador divide la página en **capas** y las ensambla en el orden correcto para producir la imagen final. Elementos como `position: fixed`, `transform`, `opacity` y `will-change` tienen su propia capa y se componen por separado por la GPU.

Esto importa para performance: animar `transform` u `opacity` solo dispara Composite (barato). Animar `width` o `top` dispara Layout + Paint + Composite (caro).

---

## Qué dispara cada etapa

| Cambio | Layout | Paint | Composite |
|---|---|---|---|
| Cambiar `width`, `height`, `margin` | ✅ | ✅ | ✅ |
| Cambiar `color`, `background-color` | ❌ | ✅ | ✅ |
| Cambiar `transform`, `opacity` | ❌ | ❌ | ✅ |

Regla práctica: **animar solo `transform` y `opacity`** para animaciones fluidas sin costo de Layout ni Paint.

---

## Scripts y el parser de HTML

JavaScript también puede bloquear el renderizado porque puede modificar el DOM y el CSSOM mientras se construyen.

```html
<!-- bloquea el parser: descarga y ejecuta antes de continuar -->
<script src="app.js"></script>

<!-- descarga en paralelo, ejecuta cuando termina la descarga -->
<script src="app.js" async></script>

<!-- descarga en paralelo, ejecuta cuando el DOM está listo -->
<script src="app.js" defer></script>
```

`defer` es la opción correcta para la mayoría de scripts: no bloquea el parser, garantiza que el DOM esté listo y respeta el orden de los scripts.

---

## Resumen del flujo

```
Descarga HTML
     │
     ▼
Parse HTML ──────────────────────────────────────────▶ DOM
     │                                                  │
     ├── encuentra <link CSS> → descarga CSS            │
     │        │                                         │
     │        ▼                                         │
     │   Parse CSS ──────────────────────────────▶ CSSOM
     │                                                  │
     └──────────────────────────────────────────────────┤
                                                        ▼
                                                  Render Tree
                                                        │
                                                        ▼
                                                     Layout
                                                        │
                                                        ▼
                                                      Paint
                                                        │
                                                        ▼
                                                   Composite
                                                        │
                                                        ▼
                                                   🖥️ pantalla
```