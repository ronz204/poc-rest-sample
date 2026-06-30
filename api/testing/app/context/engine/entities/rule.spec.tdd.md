# Plan de pruebas: `Rule` entity

> Pruebas unitarias puras. Sin base de datos, sin HTTP, sin mocks de infraestructura. Solo la entity y sus invariantes. Cada caso prueba exactamente una cosa.

---

## Superficie bajo prueba

```
Rule.factory(cmd)     → crea una regla nueva, valida invariantes
rule.refresh(cmd)     → muta el estado, valida invariantes
Rule.hydrate(row)     → reconstituye desde persistencia
rule.primitives()     → serializa el estado actual (clon)
```

---

## 1. `Rule.factory()`

Responsabilidad: construir una `Rule` válida o devolver `Failure` con el error concreto. No mutación. Genera su propio `id`.

### 1.1 Casos felices

| # | Nombre | Qué verifica |
|---|---|---|
| F-01 | **Creación base** | Con todos los campos provistos y válidos, retorna `{ ok: true }` y los campos del resultado coinciden con el input (`flagId`, `segmentId`, `priority`, `outcome`, `rollout`) |
| F-02 | **Rollout por defecto** | Si `rollout` se omite, la regla queda con `rollout = 100` |
| F-03 | **Outcome false** | `outcome: false` es tan válido como `true` — no existe sesgo hacia el valor positivo |
| F-04 | **Rollout en borde inferior** | `rollout: 0` es válido (0% → la regla nunca activa, pero es un estado permitido) |
| F-05 | **Rollout en borde superior** | `rollout: 100` es válido |
| F-06 | **Id único** | Dos llamadas con los mismos argumentos producen `id`s distintos |
| F-07 | **Id es un UUID** | El `id` generado coincide con el patrón UUID (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`) |

### 1.2 Casos de fallo

| # | Nombre | Input | Error esperado |
|---|---|---|---|
| F-08 | **Priority cero** | `priority: 0` | `{ ok: false, error: { type: "INVALID_RULE_PRIORITY", priority: 0 } }` |
| F-09 | **Priority negativa** | `priority: -1` | `{ ok: false, error: { type: "INVALID_RULE_PRIORITY", priority: -1 } }` |
| F-10 | **Rollout negativo** | `rollout: -1` | `{ ok: false, error: { type: "INVALID_RULE_ROLLOUT", rollout: -1 } }` |
| F-11 | **Rollout excede 100** | `rollout: 101` | `{ ok: false, error: { type: "INVALID_RULE_ROLLOUT", rollout: 101 } }` |

### Fixture base para esta sección

```typescript
const base: CreateAction = {
  flagId: "flag-id",
  segmentId: "segment-id",
  priority: 1,
  outcome: true,
  rollout: 50,
};
```

---

## 2. `rule.refresh()`

Responsabilidad: mutar el estado de una regla existente con los campos provistos. Dos propiedades clave que probar: **las validaciones devuelven Failure sin mutar nada** y **campos omitidos no se tocan**.

### 2.1 Actualizaciones individuales (éxito)

| # | Nombre | Cmd | Verifica |
|---|---|---|---|
| R-01 | **Actualiza priority** | `{ priority: 2 }` | `rule.priority === 2`; el resto sin cambios |
| R-02 | **Actualiza outcome** | `{ outcome: false }` | `rule.outcome === false` |
| R-03 | **Actualiza segmentId** | `{ segmentId: "otro-id" }` | `rule.segmentId === "otro-id"` |
| R-04 | **Actualiza rollout** | `{ rollout: 25 }` | `rule.rollout === 25` |
| R-05 | **Pone rollout en null** | `{ rollout: null }` | `rule.rollout === null` — desactiva el filtro de rollout |
| R-06 | **Cmd vacío** | `{}` | Retorna `{ ok: true }`, ningún campo cambia |

### 2.2 Actualización múltiple

| # | Nombre | Cmd | Verifica |
|---|---|---|---|
| R-07 | **Varios campos a la vez** | `{ priority: 3, outcome: false, rollout: 10 }` | Los tres campos actualizados; `segmentId` sin cambios |

### 2.3 Fallos y atomicidad

| # | Nombre | Setup | Cmd | Error esperado | Post-condición |
|---|---|---|---|---|---|
| R-08 | **Priority inválida** | `priority: 1` | `{ priority: 0 }` | `INVALID_RULE_PRIORITY` | `rule.priority === 1` (sin cambio) |
| R-09 | **Rollout fuera de rango** | `rollout: 50` | `{ rollout: 101 }` | `INVALID_RULE_ROLLOUT` | `rule.rollout === 50` (sin cambio) |
| R-10 | **Atomicidad en fallo** | `priority: 1, outcome: true` | `{ priority: 0, outcome: false }` | `INVALID_RULE_PRIORITY` | **Ambos** sin cambiar: `priority === 1`, `outcome === true` |

> R-10 es el caso más importante de esta sección. Garantiza que una validación que falla no deja el estado a medio actualizar.

### 2.4 Bordes de rollout en refresh

| # | Nombre | Cmd | Verifica |
|---|---|---|---|
| R-11 | **Rollout = 0 es válido** | `{ rollout: 0 }` | `{ ok: true }`, `rule.rollout === 0` |
| R-12 | **Rollout = 100 es válido** | `{ rollout: 100 }` | `{ ok: true }`, `rule.rollout === 100` |

### Fixture base para esta sección

```typescript
// Se construye con factory para garantizar que arranca en estado válido
const rule = Rule.factory({
  flagId: "flag-id",
  segmentId: "segment-id",
  priority: 1,
  outcome: true,
  rollout: 50,
}).value as Rule;
// Nota: en cada test se crea una instancia fresca para evitar acoplamiento entre casos
```

---

## 3. `Rule.hydrate()`

Responsabilidad: reconstruir una `Rule` desde un row de persistencia sin validación (el dato ya fue validado al crear). Cero lógica de negocio aquí.

| # | Nombre | Verifica |
|---|---|---|
| H-01 | **Todos los campos mapeados** | `id`, `flagId`, `segmentId`, `priority`, `outcome`, `rollout` del row quedan accesibles via getters |
| H-02 | **Rollout null** | Si `rollout: null` viene de la DB, `rule.rollout === null` (no se convierte en 100) |
| H-03 | **Outcome false** | `outcome: false` en el row → `rule.outcome === false` |

> `hydrate` no valida — no hay casos de fallo aquí. Si el row tiene `priority: 0` viene de datos corruptos en DB, no es responsabilidad de la entity corregirlos.

---

## 4. `rule.primitives()`

Responsabilidad: serializar el estado actual como un objeto plano. La propiedad crítica: **es un clon**, no una referencia al estado interno.

| # | Nombre | Verifica |
|---|---|---|
| P-01 | **Valores correctos** | El objeto retornado contiene los mismos valores que los getters de la regla |
| P-02 | **Es un clon** | Mutar una propiedad del objeto retornado no afecta el estado de la entity (ej. `primitives().priority = 99` → `rule.priority` sigue igual) |
| P-03 | **Refleja estado tras refresh** | Llamar `primitives()` después de `refresh({ priority: 5 })` retorna `priority: 5` |

---

## Resumen de cobertura

| Método | Felices | Fallos | Bordes | Total |
|---|---|---|---|---|
| `factory` | 7 | 4 | — | **11** |
| `refresh` | 7 | 3 | 2 | **12** |
| `hydrate` | 3 | — | — | **3** |
| `primitives` | 3 | — | — | **3** |
| **Total** | | | | **29** |

---

## Notas de implementación (para cuando se escriba el código)

- Cada test crea su propia instancia de `Rule` — sin estado compartido entre casos.
- Para los tests de `factory`, el `id` generado no se testea contra un valor exacto (es `crypto.randomUUID()`), solo que tiene formato UUID y que dos llamadas producen valores distintos.
- El resultado de `factory` se accede como `result.value` después de verificar `result.ok === true` — no hay casting sin guardia.
- Para testear la atomicidad (R-10): verificar tanto el campo que falló como el campo que venía "antes" en el cmd — ambos deben estar sin cambio.
