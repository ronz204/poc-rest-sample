# Modeling: Dominio rico sobre el modelo de persistencia

> Este documento traduce el schema de Prisma (`database.md` / `engine.prisma`) a un **modelo de dominio rico**: Aggregates, Entities y Value Objects. El punto de partida es una distinción importante: el modelo de persistencia y el modelo de dominio **no son el mismo objeto**. Las tablas son una proyección del dominio para fines de almacenamiento; el dominio es donde vive la lógica de negocio, las invariantes, y el comportamiento. Este documento es el puente entre ambos.

## Fundamentos DDD: los bloques de construcción del dominio

Antes de entrar al modelo concreto, conviene tener claros los tres bloques de construcción que DDD usa para representar el dominio. No son abstracciones académicas — son respuestas a preguntas de negocio muy concretas.

### Entity

Un objeto con **identidad que persiste en el tiempo**, independiente de sus atributos. Si cambias cualquier campo de una Entity, sigue siendo "la misma" instancia — se la reconoce por su `id`, no por sus valores.

La pregunta que decide si algo es Entity: *¿necesitamos rastrear "esta instancia en particular" a lo largo del tiempo? ¿El negocio distingue entre dos objetos con los mismos atributos pero historia diferente?*

```
// Entity: si cambias el nombre, sigue siendo el mismo flag
Flag { id: "abc", name: "dark-mode" }  →  Flag { id: "abc", name: "night-mode" }
// Misma instancia, atributo modificado — el id es el que manda
```

### Value Object (VO)

Un objeto definido **por sus atributos, no por su identidad**. No tiene `id` relevante en el dominio. Dos VOs con los mismos atributos son intercambiables — son el mismo valor. Son siempre **inmutables**: en lugar de mutar un VO, se reemplaza por uno nuevo.

La pregunta que decide si algo es VO: *¿Dos instancias con los mismos atributos son la misma cosa? ¿El negocio nunca necesita decir "esta condición concreta, con su historia"?*

```
// VO: dos rollouts al 50% son idénticos — no importa cuál de los dos es
Rollout(50) === Rollout(50)  // intercambiables

// VO: inmutable — no se muta, se reemplaza
const r1 = Rollout(50)
const r2 = Rollout(75)  // nuevo VO, r1 sigue intacto
```

Los VOs también encapsulan sus propias **invariantes de construcción**: un `Rollout` que no está entre 0-100 no puede existir — falla al construirse, no después.

### Aggregate

Un **cluster de Entities y VOs que se trata como una unidad** para efectos de consistencia y persistencia. La regla fundamental: las invariantes de negocio que afectan a varios objetos a la vez solo pueden garantizarse si alguien ve el conjunto completo — ese alguien es el Aggregate.

Cada Aggregate tiene exactamente un **Aggregate Root**: la Entity de entrada. Nada externo puede acceder a los objetos internos del Aggregate salvo a través del Root. El Root es quien garantiza que las invariantes del conjunto siempre se cumplan.

```
Aggregate: Flag (root)
├── Entity interna: Rule        ← solo accesible via Flag, nunca directamente
│     └── Value Object: Rollout
└── Value Object: FlagKey
```

**Tres reglas de oro del Aggregate:**

1. **Transacción = un Aggregate.** Todo lo que cambia en una operación de negocio debe vivir dentro de un solo Aggregate. Si una operación necesita modificar dos Aggregates a la vez, probablemente el diseño de límites está mal.
2. **Referencias entre Aggregates solo por id.** Un Aggregate nunca guarda el objeto completo de otro Aggregate — solo su identificador. Si necesita datos del otro, los busca por separado.
3. **El Root es el único punto de entrada.** Nada externo modifica una Entity interna directamente. Toda mutación pasa por métodos del Root, que verifica las invariantes del conjunto antes y después.

### Por qué importa la distinción

La distinción Entity / VO / Aggregate no es terminología — es una forma de razonar sobre **qué puede cambiar independientemente, qué necesita consistencia conjunta, y dónde vive cada regla de negocio**. Un campo que parece "solo un string" puede necesitar ser un VO si tiene reglas de validez propias. Un objeto que parece "solo un registro" puede necesitar ser un Aggregate si sus partes deben mutar de forma atómica.

---

## El criterio que define todo lo demás

