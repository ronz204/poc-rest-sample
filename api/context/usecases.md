# Use Cases: Feature Flags Engine

> Cada caso de uso es una acción de negocio completa: qué necesita, qué valida, qué hace, qué puede fallar. **No habla de HTTP** — nada de verbos, rutas, ni status codes; eso vive en `contracts.md`. Aquí solo la lógica de aplicación, pensada para ser testeable sin servidor ni base de datos real (ver `overview.md`).

Agrupados según las 5 funcionalidades de `overview.md`. El rollout no tiene casos de uso propios — es un atributo de `AddRule`/`UpdateRule`, no una entidad con ciclo de vida propio.

```
Flags  →  Reglas de targeting  →  Segmentos  →  Evaluación
```

---

## Flags

### `CreateFlag`
Registra un flag nuevo, **siempre apagado por default**.

| | |
|---|---|
| **Entrada** | `key`, `name`, `short`, `default?` (false si se omite) |
| **Errores** | `key` ya existe → conflicto, no validación genérica |

**Reglas:**
- `key` única en todo el sistema — es el identificador que los clientes usan para consultar.
- `key` restringida a formato slug (minúsculas, guiones) — va a vivir en una URL.
- `enabled` siempre arranca en `false`. No existe "crear ya activo" — activar es un paso separado y explícito (`EnableFlag`), para evitar prender algo a medio configurar por accidente.

---

### `GetFlag`
Devuelve un flag con su **árbol completo**: reglas ordenadas por prioridad, cada una con su segmento expandido.

| | |
|---|---|
| **Entrada** | `key` |
| **Errores** | no existe → `404` explícito (nunca un `false` silencioso, ver `concepts.md`) |

**Por qué el árbol completo:** quien administra flags necesita ver todo el targeting de un vistazo, no reconstruirlo con N llamadas. Es una decisión de *lectura agregada* — no implica que el modelo esté denormalizado.

---

### `ListFlags`
Devuelve todos los flags, **resumidos** (sin expandir reglas — eso es trabajo de `GetFlag`).

| | |
|---|---|
| **Entrada** | — |
| **Errores** | — |

Listar con el árbol completo de cada flag sería pesado e innecesario la mayoría de las veces — quien lista quiere panorama general.

---

### `UpdateFlag`
Actualiza metadata editable.

| | |
|---|---|
| **Entrada** | `name?`, `short?`, `default?` |
| **No permite** | cambiar `key` (es estable, no se renombra) |
| **Errores** | no existe → `404` |

---

### `EnableFlag` / `DisableFlag`
Prende o apaga el interruptor global (`enabled`). El kill switch.

| | |
|---|---|
| **Entrada** | `key` (sin body) |
| **Errores** | no existe → `404`. Repetir la acción (activar lo ya activo) **no es error** — es idempotente |

**Por qué separados de `UpdateFlag`:** es la operación más crítica y frecuente del sistema. Como endpoint/caso de uso propio, queda explícita en logs y código — se ve "esto fue un cambio de estado", no "un PATCH genérico que tocó algo".

---

### `DeleteFlag`
Elimina el flag y, en cascada, sus reglas (`Flag → Rule` es composición, ver `database.md`).

| | |
|---|---|
| **Entrada** | `key` |
| **No elimina** | los segmentos referenciados — son asociación, no composición; otros flags pueden usarlos |
| **Errores** | no existe → `404` |

---

## Reglas de targeting

> Anidadas bajo un flag — una regla no existe sin su flag.

### `AddRule`
Agrega una regla de targeting a un flag.

| | |
|---|---|
| **Entrada** | `segmentId` (obligatorio — toda regla pasa por un segmento, sin excepción), `priority`, `outcome` (bool), `rollout?` (0-100, default 100) |
| **Errores** | flag no existe · segmento no existe · `rollout` fuera de rango |

**Decisión pendiente:** el schema no impide que dos reglas del mismo flag compartan `priority` (no hay constraint de unicidad sobre `(flagId, priority)`). Hay que decidir explícitamente qué pasa en ese caso — ¿error de validación? ¿orden indefinido? — antes de implementar, no al descubrir el bug.

---

### `UpdateRule`
Modifica una regla existente — `priority`, `outcome`, `rollout`, o `segmentId`.

| | |
|---|---|
| **Entrada** | cualquier subconjunto de los campos de la regla |
| **Errores** | regla no existe · (si cambia `segmentId`) el nuevo segmento no existe |

---

### `ReorderRules`
Recibe el **nuevo orden completo** de las reglas de un flag y actualiza todas las `priority` a la vez.

| | |
|---|---|
| **Entrada** | lista completa de `ruleId`s, en el orden deseado |
| **Errores** | flag no existe · la lista no corresponde exactamente al conjunto actual de reglas (faltan/sobran/repiten) |

