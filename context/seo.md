# SEO, Accesibilidad y Posicionamiento Web

## Qué es SEO

**SEO (Search Engine Optimization)** es el conjunto de prácticas para que una página aparezca bien posicionada en los resultados orgánicos (no pagados) de buscadores como Google.

El objetivo de Google es mostrar al usuario el resultado más **relevante y confiable** para su búsqueda. SEO es alinear tu página con esos criterios.

Hay dos grandes categorías:

- **On-page SEO:** lo que hacés dentro de tu propio sitio (contenido, HTML, velocidad, estructura).
- **Off-page SEO:** lo que pasa fuera de tu sitio (otros sitios que te enlazan, tu reputación en la web).

---

## Cómo funciona Google

Google tiene tres procesos separados:

```
Crawling  ──▶  Indexing  ──▶  Ranking
```

**Crawling:** Googlebot recorre la web siguiendo enlaces. Descubre páginas nuevas y actualiza las que ya conoce.

**Indexing:** analiza el contenido de cada página (texto, imágenes, estructura HTML) y lo almacena en su índice. Una página que no puede ser rastreada o indexada **no aparece en resultados**, sin importar qué tan buena sea.

**Ranking:** cuando alguien busca algo, Google ordena las páginas indexadas según cientos de señales. Las más relevantes y confiables aparecen primero.

---

## On-page SEO

### HTML semántico

El HTML semántico usa etiquetas que describen el **significado** del contenido, no solo su apariencia. Googlebot lee el HTML, y las etiquetas semánticas le dicen qué es importante.

```html
<!-- ❌ no semántico: no dice nada sobre el contenido -->
<div class="titulo">Guía de viaje a Japón</div>
<div class="parrafo">El mejor momento para visitar...</div>

<!-- ✅ semántico: estructura clara y significativa -->
<h1>Guía de viaje a Japón</h1>
<p>El mejor momento para visitar...</p>
```

Etiquetas semánticas clave:

| Etiqueta | Propósito |
|---|---|
| `<h1>` – `<h6>` | Jerarquía de títulos. Solo un `<h1>` por página. |
| `<nav>` | Navegación principal del sitio |
| `<main>` | Contenido principal de la página |
| `<article>` | Contenido independiente (post, noticia) |
| `<section>` | Sección temática dentro de un artículo |
| `<aside>` | Contenido secundario (sidebar, notas) |
| `<footer>` | Pie de página |
| `<header>` | Cabecera de la página o sección |

### Meta tags

Viven en el `<head>` y le dan información a Google y a redes sociales sobre la página.

```html
<head>
  <!-- título que aparece en los resultados de búsqueda -->
  <title>Guía de viaje a Japón 2024 | ViajeroExperto</title>

  <!-- descripción que aparece bajo el título en Google (no afecta ranking, sí el CTR) -->
  <meta name="description" content="Todo lo que necesitás saber para viajar a Japón: visados, temporadas, presupuesto y rutas recomendadas.">

  <!-- le dice a Google que esta URL es la versión "oficial" si hay duplicados -->
  <link rel="canonical" href="https://viajeroexperto.com/japon">

  <!-- controla cómo aparece al compartir en redes sociales (Open Graph) -->
  <meta property="og:title" content="Guía de viaje a Japón">
  <meta property="og:description" content="Todo lo que necesitás saber...">
  <meta property="og:image" content="https://viajeroexperto.com/img/japon.jpg">
</head>
```

**Longitudes recomendadas:**
- `<title>`: 50–60 caracteres. Google lo corta si es más largo.
- `meta description`: 150–160 caracteres.

### Jerarquía de headings

Google usa los headings para entender la estructura del contenido. La regla es simple: un solo `<h1>` que describe el tema principal, y `<h2>`–`<h6>` para subtemas en orden lógico.

```
h1: Guía de viaje a Japón
  h2: Cuándo ir
    h3: Temporada de cerezos
    h3: Temporada de nieve
  h2: Cómo llegar
    h3: Vuelos directos
    h3: Escalas recomendadas
  h2: Presupuesto
```

Saltar niveles (de `<h2>` a `<h4>` sin `<h3>`) confunde tanto a Google como a lectores de pantalla.

### URLs limpias

```
❌  /post?id=4821&cat=3
✅  /guia-viaje-japon
```

URLs descriptivas, con palabras clave y guiones (no guiones bajos) son más fáciles de indexar y de compartir.

### Alt text en imágenes

Googlebot no puede "ver" imágenes. El atributo `alt` es el texto que describe la imagen para el buscador y para usuarios con lector de pantalla.

```html
<!-- ❌ inútil para Google y para accesibilidad -->
<img src="foto.jpg" alt="imagen">

<!-- ✅ descriptivo y con contexto -->
<img src="monte-fuji.jpg" alt="Vista del Monte Fuji al amanecer desde el lago Kawaguchi">
```

### Core Web Vitals

Google mide la experiencia del usuario con métricas técnicas llamadas **Core Web Vitals**. Afectan el ranking directamente.

| Métrica | Qué mide | Objetivo |
|---|---|---|
| **LCP** (Largest Contentful Paint) | Cuánto tarda en aparecer el elemento más grande visible | < 2.5s |
| **INP** (Interaction to Next Paint) | Qué tan rápido responde la página a interacciones | < 200ms |
| **CLS** (Cumulative Layout Shift) | Cuánto se mueve el contenido mientras carga | < 0.1 |

Un CLS alto es cuando vas a tocar un botón y en ese momento aparece un banner y tocás algo que no querías. Google lo penaliza.

---

## Off-page SEO

### Backlinks

