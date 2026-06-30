# Planning: Rule → Flag Aggregate + DAO

> Este documento describe cómo integrar la `Rule` entity (ya creada en `entities/rule.entity.ts`) con el `Flag` aggregate y con la capa de persistencia (`flags.dao.ts`). Nada de esto está implementado aún — es el contrato de diseño para el siguiente paso.

---

## 1. Integración con el Aggregate `Flag`

`Rule` es una entity interna al aggregate `Flag`. El aggregate es el único punto de entrada para crear, modificar y eliminar reglas. Desde afuera del aggregate, `Rule` no se toca directamente.

### 1.1. Cambios en `Row` de `Flag`

El aggregate necesita cargar sus reglas. El `Row` interno de `Flag` pasa de:

```typescript
interface Row {
  id: string; key: string; name: string;
  short: string; enabled: boolean; default: boolean;
}
```

a:

```typescript
interface Row {
  id: string; key: string; name: string;
  short: string; enabled: boolean; default: boolean;
  rules: Rule[];
}
```

`rules` es un array de instancias `Rule` ya hidratadas, no rows crudas. La responsabilidad de construirlas desde la DB recae en el repositorio antes de llamar a `Flag.hydrate`.

### 1.2. `Flag.hydrate` extendido

`hydrate` necesita aceptar las reglas para reconstruir el aggregate completo:

```typescript
interface HydrateProps {
  id: string; key: string; name: string;
  short: string; enabled: boolean; default: boolean;
  rules: Rule[];
}

public static hydrate(props: HydrateProps): Flag {
  return new Flag({ ...props });
};
```

### 1.3. Métodos del aggregate para gestionar reglas

Toda mutación sobre reglas pasa por métodos de `Flag`. El aggregate verifica invariantes globales (ej. prioridades únicas) antes de delegar en `Rule`.

#### `addRule`

```typescript
// RuleCreateAction = Omit<Rule.CreateAction, "flagId">
public addRule(cmd: RuleCreateAction): Result<Rule, RuleError | FlagError> {
  const priorityInUse = this.row.rules.some(r => r.priority === cmd.priority);
  if (priorityInUse) return Failure(FlagErrors.duplicatePriority(cmd.priority));

  const result = Rule.factory({ ...cmd, flagId: this.row.id });
  if (!result.ok) return result;

  this.row.rules.push(result.value);
  return Success(result.value);
};
```

El aggregate inyecta su propio `id` como `flagId` — el caller no lo pasa.

#### `updateRule`

```typescript
public updateRule(ruleId: string, cmd: RuleUpdateAction): Result<void, RuleError | FlagError> {
  const rule = this.row.rules.find(r => r.id === ruleId);
  if (!rule) return Failure(FlagErrors.ruleNotFound(ruleId));

  if (cmd.priority !== undefined) {
    const conflict = this.row.rules.some(r => r.id !== ruleId && r.priority === cmd.priority);
    if (conflict) return Failure(FlagErrors.duplicatePriority(cmd.priority));
  };

  return rule.refresh(cmd);
};
```

#### `removeRule`

```typescript
public removeRule(ruleId: string): Result<void, FlagError> {
  const index = this.row.rules.findIndex(r => r.id === ruleId);
  if (index === -1) return Failure(FlagErrors.ruleNotFound(ruleId));

  this.row.rules.splice(index, 1);
  return Success(undefined);
};
```

#### `reorderRules`

```typescript
public reorderRules(order: { ruleId: string; priority: number }[]): Result<void, FlagError> {
  const allKnown = order.every(o => this.row.rules.some(r => r.id === o.ruleId));
  if (!allKnown) return Failure(FlagErrors.invalidReorder());

  const priorities = order.map(o => o.priority);
  const hasDuplicates = new Set(priorities).size !== priorities.length;
  if (hasDuplicates) return Failure(FlagErrors.duplicatePriority(-1));

  for (const { ruleId, priority } of order) {
    const rule = this.row.rules.find(r => r.id === ruleId)!;
    rule.refresh({ priority });
  };

  return Success(undefined);
};
```

### 1.4. Getter de solo lectura

```typescript
get rules(): ReadonlyArray<Rule> {
  return this.row.rules;
};
```

`ReadonlyArray` impide que el caller mute el array directamente. Para mutar, debe pasar por `addRule` / `removeRule` / `reorderRules`.

---

## 2. Integración con la capa de persistencia

El documento `modeling.md` es explícito: no existe un `RuleRepository`. Las reglas siempre se persisten como parte de su `Flag`. El `FlagsDao` es el único DAO que toca la tabla `rules`.

### 2.1. Extensión de `flags.read.ts`

Las queries de lectura necesitan traer las reglas junto con el flag:

```typescript
// flags.read.ts

export namespace Unique {
  export function query(key: string) {
    return {
      where: { key },
      include: { rules: { orderBy: { priority: "asc" } } },
    } satisfies FlagFindUniqueArgs;
  };
};

export namespace Collect {
  export function query(args: Args = {}) {
    const { page = 1, limit = 20 } = args;
    return {
      skip: (page - 1) * limit,
      take: limit,
      include: { rules: { orderBy: { priority: "asc" } } },
    } satisfies FlagFindManyArgs;
  };
};
```

### 2.2. Extensión de `flags.write.ts`

Las writes son el punto más delicado. La estrategia de reemplazo atómico (`deleteMany` + `createMany`) garantiza que el conjunto de reglas en la DB siempre refleje el estado del aggregate sin necesitar lógica de diff.

```typescript
// flags.write.ts

export namespace Update {
  export function query(flag: Flag) {
    return {
      where: { key: flag.key },
      data: {
        name: flag.name,
        short: flag.short,
        default: flag.default,
        enabled: flag.enabled,
        // reemplazo atómico del conjunto de reglas
        rules: {
          deleteMany: {},
          createMany: {
            data: flag.rules.map(r => ({
              id: r.id,
              segmentId: r.segmentId,
              priority: r.priority,
              outcome: r.outcome,
              rollout: r.rollout,
            })),
          },
        },
      },
    } satisfies FlagUpdateArgs;
  };
};
```

> **Por qué `deleteMany: {}`**: Las reglas pertenecen exclusivamente a su flag (cascade). Reemplazar el conjunto completo es más simple y seguro que un diff parcial. El costo es aceptable en un POC — si la tabla crece mucho, se puede optimizar con upsert + delete de huérfanas.

### 2.3. `FlagsDao`: hidratación con reglas

El `FlagsDao` necesita construir las `Rule[]` a partir de los rows que Prisma retorna antes de llamar a `Flag.hydrate`:

```typescript
// flags.dao.ts

private static toAggregate(row: FlagWithRules): Flag {
  const rules = row.rules.map(Rule.hydrate);
  return Flag.hydrate({ ...row, rules });
};

public async unique(key: string): Promise<Flag | null> {
  const row = await this.db.flag.findUnique(Unique.query(key));
  return row ? FlagsDao.toAggregate(row) : null;
};

public async collect(args: Collect.Args): Promise<Flag[]> {
  const rows = await this.db.flag.findMany(Collect.query(args));
  return rows.map(FlagsDao.toAggregate);
};
```

`FlagWithRules` es el tipo de Prisma que incluye las reglas anidadas — se puede derivar con el helper `Prisma.FlagGetPayload<{ include: { rules: true } }>`.

---

## 3. Errores nuevos que necesita `FlagErrors`

Los métodos del aggregate que gestionan reglas necesitan nuevos tipos de error en `flag.exceptions.ts`:

```typescript
export type FlagError =
  | { type: "INVALID_FLAG_KEY"; key: string; }
  | { type: "INVALID_FLAG_NAME"; name: string; }
  | { type: "INVALID_FLAG_SHORT"; short: string; }
  // nuevos:
  | { type: "RULE_NOT_FOUND"; ruleId: string; }
  | { type: "DUPLICATE_RULE_PRIORITY"; priority: number; }
  | { type: "INVALID_REORDER"; };

export const FlagErrors = Object.freeze({
  // existentes...
  ruleNotFound: (ruleId: string): FlagError => ({ type: "RULE_NOT_FOUND", ruleId }),
  duplicatePriority: (priority: number): FlagError => ({ type: "DUPLICATE_RULE_PRIORITY", priority }),
  invalidReorder: (): FlagError => ({ type: "INVALID_REORDER" }),
});
```

---

## 4. Orden de implementación sugerido

1. **`flag.exceptions.ts`** — agregar los tres errores nuevos.
2. **`flag.aggregate.ts`** — extender `Row` con `rules: Rule[]`, actualizar `hydrate`, agregar los cuatro métodos de gestión de reglas y el getter `rules`.
3. **`flags.read.ts`** — agregar `include: { rules: ... }` a `Unique.query` y `Collect.query`.
4. **`flags.write.ts`** — extender `Update.query` con la estrategia de reemplazo atómico.
5. **`flags.dao.ts`** — extraer `toAggregate`, actualizar `unique` y `collect`.
6. **`flags.idao.ts`** — no requiere cambios (la interfaz pública del DAO no cambia).

---

## 5. Lo que queda fuera de scope (por ahora)

- `Create.query` en `flags.write.ts` no incluye reglas todavía: un flag se crea sin reglas y estas se agregan en una operación posterior. Si el negocio cambia esta restricción, se extiende `Create.query` con `createMany`.
- Validación cross-aggregate de `segmentId` (verificar que el segmento existe antes de asociarlo a una regla) — esa lógica vive en el caso de uso, no en el aggregate ni en el DAO.
- `RuleCreateAction` exportada desde `flag.aggregate.ts` (o reexportada desde `entities/rule.interfaces.ts`) para los casos de uso que llamen a `flag.addRule(...)`.