**Por qué no es solo `UpdateRule` repetido:** reordenar afecta a *todas* las reglas a la vez. Llamadas independientes dejarían una ventana con el orden a medio camino. Esto se aplica como una sola operación atómica.

---

### `RemoveRule`
Elimina una regla del flag.

| | |
|---|---|
| **Entrada** | `ruleId` |
| **Errores** | no existe → `404` |

---

## Segmentos

> Recurso independiente — no pertenecen a ningún flag, varias reglas de varios flags pueden referenciar el mismo.

### `CreateSegment`
Crea un segmento, opcionalmente con condiciones iniciales.

| | |
|---|---|
| **Entrada** | `key`, `name`, `conditions[]` (puede ser vacía → "siempre matchea") |
| **Errores** | `key` duplicada · `operator` desconocido · `value` con forma incompatible con su `operator` |

**Reglas:**
- `key` única, mismo criterio que `Flag`.
- Cada condición necesita un `operator` de un conjunto cerrado conocido (`equals`, `in`, ...) — validación de aplicación, no de base de datos (ver `database.md`).
- La forma de `value` debe ser coherente con su `operator` (`in` → array, `equals` → valor simple).

---

### `GetSegment` / `ListSegments`
Devuelve un segmento con sus condiciones, o la lista completa.

| | |
|---|---|
| **Entrada** | `key` (solo `GetSegment`) |
| **Errores** | no existe → `404` (solo `GetSegment`) |

Útil que `GetSegment` indique qué flags/reglas lo usan — no es obligatorio para el POC, pero ayuda a decidir si un borrado (`DeleteSegment`) es seguro.

---

### `UpdateSegment`
Actualiza `name` y/o **reemplaza completamente** las condiciones.

| | |
|---|---|
| **Entrada** | `name?`, `conditions[]?` (reemplazo completo, no parcial) |
| **Errores** | no existe → `404` · mismas validaciones de forma que `CreateSegment` |

**Por qué reemplazo completo y no edición parcial:** las condiciones, en conjunto, son la definición atómica del grupo. Editar una suelta sin mirar las demás puede dejar el conjunto en un estado que nadie revisó.

---

### `DeleteSegment`
Elimina el segmento y sus condiciones (composición fuerte, ver `database.md`).

| | |
|---|---|
| **Entrada** | `key` |
| **Errores** | no existe → `404` · **en uso por alguna regla → conflicto** |

**El caso más delicado de este grupo:** `Rule → Segment` no tiene `CASCADE` (es asociación). Si una regla activa todavía referencia el segmento, la base de datos debería impedir el borrado vía foreign key. El caso de uso tiene que anticipar esto y devolver algo explícito ("en uso por N reglas") — no dejar que se filtre un error crudo de constraint violation.

---

## ⚡ Evaluación

### `EvaluateFlag`
**El caso de uso central de todo el sistema.** Dado un flag y un contexto, determina si está activo.

| | |
|---|---|
| **Entrada** | `key` del flag, `context` (objeto plano: `{ country, plan, ... }`) |
| **Errores** | flag no existe → `404`. Atributo faltante en el contexto **no es error** — la regla simplemente no matchea o se salta (decisión de implementación, ver nota en `contracts.md`) |

**Lógica** (detallada en `concepts.md` / `database.md`):

1. Buscar flag por `key` → si no existe, error.
2. `enabled = false` → responder `default`, sin tocar reglas.
3. Recorrer reglas por `priority`. Por cada una: resolver su segmento contra el contexto → si matchea, aplicar filtro de `rollout` (hash determinístico) → si "gana", devolver `outcome`.
4. Ninguna regla gana → responder `default`.

**Por qué debe ser una función pura:** se invoca constantemente desde sistemas externos (hot path). Tiene que poder recibir el flag *ya cargado en memoria* (desde caché) + el contexto, y devolver un resultado sin tocar la base de datos durante la evaluación misma. La carga a la base ocurre al poblar/refrescar el caché, no aquí.

---

### `EvaluateAllFlags` — fuera de alcance por ahora, a confirmar
Dado solo un contexto, devuelve el estado de **todos** los flags activos a la vez.

| | |
|---|---|
| **Entrada** | `context` |
| **Por qué tentador** | un cliente típico (frontend) normalmente quiere el estado de varios flags de una sola llamada, no uno por uno — patrón común en SDKs reales |

**No estaba en la lista original de `overview.md`.** Agregarlo sin decidirlo a propósito sería el tipo de scope creep que `overview.md` busca evitar — hay que confirmarlo explícitamente antes de incluirlo en `contracts.md`.

---

Con esto cerrado — qué hace cada caso de uso, qué valida, qué puede fallar — el siguiente paso es `contracts.md`: la traducción de cada uno a un endpoint HTTP concreto.