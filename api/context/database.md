# Database: Modelado de datos

## Punto de partida: ¿qué se persiste y qué no?

Antes de escribir una sola tabla, hay una distinción importante que viene directo de `concepts.md`: el **contexto de evaluación** (los atributos del usuario que pregunta) **no se persiste**. Es información transitoria que el cliente manda en cada request — no existe una tabla `contexts`. Lo que sí se persiste es todo lo que define *cómo* evaluar ese contexto: flags, reglas, segmentos y condiciones.

Esto importa porque es fácil caer en la trampa de querer modelar "usuarios" como entidad propia del motor de flags. No lo son. El motor no sabe quién es un usuario más allá de los atributos que le llegan en el momento de evaluar.

## Decisiones de modelado (el por qué antes del cómo)

### 1. Toda condición vive en `Segment`, nunca directo en `Rule`

La primera tentación al modelar esto es dejar que una regla cargue su propia condición (`attribute`/`operator`/`value` directo en `rules`), y que el segmento sea un atajo opcional para condiciones reusables. Ese camino se descartó a propósito: si `Rule` puede tener condición propia *o* segmento, queda una ambigüedad que ni la base de datos puede resolver sola (¿qué pasa si una fila tiene ambos? ¿o ninguno?). Resolverlo con un `CHECK` constraint es posible, pero es exactamente el tipo de caso especial que conviene eliminar del modelo en vez de validar después.

La solución: **toda regla referencia un segmento, sin excepción** — incluso una condición "simple" (`country == "CR"`) es, en este modelo, un segmento con una sola condición. Esto deja a `Rule` con una responsabilidad única y sin ambigüedad: decidir el orden y el resultado, no la condición en sí.

Una consecuencia directa de esto: una regla que debe aplicar a "todos los usuarios, sin condición" (por ejemplo, para representar el caso de un rollout puro sin segmentación) se modela como una referencia a un `Segment` que simplemente no tiene ninguna `Condition` asociada. El motor de evaluación trata "segmento sin condiciones" como "siempre matchea" — es un caso a tener en cuenta al implementar la función de evaluación, no un caso especial en el schema.

### 2. Las condiciones son su propia tabla, no JSONB suelto

Una condición individual (`attribute`, `operator`, `value`) tiene una forma fija y predecible — no varía de campo a campo, lo cual es justo la señal de que NO conviene usar JSONB para la condición completa. Modelarla como tabla (`Condition`) en vez de un array en una columna JSON del segmento da:

- Integridad garantizada por la base (cada condición siempre tiene sus tres campos, con sus tipos).
- Queries simples (`WHERE attribute = 'country'`) sin operadores JSONB especiales.
- Posibilidad de evolucionar cada condición de forma independiente (ej. deshabilitarla, auditarla) sin reescribir un blob completo.

Donde **sí** entra JSON es en el campo `value` de la condición — no en la condición como conjunto. La razón: la forma de `value` varía genuinamente según el `operator`. Un `equals` necesita un string; un `in` necesita un array; un eventual `between` necesitaría un objeto `{min, max}`. Esa es la variabilidad estructural real que justifica JSONB, a diferencia de la condición completa, que no varía de forma.

```
operator: "equals"   → value: "CR"
operator: "in"        → value: ["CR", "MX", "PA"]
operator: "between"   → value: { "min": 18, "max": 65 }
```

La validación de que la forma de `value` sea coherente con el `operator` es responsabilidad de la capa de aplicación — Postgres no puede garantizar "si operator = between, entonces value debe tener min y max" solo con el tipo de columna.

### 3. El resultado de una regla es `outcome` (booleano) + `rollout` (porcentaje opcional), no un ENUM de 3 valores

La primera versión de este modelo usó un ENUM `on | off | rollout` para el resultado de una regla. Se descartó porque mezclaba dos preguntas distintas en un solo campo: *qué responder* y *a qué fracción de los que matchean aplicárselo*. Un ENUM de 3 valores no puede expresar, por ejemplo, "activa para el 10% de los que matchean, y desactiva explícitamente al resto" — necesitarías reglas adicionales para cubrir ese caso, cuando en realidad es la misma pregunta de "qué % recibe este resultado".

El modelo correcto separa ambas preguntas en dos campos independientes:

- `outcome: Boolean` — qué responder si la regla matchea (true/false).
- `rollout: SmallInt?` — qué porcentaje de los que matchean recibe ese `outcome`. `NULL` (o 100) significa "todos los que matchean".

Esto es estructuralmente más simple que el ENUM, y cubre el caso de rollout sin necesitar un tercer estado.

### 4. El orden de evaluación necesita una columna explícita

Como la evaluación es secuencial y usa short-circuit (primera regla que matchea, gana — ver `concepts.md`), no se puede confiar en el orden de inserción ni en el `id`. Si alguien reordena las reglas de un flag después de creadas, el orden de evaluación tiene que reflejar eso. Por eso `priority` es una columna explícita (`Int`), no un efecto secundario del ID o del `createdAt`.

### 5. Relaciones de composición vs. asociación, y sus reglas de borrado

No todas las relaciones del modelo significan lo mismo, y eso se refleja en el comportamiento de borrado (`onDelete`):

| Relación | Tipo | Comportamiento |
|---|---|---|
| `Flag → Rule` | Composición | `CASCADE` — si se borra el flag, sus reglas no tienen sentido sin él |
| `Rule → Segment` | Asociación | Sin cascade — el segmento es independiente, puede usarlo otra regla de otro flag |
| `Segment → Condition` | Composición | `CASCADE` — una condición no significa nada fuera de su segmento |

La intuición detrás de esta distinción: composición es "no existe sin su padre" (regla sin flag, condición sin segmento); asociación es "préstamo entre iguales" (una regla usa un segmento, pero ninguno es dueño del otro).

