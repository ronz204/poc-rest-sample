# Contracts: API REST del Feature Flags Engine

> El mapeo HTTP de cada caso de uso en `usecases.md`. Método, ruta, forma de request/response, códigos de estado.

## Convenciones generales

| Convención | Decisión |
|---|---|
| **Identificación** | flags y segments por su `key` legible en la URL (`/flags/new-checkout`), no por `id` UUID interno |
| **Reglas** | sub-recurso del flag — `/flags/:key/rules/...` (no existen sin su flag) |
| **Segmentos** | recurso de primer nivel — `/segments/...` (independientes, reusables entre flags) |
| **Formato** | JSON en request y response, `Content-Type: application/json` |

**Forma de error, consistente en todos los endpoints:**
```json
{ "error": { "code": "FLAG_NOT_FOUND", "message": "No existe un flag con key 'new-checkout'" } }
```
`code` es estable y pensado para que el cliente reaccione programáticamente — no solo mostrar `message`.

```
Flags  →  Reglas de targeting  →  Segmentos  →  Evaluación
```

---

## Flags

### Crear un flag
| | |
|---|---|
| **Caso de uso** | `CreateFlag` |
| **Endpoint** | `POST /flags` |
| **Éxito** | `201 Created` |
| **Errores** | `409` `FLAG_KEY_ALREADY_EXISTS` · `422` `VALIDATION_ERROR` |

```json
// Request
{
  "key": "new-checkout",
  "name": "Nuevo flujo de checkout",
  "short": "Rediseño del checkout con un paso menos",
  "default": false
}
```
```json
// Response 201
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "key": "new-checkout",
  "name": "Nuevo flujo de checkout",
  "short": "Rediseño del checkout con un paso menos",
  "enabled": false,
  "default": false,
  "createdAt": "2026-06-28T02:00:00Z",
  "updatedAt": "2026-06-28T02:00:00Z"
}
```

---

### Listar flags
| | |
|---|---|
| **Caso de uso** | `ListFlags` |
| **Endpoint** | `GET /flags` |
| **Éxito** | `200 OK` |
| **Errores** | — |

```json
// Response 200
[
  { "key": "new-checkout", "name": "Nuevo flujo de checkout", "enabled": false },
  { "key": "dark-mode", "name": "Modo oscuro", "enabled": true }
]
```

---

### Obtener un flag (con su árbol de reglas)
| | |
|---|---|
| **Caso de uso** | `GetFlag` |
| **Endpoint** | `GET /flags/:key` |
| **Éxito** | `200 OK` |
| **Errores** | `404` `FLAG_NOT_FOUND` |

```json
// Response 200
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "key": "new-checkout",
  "name": "Nuevo flujo de checkout",
  "enabled": true,
  "default": false,
  "rules": [
    {
      "id": "rule-id-1",
      "priority": 0,
      "outcome": true,
      "rollout": 100,
      "segment": {
        "id": "seg-id-1",
        "key": "cr-premium",
        "name": "Costa Rica, plan premium",
        "conditions": [
          { "attribute": "country", "operator": "equals", "value": "CR" },
          { "attribute": "plan", "operator": "equals", "value": "premium" }
        ]
      }
    }
  ]
}
```

---

### Actualizar metadata de un flag
| | |
|---|---|
| **Caso de uso** | `UpdateFlag` |
| **Endpoint** | `PATCH /flags/:key` |
| **Éxito** | `200 OK` |
| **Errores** | `404` `FLAG_NOT_FOUND` |

```json
// Request
{ "name": "Checkout v2", "short": "Segunda iteración del checkout" }
```

No acepta `key` (inmutable) ni `enabled` (tiene endpoints dedicados, abajo).

---

### Activar / Desactivar un flag
| | |
|---|---|
| **Caso de uso** | `EnableFlag` / `DisableFlag` |
| **Endpoint** | `POST /flags/:key/enable` · `POST /flags/:key/disable` |
| **Éxito** | `200 OK` (idempotente — repetir la acción no es error) |
| **Errores** | `404` `FLAG_NOT_FOUND` |

Sin body. **Por qué endpoint propio y no parte de `PATCH`:** es el kill switch — la operación más crítica del sistema. Verla explícita en la URL (`/disable`) hace la intención inequívoca en logs y auditoría futura, sin tener que inspeccionar qué campo cambió un PATCH genérico.

---

### Eliminar un flag
| | |
|---|---|
| **Caso de uso** | `DeleteFlag` |
| **Endpoint** | `DELETE /flags/:key` |
| **Éxito** | `204 No Content` |
| **Errores** | `404` `FLAG_NOT_FOUND` |

---

## Reglas de targeting

### Agregar una regla
| | |
|---|---|
| **Caso de uso** | `AddRule` |
| **Endpoint** | `POST /flags/:key/rules` |
| **Éxito** | `201 Created` |
| **Errores** | `404` `FLAG_NOT_FOUND` / `SEGMENT_NOT_FOUND` · `422` `VALIDATION_ERROR` (rollout fuera de 0-100) |

```json
// Request
{ "segmentId": "seg-id-1", "priority": 0, "outcome": true, "rollout": 100 }
```

---

### Actualizar una regla
| | |
|---|---|
| **Caso de uso** | `UpdateRule` |
| **Endpoint** | `PATCH /flags/:key/rules/:ruleId` |
| **Éxito** | `200 OK` |
| **Errores** | `404` `RULE_NOT_FOUND` / `SEGMENT_NOT_FOUND` |

Body: cualquier subconjunto de `segmentId`, `priority`, `outcome`, `rollout`.

---

