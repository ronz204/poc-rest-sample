# Overview: Feature Flags Engine (POC)

## ¿Qué es este proyecto?

Una REST API bien provisionada que implementa un motor de feature flags con targeting por reglas — algo así como una versión mini de LaunchDarkly. Los clientes (otras apps) consultan en tiempo real si una feature está activa para un usuario dado, y el motor responde evaluando reglas, segmentos y rollouts porcentuales.

No es un producto. Es un **POC con propósito didáctico**: un proyecto del tamaño justo para practicar diseño de API, separación de capas y testing, sin que se convierta en un proyecto interminable.

## Por qué este proyecto y no otro

La razón de elegir feature flags como dominio, en vez de un CRUD cualquiera, es deliberada: necesitaba algo que tuviera **lógica de negocio real que valga la pena testear unitariamente** — no solo "guardar y leer registros". Como se explica en `concepts.md`, evaluar si un flag está activo para un usuario implica recorrer reglas, resolver segmentos y calcular rollouts de forma determinística. Eso es exactamente el tipo de función pura, sin efectos secundarios, que demuestra si tu capa de aplicación está bien desacoplada de la base de datos y del framework HTTP.

Al mismo tiempo, el dominio tiene un techo bajo: una vez que tienes Flag, Contexto, Regla, Segmento y Rollout, no hay mucho más que agregar. Eso es justo lo que se buscaba — reto suficiente, sin scope infinito.

## Propósito del POC

Concretamente, este proyecto busca servir como un **harness de aprendizaje** para:

- Diseñar una REST API con endpoints bien pensados (no solo CRUD plano).
- Practicar separación de capas: dominio puro (evaluación de reglas) aislado de la capa HTTP y de la capa de persistencia.
- Escribir tests unitarios sobre lógica de negocio real, sin necesidad de levantar base de datos ni servidor.
- Tomar decisiones de diseño sobre caché (por qué y cómo cachear algo que se consulta constantemente).
- Tener algo terminado y demostrable, no un proyecto que se alarga indefinidamente.

## Alcance: qué incluye y qué no

Para mantener el proyecto del tamaño correcto, hay límites explícitos:

**Incluye:**
- CRUD de flags (crear, leer, actualizar, desactivar).
- Definición de reglas de targeting por atributos del contexto.
- Definición de segmentos reusables.
- Rollout porcentual con hashing determinístico.
- Endpoint de evaluación (`¿está activo este flag para este contexto?`).
- Caché en memoria para evaluación rápida.

**Deliberadamente fuera de alcance (por ahora):**
- Autenticación/autorización multi-tenant — se asume un solo "cliente" del motor.
- UI de administración — todo se maneja vía API.
- Auditoría/historial de cambios de flags.
- Analítica de qué tanto se evalúa cada flag.
- Múltiples ambientes (dev/staging/prod) por flag.

Estas exclusiones no son negociables a la baja — son justamente lo que evita que el POC se convierta en un proyecto de meses. Si en algún punto se agregan, debe ser una decisión consciente, no scope creep.

## Funcionalidades principales

A alto nivel, la API permite:

1. **Gestionar flags** — crear una feature, definir su estado default, activarla o desactivarla globalmente.
2. **Definir targeting** — agregar reglas a un flag basadas en atributos del contexto (país, plan, rol, etc.).
3. **Definir segmentos** — agrupar condiciones reusables para no repetirlas en cada flag.
4. **Configurar rollouts graduales** — activar un flag para un porcentaje de usuarios, de forma estable.
5. **Evaluar flags** — dado un flag y un contexto de usuario, responder si está activo o no, aplicando todas las reglas correspondientes.

El endpoint de evaluación es el más importante de los cinco: es el que se va a consultar constantemente desde sistemas externos, y por eso es el que más cuidado de diseño necesita (rendimiento, caché, testabilidad).

## Qué se espera aprender al construirlo

Más allá del resultado final, el valor de este POC está en el proceso:

- Cómo modelar un dominio que tiene lógica genuina, no solo entidades planas.
- Cómo estructurar una API para que la evaluación (el corazón del sistema) sea testeable sin infraestructura.
- Cómo razonar sobre caché cuando la frecuencia de lectura es mucho mayor que la de escritura.
- Cómo decidir qué dejar fuera de un proyecto para que sea terminable.

---

Con `concepts.md` (el qué y el por qué del dominio) y `overview.md` (el qué y el por qué del proyecto) ya cubiertos, el siguiente paso lógico es el diseño técnico: endpoints concretos, modelo de datos y estructura de capas. Cuando quieras, seguimos con eso.