## Schema (Prisma)

```prisma
model Flag {
  id    String @id @db.Uuid
  key   String @unique @db.VarChar(100)
  name  String @db.VarChar(100)
  short String @db.VarChar(200)

  enabled Boolean @default(false)
  default Boolean @default(false)

  createdAt DateTime @default(now()) @db.Timestamptz()
  updatedAt DateTime @updatedAt @db.Timestamptz()

  rules Rule[]

  @@map("flags")
  @@schema("engine")
}

model Rule {
  id        String @id @db.Uuid
  flagId    String @db.Uuid
  segmentId String @db.Uuid

  priority Int     @db.Integer
  outcome  Boolean @db.Boolean
  rollout  Int?    @default(100) @db.SmallInt

  segment Segment @relation(fields: [segmentId], references: [id])
  flag    Flag    @relation(fields: [flagId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now()) @db.Timestamptz()
  updatedAt DateTime @updatedAt @db.Timestamptz()

  @@index([flagId, priority])
  @@map("rules")
  @@schema("engine")
}

model Segment {
  id   String @id @db.Uuid
  key  String @unique @db.VarChar(100)
  name String @db.VarChar(100)

  createdAt DateTime @default(now()) @db.Timestamptz()
  updatedAt DateTime @updatedAt @db.Timestamptz()

  rules      Rule[]
  conditions Condition[]

  @@map("segments")
  @@schema("engine")
}

model Condition {
  id        String @id @db.Uuid
  segmentId String @db.Uuid

  attribute String @db.VarChar(50)
  operator  String @db.VarChar(20)
  value     Json   @db.JsonB

  segment Segment @relation(fields: [segmentId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now()) @db.Timestamptz()
  updatedAt DateTime @updatedAt @db.Timestamptz()

  @@index([segmentId])
  @@map("conditions")
  @@schema("engine")
}
```

### Sobre los índices

Hay dos índices explícitos en el schema, y vale la pena justificar cada uno en términos de qué query resuelven, no solo "por si acaso":

- **`Rule(flagId, priority)`** — es el índice más importante de todo el schema. Cuando se llena (o refresca) el caché en memoria, la query es "traer todas las reglas de este flag, ordenadas por prioridad" (`WHERE flagId = ? ORDER BY priority`). Sin este índice compuesto, Postgres tendría que escanear todas las filas de `rules` y ordenar en memoria; con él, la base ya entrega los resultados en el orden correcto. Es compuesto (no solo `flagId`) justamente porque la query no es solo un filtro — también necesita orden.
- **`Condition(segmentId)`** — cuando una regla referencia un segmento, hay que traer todas sus condiciones (`WHERE segmentId = ?`). Prisma no garantiza un índice automático sobre toda foreign key en todos los casos, así que se declara explícito. El impacto es menor que el de `rules` (se esperan pocas condiciones por segmento), pero es la misma lógica: acelerar el lookup que el flujo de evaluación hace constantemente.

No se agregó índice sobre `Rule.segmentId` ni sobre `Segment.key` más allá del `@unique` que ya genera uno implícitamente — `key` ya es único, así que la búsqueda por ese campo (ej. al buscar un flag o segmento por su nombre legible) ya está cubierta sin necesitar un índice adicional explícito.

## Por qué este modelo soporta bien el flujo de evaluación

Vale la pena conectar el schema con el flujo de evaluación descrito en `concepts.md`, para confirmar que las tablas realmente sirven para lo que se necesita:

1. **Buscar el flag por `key`** → índice único en `flags.key`, lookup directo.
2. **Si `flags.enabled = false`** → corto circuito, ni se tocan las reglas. Responde `flags.default`.
3. **Recorrer las reglas en orden** → gracias al índice `(flagId, priority)`, se obtienen ya ordenadas, sin sort adicional en memoria.
4. **Por cada regla, resolver su segmento** → se evalúan las `Condition[]` del segmento contra el contexto (AND implícito entre todas ellas). Si el segmento no tiene condiciones, se considera que matchea siempre.
5. **Si la regla matchea** → ¿tiene `rollout` menor a 100? Si sí, se aplica el hashing determinístico (descrito en `concepts.md`) sobre el porcentaje configurado; si el usuario cae dentro del umbral, se responde `outcome`. Si no cae dentro, se sigue evaluando la siguiente regla (como si esta no hubiera matchado).
6. **Si ninguna regla "gana"** → se usa `flags.default`.

Este flujo completo, en la práctica, se hace **una sola vez por flag** (no en cada evaluación) gracias al caché — la base de datos se consulta para poblar el caché en memoria, no en el hot path de evaluación. Eso conecta directo con lo que se explicó en `concepts.md` sobre por qué el caché no es opcional aquí.

## Qué se decidió NO modelar (y por qué)

Conectando con el alcance definido en `overview.md`:

- **No hay tabla `users` ni `contexts`** — el contexto es transitorio, viene en el request.
- **No hay tabla `environments`** — un solo set de flags, sin separación dev/staging/prod.
- **No hay tabla de auditoría/historial** — no se guarda quién cambió qué ni cuándo, más allá de `createdAt`/`updatedAt`.
- **No hay multi-tenancy** (sin `tenantId` ni RLS) — se asume un solo cliente del motor.

Estas ausencias son intencionales, no descuidos — son las mismas exclusiones de alcance documentadas en `overview.md`, reflejadas ahora en el schema.

---

Con el modelo de datos definido, el siguiente paso natural es diseñar los **endpoints** de la API sobre este schema y pensar la estructura de capas (dominio, aplicación, infraestructura) que va a envolver estas tablas. Cuando quieras, seguimos con eso.