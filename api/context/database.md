# Database: Modelado de datos

## Punto de partida: ¿qué se persiste y qué no?

Antes de escribir una sola tabla, hay una distinción importante que viene directo de `concepts.md`: el **contexto de evaluación** (los atributos del usuario que pregunta) **no se persiste**. Es información transitoria que el cliente manda en cada request — no existe una tabla `contexts`. Lo que sí se persiste es todo lo que define *cómo* evaluar ese contexto: flags, reglas y segmentos.

Esto importa porque es fácil caer en la trampa de querer modelar "usuarios" como entidad propia del motor de flags. No lo son. El motor no sabe quién es un usuario más allá de los atributos que le llegan en el momento de evaluar.

## Decisiones de modelado (el por qué antes del cómo)

### 1. Las condiciones de una regla viven en JSONB, no en columnas rígidas

Una condición puede tener formas distintas:

```
country == "CR"
plan IN ["premium", "enterprise"]
country == "CR" AND plan == "premium"
```

Si tratara de modelar esto con columnas fijas (`attribute`, `operator`, `value`), me quedaría corto en cuanto aparezca una condición compuesta (AND de dos atributos) o un operador distinto (`IN` vs `==`). La estructura *varía de forma* — y esa es la señal de que JSONB es la herramienta correcta, en vez de forzar una tabla rígida o, peor, una tabla `rule_conditions` separada con su propio mini-modelo relacional.

Lo que **sí** es rígido y vive en columnas normales: a qué flag pertenece la regla, en qué orden se evalúa, y cuál es su resultado. Eso no cambia de forma nunca, así que no tiene sentido meterlo en JSON.

### 2. El rollout porcentual no es una tabla aparte — es el "resultado" de una regla

En `concepts.md` establecimos que una regla tiene una condición y un resultado, y que el resultado puede ser `true`/`false` directo o "activar para el X% de los usuarios". Modelarlo como un tipo de resultado (con una columna `rollout_percentage` opcional) evita crear una tabla `rollouts` separada que terminaría siendo casi un duplicado de `rules`.

### 3. Los segmentos son su propia tabla, con su propio JSONB de condiciones

Un segmento es una condición reusable con nombre. Estructuralmente es muy parecido a una regla (también tiene una condición en JSONB), pero conceptualmente es distinto: una regla pertenece a un flag específico; un segmento es independiente y varios flags lo pueden referenciar. Por eso es tabla separada, y las reglas lo referencian por FK cuando aplica.

### 4. El orden de evaluación necesita una columna explícita

Como la evaluación es secuencial (primera regla que matchea, gana — ver `concepts.md`), no puedo confiar en el orden de inserción ni en el `id` autoincremental. Si alguien reordena las reglas de un flag después de creadas, el orden de evaluación tiene que reflejar eso. Por eso `priority` es una columna explícita, no un efecto secundario del ID.

### 5. ENUM para el tipo de resultado, no strings sueltos

El resultado de una regla puede ser: `on` (activar directo), `off` (desactivar directo), o `rollout` (porcentaje). Usar un `ENUM` en vez de un string libre evita que se cuelen valores inválidos como `"actvo"` por un typo, y deja explícito en el schema mismo cuáles son los únicos resultados posibles.

## Schema

