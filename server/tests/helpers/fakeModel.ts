// Minimal in-memory stand-in for the Mongoose models used by the review API.
// Supports exactly what the controllers call; not a general Mongoose fake.
let n = 0;
const same = (a: any, b: any) => String(a) === String(b);

export const createFakeModel = (defaults: Record<string, any> = {}) => {
  const rows: any[] = [];
  const matches = (row: any, q: any): boolean =>
    Object.entries(q ?? {}).every(([k, v]) => {
      if (k === "$or") return (v as any[]).some((sub) => matches(row, sub));
      const cur = row[k];
      return Array.isArray(cur) ? cur.some((x) => same(x, v)) : same(cur, v);
    });
  const wrap = (row: any) =>
    row && Object.assign(row, {
      toObject: () => ({ ...row }),
      save: async () => row,
    });
  const chain = (list: any[]) => {
    const p: any = Promise.resolve(list.map(wrap));
    p.sort = () => p;
    p.populate = () => p;
    p.select = () => p;
    return p;
  };
  return {
    rows,
    create: async (doc: any) => {
      const row = { ...defaults, ...doc, _id: doc._id ?? (++n).toString(16).padStart(24, "a"), createdAt: new Date() };
      rows.push(row);
      return wrap(row);
    },
    updateMany: async (q: any, upd: any) => {
      const hit = rows.filter((r) => matches(r, q));
      hit.forEach((r) => Object.assign(r, upd));
      return { matchedCount: hit.length };
    },
    find: (q?: any) => chain(rows.filter((r) => matches(r, q))),
    findOne: async (q: any) => wrap(rows.find((r) => matches(r, q)) ?? null),
    findById: async (id: any) => wrap(rows.find((r) => same(r._id, id)) ?? null),
    updateOne: async (q: any, upd: any) => {
      const row = rows.find((r) => matches(r, q));
      if (!row) return { matchedCount: 0 };
      const { $addToSet, $push, $pull, ...set } = upd;
      Object.assign(row, set);
      for (const [k, v] of Object.entries($push ?? {})) row[k] = [...(row[k] ?? []), { _id: (++n).toString(16).padStart(24, "b"), ...(v as any) }];
      for (const [k, v] of Object.entries($pull ?? {})) row[k] = (row[k] ?? []).filter((x: any) => !Object.entries(v as any).every(([f, val]) => same(x[f], val)));
      for (const [k, v] of Object.entries($addToSet ?? {})) {
        row[k] = row[k] ?? [];
        if (!row[k].some((x: any) => same(x, v))) row[k].push(v);
      }
      return { matchedCount: 1 };
    },
  };
};