Antes de asignar "Aggregate", "Entity" o "Value Object" a cada tabla, hay una sola pregunta que decide todo:

> **¿Qué invariantes de negocio tienen que ser ciertas siempre, y quién es responsable de garantizarlas?**

No es "¿esto es una tabla?" ni "¿esto tiene su propio id?". Las tablas y los IDs son decisiones de persistencia — útiles como pista, pero no como regla. Por eso este documento parte del schema ya documentado en `database.md`, pero reinterpreta cada relación en términos de invariantes, no de foreign keys.

Dos señales del propio `database.md` ya apuntan directo a los límites de los Aggregates:

- **Composición** (`CASCADE`) → "no existe sin su padre" en persistencia suele significar "no tiene sentido de negocio fuera de su padre" en el dominio → entidad interna del mismo Aggregate.
- **Asociación** (sin cascade) → independencia real de ciclo de vida → Aggregate distinto, conectado solo por referencia (id).

---

## Aggregate 1: `Flag` (root)

### Por qué `Flag` y `Rule` viven en el mismo Aggregate

`database.md` ya lo señala: `Flag → Rule` es composición, `CASCADE`. Pero la razón de fondo no es el `CASCADE` en sí — es que las invariantes de negocio sobre las reglas **solo se pueden verificar viendo el conjunto completo de reglas de un flag**, nunca una regla aislada:

- **`ReorderRules`** (`usecases.md`) necesita que todas las reglas de un flag se actualicen atómicamente: *"reordenar afecta a todas las reglas a la vez. Llamadas independientes dejarían una ventana con el orden a medio camino."* Eso es la definición operativa de un invariante transaccional de Aggregate.
- La decisión pendiente sobre `(flagId, priority)` duplicado (*"¿error de validación? ¿orden indefinido?"*) solo la puede resolver algo que vea **todas** las reglas del flag a la vez — es decir, el Aggregate Root, no la base de datos ni cada `Rule` por separado.

Esto ya está reflejado, sin que lo hayas nombrado así, en `contracts.md`: las reglas son sub-recurso (`/flags/:key/rules/...`), nunca de primer nivel. El límite del Aggregate ya estaba ahí, intuido en el diseño de la API.

### Composición

```
Aggregate: Flag (root)
├── Entity interna: Rule
│     └── Value Object: Rollout
└── (futuro, si aplica) Value Object: FlagKey
```

### Invariantes que protege `Flag` como root

- `enabled` siempre arranca en `false` — no existe "crear ya activo" (`CreateFlag`, `usecases.md`).
- El conjunto de `priority` entre las reglas del flag debe ser consistente (pendiente de decidir la regla exacta, pero la responsabilidad es de `Flag`, no de `Rule`).
- `ReorderRules` es atómico: todo o nada.

### Notas de implementación

- El repositorio expone `FlagRepository`, **no** `RuleRepository`. En el dominio no tiene sentido "guardar una Rule suelta" — siempre se persiste como parte de guardar su `Flag`.
- `Rule` solo se modifica a través de métodos de `Flag` (ej. `flag.addRule(...)`, `flag.reorderRules(...)`), nunca directamente.
- `Rule` no contiene el objeto `Segment` completo — solo su `SegmentId` (ver Aggregate 2). Esto evita que cargar un `Flag` implique cargar transitivamente todo el grafo de segmentos.

---

## Aggregate 2: `Segment` (root)

### Por qué es un Aggregate separado, aunque `Rule` lo referencie

`database.md` es explícito: `Rule → Segment` es **asociación**, sin `CASCADE` — *"el segmento es independiente, puede usarlo otra regla de otro flag"*. Esa independencia de ciclo de vida es el criterio que separa los Aggregates: si dos cosas pueden existir, cambiar y borrarse sin afectar la consistencia de la otra, son Aggregates distintos.

Si `Segment` viviera dentro del Aggregate `Flag`, cada modificación a un segmento compartido por N flags obligaría a cargar y re-guardar los N flags que lo referencian — exactamente lo que la decisión de modelado en `database.md` evita a propósito.

### Composición

```
Aggregate: Segment (root)
└── Value Object: Condition[]
      └── Value Object: ConditionValue (polimórfico)
```

### Invariantes que protege `Segment` como root

