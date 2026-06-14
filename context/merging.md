# Estrategias de Merging en Git

## El problema que resuelve el merge

Cuando dos personas trabajan en paralelo sobre el mismo repositorio, cada una avanza su propia línea de commits. Llega un momento en que esos dos caminos hay que reunirlos en uno solo. Eso es un **merge**.

```
main    A ── B ── C
              \
feature        D ── E ── F
```

El objetivo: incorporar D, E y F a main sin perder C ni romper nada.

---

## Algoritmos de Merge

Antes de elegir una estrategia, Git determina internamente qué algoritmo aplica según el estado del historial. Hay dos casos posibles.

---

### Fast-Forward

Ocurre cuando `main` **no avanzó** desde que creaste la rama. No hay divergencia real: los commits de `feature` son simplemente los siguientes en la línea. Git no necesita combinar nada; solo mueve el puntero de `main` hacia adelante.

```
antes:
main    A ── B
              \
feature        C ── D

después:
main    A ── B ── C ── D
```

No se crea ningún commit nuevo. El historial queda perfectamente lineal. Es el caso más simple y el que Git prefiere cuando puede.

> Si querés forzar un merge commit aunque sea posible el fast-forward (para dejar registro de que existió una rama), usá `git merge --no-ff feature`.

---

### 3-Way Merge

Ocurre cuando `main` **también recibió commits** mientras trabajabas en tu rama. Los dos historiales divergieron y no se puede simplemente mover un puntero.

```
main    A ── B ── C
              \
feature        D ── E
```

Git necesita combinar tres puntos:

```
        [B] ← ancestro común (base)
       /    \
     [C]    [E]  ← puntas de cada rama
```

Git compara cada rama contra el ancestro común `B` para entender qué cambió en cada lado. Si los cambios no se pisan, los combina automáticamente. Si las dos ramas tocaron las mismas líneas del mismo archivo, hay un **conflicto** que resolver manualmente.

El resultado es un nuevo **merge commit** `M` con dos padres: `C` y `E`.

```
después:
main    A ── B ── C ── M
              \       /
               D ── E
```

Se llama "3-way" porque usa exactamente tres commits como referencia: el ancestro común y las dos puntas.

---

## Estrategias de Merge

Los algoritmos anteriores son lo que Git hace internamente. Las estrategias son **decisiones tuyas** sobre cómo querés que quede el historial después de integrar una rama.

---

### 1. Merge Commit (el merge "clásico")

Es el resultado directo del **3-way merge**: Git crea un commit especial con dos padres que preserva la forma real del historial, sin reescribir nada.

```bash
git checkout main
git merge feature
```

```
main    A ── B ── C ── M
              \       /
               D ── E
```

`M` tiene como padres a `C` y a `E`. Al mirar el log se puede ver exactamente cuándo se integró la rama y desde dónde salió.

**Cuándo usarlo:** cuando querés preservar la historia real de lo que pasó. Útil en equipos donde importa saber cuándo se integró una feature y desde qué punto salió.

**Desventaja:** en repos muy activos el historial se llena de commits de merge y se vuelve difícil de leer.

---

### 2. Squash Merge

Toma **todos los commits de la rama** y los aplasta en uno solo antes de mergear. Ese único commit se agrega encima de `main`, pero sin enlace de paternidad con la rama original.

```bash
git checkout main
git merge --squash feature
git commit -m "feat: descripción de la feature completa"
```

```
antes:
main    A ── B ── C
              \
feature        D ── E ── F   (3 commits de trabajo)

después:
main    A ── B ── C ── S
                       ↑
              S = D+E+F aplastados en uno
```

La rama `feature` sigue existiendo igual, pero en `main` no hay rastro de los commits intermedios.

**Cuándo usarlo:** cuando los commits de la rama son sucios o no aportan historia útil (ej: "wip", "arreglé typo", "otro fix"). Se entrega un historial limpio en `main`.

**Desventaja:** se pierde la historia granular de la rama. Si algo falla, es más difícil rastrear exactamente qué commit introdujo el bug.

---

### 3. Rebase