```sql
-- Tipo de resultado que puede tener una regla
CREATE TYPE rule_outcome AS ENUM ('on', 'off', 'rollout');

-- Flags: la unidad fundamental
CREATE TABLE flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key             VARCHAR(100) NOT NULL UNIQUE,  -- ej: "new-checkout"
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT false, -- kill switch global
    default_outcome BOOLEAN NOT NULL DEFAULT false, -- si ninguna regla matchea
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Segmentos: condiciones reusables con nombre
CREATE TABLE segments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         VARCHAR(100) NOT NULL UNIQUE,  -- ej: "clientes-premium-cr"
    name        VARCHAR(255) NOT NULL,
    conditions  JSONB NOT NULL,  -- ver "Forma del JSONB" abajo
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reglas: pertenecen a un flag, se evalúan en orden
CREATE TABLE rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id             UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
    segment_id          UUID REFERENCES segments(id) ON DELETE SET NULL, -- opcional
    priority            INT NOT NULL,           -- orden de evaluación (menor = primero)
    conditions          JSONB,                  -- NULL si usa segment_id en su lugar
    outcome             rule_outcome NOT NULL,
    rollout_percentage  SMALLINT,               -- solo si outcome = 'rollout' (0-100)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_rollout_range
        CHECK (rollout_percentage IS NULL OR (rollout_percentage BETWEEN 0 AND 100)),
    CONSTRAINT chk_rollout_requires_percentage
        CHECK (outcome != 'rollout' OR rollout_percentage IS NOT NULL),
    CONSTRAINT chk_condition_source
        CHECK (segment_id IS NOT NULL OR conditions IS NOT NULL)
);

-- Una regla se evalúa en orden dentro de su flag: el índice acelera ese query
CREATE INDEX idx_rules_flag_priority ON rules(flag_id, priority);
```

### Forma del JSONB de condiciones

Tanto `rules.conditions` como `segments.conditions` usan la misma forma — al final, un segmento es solo una condición reusable, así que tiene sentido que comparta estructura:

```json
{
  "all": [
    { "attribute": "country", "operator": "eq", "value": "CR" },
    { "attribute": "plan", "operator": "in", "value": ["premium", "enterprise"] }
  ]
}
```

`all` significa que todas las condiciones internas deben cumplirse (AND). Se podría extender con `any` (OR) más adelante, pero para el alcance de este POC, `all` con una lista de comparaciones simples cubre los casos descritos en `concepts.md` sin sobre-ingeniería.

## Por qué este modelo soporta bien el flujo de evaluación

Vale la pena conectar el schema con el flujo de evaluación descrito en `concepts.md`, para confirmar que las tablas realmente sirven para lo que se necesita:

1. **Buscar el flag por `key`** → índice único en `flags.key`, lookup directo.
2. **Si `flags.enabled = false`** → corto circuito, ni se tocan las reglas.
3. **Recorrer las reglas en orden** → `SELECT * FROM rules WHERE flag_id = ? ORDER BY priority` — el índice compuesto `(flag_id, priority)` hace este query rápido.
4. **Si la regla tiene `segment_id`** → resolver las condiciones del segmento en vez de las propias.
5. **Si la regla matchea y `outcome = 'rollout'`** → aplicar el hashing determinístico (descrito en `concepts.md`) usando `rollout_percentage` como umbral.
6. **Si nada matchea** → usar `flags.default_outcome`.

Este flujo completo, en la práctica, se hace **una sola vez por flag** (no en cada evaluación) gracias al caché — la base de datos se consulta para poblar el caché en memoria, no en el hot path de evaluación. Eso conecta directo con lo que se explicó en `concepts.md` sobre por qué el caché no es opcional aquí.

## Qué se decidió NO modelar (y por qué)

Conectando con el alcance definido en `overview.md`:

- **No hay tabla `users` ni `contexts`** — el contexto es transitorio, viene en el request.
- **No hay tabla `environments`** — un solo set de flags, sin separación dev/staging/prod.
- **No hay tabla de auditoría/historial** — no se guarda quién cambió qué ni cuándo, más allá de `updated_at`.
- **No hay multi-tenancy** (sin `tenant_id` ni RLS) — se asume un solo cliente del motor.

Estas ausencias son intencionales, no descuidos — son las mismas exclusiones de alcance documentadas en `overview.md`, reflejadas ahora en el schema.

---

Con el modelo de datos definido, el siguiente paso natural es diseñar los **endpoints** de la API sobre este schema y pensar la estructura de capas (dominio, aplicación, infraestructura) que va a envolver estas tablas. Cuando quieras, seguimos con eso.