- Las condiciones se reemplazan **como conjunto**, nunca se editan parcialmente — `UpdateSegment` en `usecases.md` lo dice explícito: *"las condiciones, en conjunto, son la definición atómica del grupo. Editar una suelta sin mirar las demás puede dejar el conjunto en un estado que nadie revisó."*
- La forma de `value` debe ser coherente con su `operator` — responsabilidad explícita de la capa de aplicación según `database.md`, ya que Postgres no puede garantizarlo solo con tipos de columna.
- `DeleteSegment` debe verificar que ningún `Rule` activo lo siga referenciando antes de proceder (la FK sin cascade ya lo impone a nivel de base; el caso de uso debe traducir esa violación en un error de negocio legible — `SEGMENT_IN_USE`, no un error crudo de constraint).

### Notas de implementación

- El repositorio expone `SegmentRepository`. No existe `ConditionRepository` — las condiciones nunca se persisten ni se consultan sueltas, fuera de su segmento.
- El `id` que `Condition` tiene en la tabla SQL existe por razones de infraestructura (FK hacia `Segment`, índice) — **no implica que `Condition` deba tener identidad en el dominio**. Ver la sección de Value Objects abajo para el razonamiento completo.

---

## La relación entre los dos Aggregates

```
┌──────────────────────────────┐    referencia por id    ┌───────────────────────────┐
│   Aggregate: Flag (root)     │ ───(segmentId, no obj)──>│ Aggregate: Segment (root) │
│                               │                          │                           │
│  - id, key, name, enabled... │                          │  - id, key, name          │
│  - rules: Rule[] (Entity)    │                          │  - conditions:            │
│      └─ rollout: Rollout (VO)│                          │      Condition[] (VO)     │
│      └─ segmentId: VO        │                          │      └─ value: VO         │
└──────────────────────────────┘                          └───────────────────────────┘
```

Regla de DDD que aplica aquí: **un Aggregate nunca contiene una referencia directa (objeto completo) a otro Aggregate — solo su identificador.** El schema ya lo refleja a nivel de persistencia (`segmentId: String`, no un `Segment` embebido). En el dominio, esto se traduce a que `Rule` guarda un `SegmentId` (Value Object simple, un wrapper sobre el UUID) en vez de una referencia "viva" al objeto `Segment`.

---

## Entities vs. Value Objects: el criterio de decisión

La pregunta que distingue una Entity de un Value Object no es "¿tiene tabla?" ni "¿tiene id?" — es:

> **¿Tiene identidad que persiste en el tiempo, independiente de sus atributos?** Si cambias uno de sus campos, ¿sigue siendo "la misma" instancia modificada, o es conceptualmente "otra" que reemplazó a la anterior?

### `Rule` → Entity

Una `Rule` tiene identidad que persiste mientras se edita: `UpdateRule` (`usecases.md`) permite cambiar `priority`, `outcome`, `rollout` o `segmentId` de **la misma regla**, identificada por su `ruleId`. Sigue siendo "la regla con tal id", solo que con atributos distintos. Eso es Entity.

### `Condition` → Value Object (recomendado)

Aquí el patrón de uso del negocio ya respondió la pregunta sin que lo notáramos: las condiciones **nunca se editan individualmente**, siempre se reemplazan como conjunto completo (`UpdateSegment`). Si el negocio nunca necesita decir "modifica la condición con id X y conserva su identidad", entonces no tiene identidad relevante en el dominio — se compara por sus tres valores (`attribute`, `operator`, `value`), no por id.

| Opción | Cuándo conviene |
|---|---|
| **A. Value Object** (recomendado para este POC) | Coincide con el uso actual: reemplazo atómico, sin necesidad de referenciar una condición individual desde fuera de su segmento. |
| **B. Entity** | Solo si en el futuro se necesita, por ejemplo, deshabilitar o auditar una condición individual sin tocar las demás — mencionado en `database.md` como posibilidad, pero explícitamente fuera de alcance del POC actual (`overview.md` excluye auditoría). |

El `id` de `Condition` en la tabla SQL sigue siendo necesario (FK hacia `Segment`, índice) — eso es infraestructura, no dominio. La lógica de evaluación nunca necesita razonar sobre "la condición con id X", solo sobre "el conjunto de condiciones de este segmento".

### `Rollout` → Value Object

