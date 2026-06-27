# Conceptos: Feature Flags Engine

## ¿Qué es un feature flag, en serio?

Un feature flag es, en el fondo, un **interruptor remoto para una rama de código**. En vez de escribir:

```ts
if (true) {
  mostrarNuevoCheckout()
}
```

escribes:

```ts
if (flags.isEnabled('new-checkout', usuario)) {
  mostrarNuevoCheckout()
}
```

La diferencia parece cosmética, pero no lo es: el `true` ya no vive en tu código fuente, vive en una base de datos que puedes cambiar **sin hacer deploy**. Eso es lo único que un feature flag realmente resuelve — desacoplar "cambiar el comportamiento de la app" de "lanzar una nueva versión del código".

Todo lo demás (porcentajes, segmentos, reglas) son formas más sofisticadas de responder la misma pregunta: **¿este flag está activo para este usuario, ahora?**

## Por qué esto no es CRUD

Si el sistema fuera solo "guardar flags y leer su estado on/off", sería CRUD puro y no enseñaría nada. Lo que lo convierte en un dominio interesante es que la pregunta "¿está activo?" puede depender de:

- **Quién pregunta** (el usuario, sus atributos: país, plan, rol)
- **Reglas condicionales** sobre esos atributos
- **Probabilidad** (rollouts graduales tipo "10% de los usuarios")
- **Combinaciones de las anteriores**, evaluadas en cierto orden

Eso es lógica de dominio real: dado un flag y un usuario, hay que *evaluar* algo, no solo consultar una tabla. Esa función de evaluación es el corazón del proyecto y donde vale la pena poner el cuidado de diseño (tests unitarios, separación de capas, etc.).

## El vocabulario base

### Flag

La unidad fundamental. Representa una feature que puede estar prendida o apagada.

```
key: "new-checkout"
nombre: "Nuevo flujo de checkout"
activo_por_default: false
```

Un flag por sí solo, sin reglas, es solo un booleano global. Eso ya es útil (un kill switch simple), pero es el caso más aburrido. Lo interesante empieza cuando el flag tiene **reglas de targeting**.

### Contexto de evaluación

Antes de hablar de reglas, hay que hablar de **contra qué se evalúan**. Cuando una app le pregunta al motor "¿está activo `new-checkout` para este usuario?", tiene que mandarle algo más que un ID. Manda un **contexto**: un conjunto de atributos sobre quién está preguntando.

```json
{
  "userId": "u-123",
  "country": "CR",
  "plan": "premium",
  "role": "admin"
}
```

Este contexto es la materia prima que las reglas van a inspeccionar. Sin un contexto bien definido, "evaluar reglas" no tiene sentido — es como tener un `WHERE` sin saber qué columnas existen.

### Regla de targeting

Una regla es una condición sobre el contexto que, si se cumple, determina el resultado para ese usuario.

```
SI country == "CR" Y plan == "premium"
ENTONCES activo = true
```

Un flag puede tener varias reglas, evaluadas en orden (la primera que matchea, gana — es el mismo patrón que un `switch` o una cadena de `if/else if`). Si ninguna regla matchea, se cae al valor default del flag.

Esto ya es más interesante que CRUD: ahora hay que decidir cómo representar condiciones (¿qué atributos? ¿qué operadores: igualdad, "in", mayor que?), cómo evaluarlas en orden, y qué pasa cuando nada matchea.

### Rollout porcentual

Esta es la parte que de verdad reta el diseño. La idea: "activa este flag para el 10% de los usuarios", pero con una restricción no negociable: **el mismo usuario tiene que obtener siempre el mismo resultado**. Si Ana cae en el 10% activado hoy, tiene que seguir cayendo ahí mañana, y la próxima semana — aunque el motor no guarde "a Ana ya le tocó sí" en ningún lado.

¿Cómo se logra esto sin guardar una tabla gigante de "usuario → resultado"? Con **hashing determinístico**:

1. Combinas el `userId` con la `key` del flag (para que el mismo usuario no caiga siempre en el mismo bucket en todos los flags): `"u-123-new-checkout"`
2. Le aplicas una función de hash (ej. MurmurHash, o algo simple como CRC32) que produce un número.
3. Ese número, módulo 100, te da un valor estable entre 0 y 99 para ese usuario+flag específico.
4. Si ese valor es menor al porcentaje configurado (ej. < 10), el flag está activo para ese usuario.

El hash es siempre el mismo para la misma entrada, así que el resultado es estable sin necesidad de persistir nada por usuario. Esto es el tipo de "lógica genuina" que menciona la propuesta original — no es nada exótico, pero hay que entenderlo y probarlo bien, porque un bug acá significa que usuarios "saltan" de grupo sin razón.

### Segmento

Un segmento es simplemente un **grupo de condiciones con nombre**, para no repetir la misma regla en veinte flags distintos.

```
segmento "clientes-premium-cr":
  country == "CR" Y plan == "premium"
```

En vez de escribir esa condición en cada flag, la regla del flag dice: "si el usuario pertenece al segmento `clientes-premium-cr`, activo = true". El segmento no es una entidad fundamentalmente nueva — es **una regla reusable con nombre propio**. Pero modelarlo bien importa: significa que evaluar una regla puede requerir evaluar un segmento primero, lo cual es un buen ejercicio de composición.

## Cómo se conecta todo: el flujo de evaluación

Cuando alguien pregunta "¿está activo el flag X para el usuario Y?", el motor hace, en orden:

1. Busca el flag por su `key`. Si no existe, responde algo explícito (no `false` silencioso — error o "flag no encontrado").
2. Si el flag está desactivado globalmente, responde `false` y termina ahí. No evalúa nada más.
3. Si está activo, recorre las reglas en orden:
   - Si la regla referencia un segmento, evalúa primero las condiciones del segmento contra el contexto.
   - Si la regla matchea, aplica su resultado (puede ser `true`/`false` directo, o un rollout porcentual).
4. Si ninguna regla matchea, usa el valor default del flag.

Esa secuencia — flag → reglas → segmentos → rollout — es la función de evaluación. Es pura (mismo input, mismo output), no toca la base de datos en cada paso si el flag ya está en memoria, y es perfecta para testear unitariamente sin levantar nada: le das un flag con sus reglas, un contexto, y verificas el resultado.

## Por qué el caché es importante aquí (no es opcional)

La propuesta menciona "caché agresivo" y vale la pena explicar por qué no es un nice-to-have:

Un feature flag se consulta en el **hot path** de la aplicación cliente — potencialmente en cada request, varias veces por request. Si cada evaluación implica ir a la base de datos a buscar el flag y sus reglas, el feature flags engine se vuelve el cuello de botella de todos los sistemas que lo usan, lo cual es exactamente lo opuesto a su propósito.

La solución natural: los flags (con sus reglas y segmentos) cambian con poca frecuencia comparado con cuántas veces se leen. Es un patrón clásico de **lectura intensiva, escritura rara** — el caso de uso ideal para mantener todo en memoria y refrescar solo cuando algo cambia, en vez de ir a la base de datos en cada evaluación.

## Resumen de entidades

| Entidad | Qué es | Por qué existe |
|---|---|---|
| **Flag** | La feature en sí, con un estado default | Unidad base de todo el sistema |
| **Contexto** | Atributos del usuario que pregunta | Materia prima para evaluar reglas |
| **Regla** | Condición + resultado | Permite targeting condicional |
| **Rollout %** | Activación probabilística estable | Lanzamientos graduales sin "saltos" de usuario |
| **Segmento** | Condición reusable con nombre | Evita repetir lógica entre flags |

---

Con esto como mapa mental, el siguiente paso natural es definir el **harness**: qué endpoints expone la API, qué forma tiene cada entidad en la base de datos, y cómo se estructura la capa de evaluación para que sea testeable de forma aislada (sin DB, sin HTTP). Cuando quieras, seguimos con eso.