En lugar de mergear, **reescribe los commits de tu rama** como si hubieran salido desde el punto más actual de `main`. El resultado es un historial perfectamente lineal, sin merge commits.

```bash
git checkout feature
git rebase main
```

```
antes:
main    A ── B ── C
              \
feature        D ── E

después del rebase:
main    A ── B ── C
                   \
feature             D' ── E'   (commits reescritos)
```

`D'` y `E'` tienen el mismo contenido que `D` y `E`, pero su hash cambia porque su punto de partida es ahora `C`. Como `feature` ahora empieza desde `C`, Git puede hacer fast-forward a `main`:

```bash
git checkout main
git merge feature   # fast-forward automático
```

```
main    A ── B ── C ── D' ── E'
```

**Cuándo usarlo:** cuando querés un historial limpio y lineal. Es la estrategia favorita de equipos que usan `git log` como documentación de cambios.

**Regla de oro: nunca hacer rebase de ramas que ya están en el remoto y otras personas usan.** Reescribir commits que otros tienen en su copia local genera conflictos graves. Rebase es seguro en ramas locales o en ramas personales que nadie más tocó.

---

### 4. Cherry-Pick

No es un merge completo: tomás **un commit específico** de cualquier rama y lo aplicás donde estás, sin traer el resto de la historia.

```bash
git checkout main
git cherry-pick <hash-del-commit>
```

```
feature    A ── B ── C ── D
                     ↑
                     solo este

main       X ── Y ── Z ── C'
```

`C'` es una copia del contenido de `C` aplicada sobre `Z`.

**Cuándo usarlo:** hotfixes que están en una rama de feature pero necesitan llegar a `main` ya, sin esperar que toda la rama esté lista. O para mover un commit que fue a la rama equivocada.

**Desventaja:** el mismo cambio existe en dos lugares con hashes distintos. Si luego se mergea la rama completa, Git puede no reconocer que ese cambio ya está aplicado y generar conflictos.

---

## Conflictos

Un conflicto ocurre cuando dos ramas modificaron **las mismas líneas** del mismo archivo. Git no puede decidir qué versión es la correcta y te pide que lo resolvás manualmente.

### Cómo se ve un conflicto

```
<<<<<<< HEAD
return user.email.toLowerCase();
=======
return user.email.trim().toLowerCase();
>>>>>>> feature/sanitize-input
```

- Lo que está entre `<<<<<<< HEAD` y `=======` es la versión de tu rama actual.
- Lo que está entre `=======` y `>>>>>>>` es la versión que viene del merge.

### Proceso de resolución

```bash
# 1. Git te avisa de los archivos en conflicto
git status

# 2. Abrís cada archivo, editás manualmente y dejás solo lo que querés
#    (borrás los marcadores <<<<<<<, =======, >>>>>>>)

# 3. Marcás como resuelto
git add archivo-resuelto.js

# 4. Completás el merge
git commit
```

Si usás VS Code, tiene una UI para elegir entre "current change", "incoming change" o ambas sin tener que editar los marcadores a mano.

---

## Comparativa rápida

| | **FF** | **3-Way** | **Squash** | **Rebase** | **Cherry-pick** |
|---|---|---|---|---|---|
| ¿Crea merge commit? | No | Sí | No | No | No |
| ¿Historial lineal? | Sí | No | Sí | Sí | Sí |
| ¿Reescribe commits? | No | No | No | Sí | Copia |
| ¿Cuándo aplica? | Sin divergencia | Con divergencia | Decisión tuya | Decisión tuya | Commit puntual |

---

## Flujos comunes en equipos

### GitHub Flow (simple)

```
main ──── feature-x ──── (PR + squash merge) ──── main
```

Todo sale de `main`, todo vuelve a `main` vía PR. Un commit por feature en `main`. Simple y funciona bien para deploy continuo.

### Git Flow (estructurado)

```
main        (solo releases estables)
develop     (integración continua)
feature/*   (trabajo diario)
release/*   (preparación de versión)
hotfix/*    (parches urgentes a main)
```

Más burocrático pero útil cuando hay versiones, releases y equipos grandes. Hotfixes se aplican tanto a `main` como a `develop`.