Hoy vive como un campo primitivo (`rollout: SmallInt?`), pero tiene comportamiento y reglas de validez genuinas: debe estar entre 0-100, y sobre él corre la lógica de hashing determinístico descrita en `concepts.md`. Envolverlo en un VO es lo que permite testear esa lógica de forma aislada — exactamente lo que pide `overview.md`: *"escribir tests unitarios sobre lógica de negocio real, sin necesidad de levantar base de datos ni servidor"*.

```typescript
class Rollout {
  private constructor(private readonly percentage: number) {}

  static create(percentage: number): Rollout {
    if (percentage < 0 || percentage > 100) {
      throw new InvalidRolloutError(percentage)
    }
    return new Rollout(percentage)
  }

  matches(userId: string, flagKey: string): boolean {
    const bucket = hash(`${userId}-${flagKey}`) % 100
    return bucket < this.percentage
  }
}
```

### `ConditionValue` → Value Object polimórfico

`database.md` ya identificó la variabilidad estructural real (`equals` → string, `in` → array, `between` → `{min, max}`) y la resolvió con JSONB en persistencia. En el dominio, esa misma variabilidad se modela con una jerarquía de VOs — y es justo donde vive la validación que `database.md` señala como responsabilidad de la capa de aplicación, no de la base de datos:

```typescript
abstract class ConditionValue {
  abstract matches(contextValue: unknown): boolean
}

class EqualsValue extends ConditionValue {
  constructor(private value: string) { super() }
  matches(contextValue: unknown) { return contextValue === this.value }
}

class InValue extends ConditionValue {
  constructor(private values: string[]) { super() }
  matches(contextValue: unknown) { return this.values.includes(contextValue as string) }
}
```

Con este diseño, la incompatibilidad entre `operator` y `value` (la validación pendiente que `usecases.md` menciona en `CreateSegment`) se vuelve **imposible de construir** — falla en el constructor del VO específico, no como un `if` posterior que valida después del hecho.

---

## Resumen: tabla → concepto de dominio

| Tabla (persistencia) | Concepto de dominio | Por qué |
|---|---|---|
| `flags` | **Aggregate Root** `Flag` | Punto de entrada único; protege invariantes sobre el conjunto de sus reglas |
| `rules` | **Entity** `Rule`, interna al Aggregate `Flag` | Tiene identidad persistente; se edita conservando su id (`UpdateRule`) |
| `rules.rollout` | **Value Object** `Rollout` | Comportamiento + validación (0-100) + lógica de hashing aislada y testeable |
| `rules.segmentId` | **Value Object** `SegmentId` | Referencia simple a otro Aggregate; nunca el objeto completo |
| `segments` | **Aggregate Root** `Segment` | Ciclo de vida independiente de `Flag`; protege invariante de reemplazo atómico de condiciones |
| `conditions` | **Value Object** `Condition` (recomendado) | Sin identidad relevante en el dominio; siempre se reemplaza como conjunto, nunca se edita individualmente |
| `conditions.value` (JSONB) | **Value Object polimórfico** `ConditionValue` | La forma varía según `operator`; la jerarquía hace la incompatibilidad imposible de construir |

---

## Pendiente de definir (para las próximas preguntas)

Estos quedan abiertos a propósito — son buen material para profundizar antes de implementar:

1. Cómo se ve el `FlagRepository` reconstruyendo el Aggregate completo (`Flag` + `Rule[]` con su `Rollout`) desde las tablas vía Prisma — el mapeo persistencia → dominio en el sentido inverso a este documento.
2. Cómo se ve el `SegmentRepository` equivalente.
3. La decisión pendiente de `usecases.md` sobre `priority` duplicada entre reglas del mismo flag — quién la valida y cómo se expresa como invariante en código.
4. Si conviene un método explícito en `Flag` para aplicar `ReorderRules` de forma atómica (ej. `flag.reorder(newOrder: RuleId[])`), y qué validaciones le corresponden ahí.
5. Diseño completo de las clases TypeScript (constructores, factory methods, invariantes en código) para `Flag`, `Rule`, `Segment` y los Value Objects.

---

Este documento es la capa de **dominio** sobre el modelo de **persistencia** ya cerrado en `database.md`. El siguiente paso natural es la estructura de capas que mencionaste en `contracts.md`: cómo se organiza el código para que estos Aggregates vivan aislados de Elysia (HTTP) y de Prisma (persistencia), de forma testeable de manera independiente.