### Reordenar todas las reglas de un flag
| | |
|---|---|
| **Caso de uso** | `ReorderRules` |
| **Endpoint** | `PUT /flags/:key/rules/order` |
| **Éxito** | `200 OK` |
| **Errores** | `404` `FLAG_NOT_FOUND` · `422` `VALIDATION_ERROR` (lista no corresponde al set actual) |

```json
// Request
{ "ruleIds": ["rule-id-3", "rule-id-1", "rule-id-2"] }
```
La posición en el array determina la nueva `priority`. **`PUT`, no `PATCH`:** es "este es el orden completo, reemplázalo entero" — coherente con que el caso de uso existe para evitar reordenamientos parciales a medio camino.

---

### Eliminar una regla
| | |
|---|---|
| **Caso de uso** | `RemoveRule` |
| **Endpoint** | `DELETE /flags/:key/rules/:ruleId` |
| **Éxito** | `204 No Content` |
| **Errores** | `404` `RULE_NOT_FOUND` |

---

## Segmentos

### Crear un segmento
| | |
|---|---|
| **Caso de uso** | `CreateSegment` |
| **Endpoint** | `POST /segments` |
| **Éxito** | `201 Created` |
| **Errores** | `409` `SEGMENT_KEY_ALREADY_EXISTS` · `422` `VALIDATION_ERROR` |

```json
// Request
{
  "key": "cr-premium",
  "name": "Costa Rica, plan premium",
  "conditions": [
    { "attribute": "country", "operator": "equals", "value": "CR" },
    { "attribute": "plan", "operator": "equals", "value": "premium" }
  ]
}
```
`conditions` puede ser `[]` → segmento que siempre matchea.

---

### Listar / Obtener segmentos
| | |
|---|---|
| **Caso de uso** | `ListSegments` / `GetSegment` |
| **Endpoint** | `GET /segments` · `GET /segments/:key` |
| **Éxito** | `200 OK` |
| **Errores** | `404` `SEGMENT_NOT_FOUND` (solo `GetSegment`) |

---

### Actualizar un segmento
| | |
|---|---|
| **Caso de uso** | `UpdateSegment` |
| **Endpoint** | `PATCH /segments/:key` |
| **Éxito** | `200 OK` |
| **Errores** | `404` `SEGMENT_NOT_FOUND` · `422` `VALIDATION_ERROR` |

```json
// Request — reemplazo completo de conditions
{ "conditions": [{ "attribute": "country", "operator": "in", "value": ["CR", "MX"] }] }
```

---

### Eliminar un segmento
| | |
|---|---|
| **Caso de uso** | `DeleteSegment` |
| **Endpoint** | `DELETE /segments/:key` |
| **Éxito** | `204 No Content` |
| **Errores** | `404` `SEGMENT_NOT_FOUND` · `409` `SEGMENT_IN_USE` |

`SEGMENT_IN_USE` traduce la violación de foreign key (alguna regla activa todavía lo referencia) en un error legible — no se filtra el error crudo de base de datos.

---

## Evaluación

### Evaluar un flag
| | |
|---|---|
| **Caso de uso** | `EvaluateFlag` |
| **Endpoint** | `POST /flags/:key/evaluate` |
| **Éxito** | `200 OK` |
| **Errores** | `404` `FLAG_NOT_FOUND` |

```json
// Request
{ "context": { "userId": "u-123", "country": "CR", "plan": "premium" } }
```
```json
// Response 200
{ "flag": "new-checkout", "enabled": true }
```

**Por qué `POST` y no `GET`, siendo lectura:** el contexto puede tener una cantidad arbitraria de atributos — codificarlos como query params se vuelve frágil (escaping, longitud de URL) apenas crece. Un body JSON lo representa de forma natural y extensible.

Este es el endpoint que debe resolverse contra el caché en memoria, no contra la base en cada llamada (ver `concepts.md` / `database.md`) — el contrato no lo impone, pero está diseñado para que esa implementación sea directa.

---

## Resumen de endpoints

| Método | Ruta | Caso de uso |
|---|---|---|
| `POST` | `/flags` | CreateFlag |
| `GET` | `/flags` | ListFlags |
| `GET` | `/flags/:key` | GetFlag |
| `PATCH` | `/flags/:key` | UpdateFlag |
| `POST` | `/flags/:key/enable` | EnableFlag |
| `POST` | `/flags/:key/disable` | DisableFlag |
| `DELETE` | `/flags/:key` | DeleteFlag |
| `POST` | `/flags/:key/rules` | AddRule |
| `PATCH` | `/flags/:key/rules/:ruleId` | UpdateRule |
| `PUT` | `/flags/:key/rules/order` | ReorderRules |
| `DELETE` | `/flags/:key/rules/:ruleId` | RemoveRule |
| `POST` | `/segments` | CreateSegment |
| `GET` | `/segments` | ListSegments |
| `GET` | `/segments/:key` | GetSegment |
| `PATCH` | `/segments/:key` | UpdateSegment |
| `DELETE` | `/segments/:key` | DeleteSegment |
| `POST` | `/flags/:key/evaluate` | EvaluateFlag |

`EvaluateAllFlags` queda pendiente de decisión en `usecases.md`. Si se confirma, su contrato natural sería `POST /evaluate` (sin `:key`, contexto en el body, respondiendo el estado de todos los flags).

---

Con `usecases.md` y `contracts.md` cerrados, el siguiente paso es la estructura de capas: cómo se organiza el código para que estos casos de uso vivan aislados de Elysia (HTTP) y de Prisma (persistencia), de forma testeable de manera independiente.