Los **backlinks** (enlaces de otros sitios hacia el tuyo) son la señal de autoridad más importante para Google. Un enlace de un sitio con alta autoridad (New York Times, Wikipedia) vale mucho más que cien enlaces de sitios sin relevancia.

Lo que importa no es la cantidad sino la **calidad y relevancia** del sitio que enlaza. Un artículo de viajes enlazado por una revista de turismo reconocida sube más que diez blogs de baja calidad.

### E-E-A-T

Google evalúa el contenido con el criterio **E-E-A-T**:

- **Experience** — el autor tiene experiencia real con el tema?
- **Expertise** — tiene conocimiento profundo del área?
- **Authoritativeness** — el sitio es reconocido como referente?
- **Trustworthiness** — el sitio es confiable, tiene HTTPS, políticas claras?

Es especialmente importante en contenido médico, financiero o legal (categoría **YMYL**: Your Money Your Life).

---

## Accesibilidad y ARIA

La accesibilidad web es hacer que el contenido sea usable por personas con discapacidades visuales, motoras, cognitivas o auditivas. Tiene impacto directo en SEO porque Google usa señales de accesibilidad y los lectores de pantalla consumen el DOM de forma similar a como lo hace Googlebot.

### Lectores de pantalla

Un lector de pantalla (NVDA, VoiceOver, JAWS) recorre el DOM y anuncia el contenido en voz. Para navegar, el usuario escucha los headings, los links y los elementos interactivos. Si el HTML no es semántico, el lector no puede construir una estructura navegable.

### ARIA — Accessible Rich Internet Applications

ARIA es un conjunto de atributos HTML que **complementan la semántica** cuando el HTML nativo no es suficiente. No reemplaza el HTML semántico: lo extiende para casos donde un componente personalizado no tiene equivalente nativo.

> **Regla de oro de ARIA:** si existe un elemento HTML nativo que hace lo mismo, usalo en lugar de ARIA. `<button>` es mejor que `<div role="button">`.

#### `aria-label`

Proporciona un nombre accesible a un elemento cuando el texto visible no es suficiente o no existe.

```html
<!-- un botón con solo un ícono no tiene texto legible -->
<button aria-label="Cerrar menú">✕</button>

<!-- sin aria-label, el lector solo diría "botón" o "tache" -->
```

#### `aria-labelledby`

Vincula un elemento con otro que ya existe en la página para usarlo como su etiqueta.

```html
<h2 id="titulo-modal">Confirmar eliminación</h2>
<dialog aria-labelledby="titulo-modal">
  <!-- el lector anuncia el dialog como "Confirmar eliminación, diálogo" -->
</dialog>
```

#### `aria-describedby`

Similar a `labelledby` pero para **descripción adicional**, no para el nombre principal.

```html
<input type="password" aria-describedby="hint-password">
<p id="hint-password">Mínimo 8 caracteres, una mayúscula y un número.</p>
```

#### `aria-hidden`

Oculta un elemento del árbol de accesibilidad. Útil para íconos decorativos que no aportan información.

```html
<!-- el ícono es decorativo; el texto ya describe la acción -->
<button>
  <svg aria-hidden="true">...</svg>
  Descargar PDF
</button>
```

#### `role`

Define el rol semántico de un elemento cuando no hay etiqueta HTML nativa adecuada.

```html
<div role="alert">Tu sesión expirará en 2 minutos.</div>
<div role="progressbar" aria-valuenow="65" aria-valuemin="0" aria-valuemax="100"></div>
```

Roles comunes: `alert`, `dialog`, `navigation`, `banner`, `main`, `complementary`, `button`, `tab`, `tabpanel`.

---

## Datos estructurados (Schema.org)

Los datos estructurados son metadatos en formato JSON-LD que se agregan al `<head>` para que Google entienda el contenido de forma precisa y lo muestre con **rich snippets** en los resultados.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Guía de viaje a Japón",
  "author": {
    "@type": "Person",
    "name": "Ana García"
  },
  "datePublished": "2024-03-15",
  "image": "https://viajeroexperto.com/img/japon.jpg"
}
</script>
```

Tipos comunes: `Article`, `Product`, `Recipe`, `FAQPage`, `BreadcrumbList`, `LocalBusiness`, `Event`.

Un sitio de recetas con Schema correcto puede aparecer en Google con la foto, el tiempo de cocción y la calificación directamente en el resultado — sin que el usuario entre al sitio.

---

## Sitemap y robots.txt

### sitemap.xml

Lista todas las URLs del sitio para que Googlebot las descubra aunque no haya enlaces que lleguen a ellas.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://viajeroexperto.com/guia-japon</loc>
    <lastmod>2024-03-15</lastmod>
    <priority>0.9</priority>
  </url>
</urlset>
```

### robots.txt

Le dice a los crawlers qué páginas **no** deben indexar.

```
User-agent: *
Disallow: /admin/
Disallow: /checkout/
Allow: /

Sitemap: https://viajeroexperto.com/sitemap.xml
```

> `robots.txt` no es seguridad. Es una convención que los bots respetan voluntariamente. Para proteger rutas reales, se necesita autenticación.

---

## Resumen: qué hace qué

| Técnica | Afecta SEO | Afecta accesibilidad |
|---|---|---|
| HTML semántico | ✅ | ✅ |
| Headings jerárquicos | ✅ | ✅ |
| Alt text en imágenes | ✅ | ✅ |
| Meta title / description | ✅ | ❌ |
| Core Web Vitals | ✅ | ✅ |
| ARIA labels | ❌ directo | ✅ |
| Schema.org | ✅ (rich snippets) | ❌ |
| Backlinks | ✅ | ❌ |
| robots.txt / sitemap | ✅ | ❌ |