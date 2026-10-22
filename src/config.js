// Runtime config, read from environment variables.
//
// BUGZOO_BUGS controls the planted bugs:
//   "all"  (default) every planted bug is active ("practice" mode)
//   "none"           no planted bugs ("clean" mode, for comparison)
//   "B01,B04"        only the listed bugs are active

export const ALL_BUGS = ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10'];

export function parseBugs(value) {
  const raw = (value ?? 'all').trim().toLowerCase();
  if (raw === '' || raw === 'all') return new Set(ALL_BUGS);
  if (raw === 'none' || raw === 'clean' || raw === 'off') return new Set();
  const ids = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const unknown = ids.filter((id) => !ALL_BUGS.includes(id));
  if (unknown.length) throw new Error(`Unknown bug id(s) in BUGZOO_BUGS: ${unknown.join(', ')}`);
  return new Set(ids);
}

export function loadConfig(env = process.env) {
  const bugs = parseBugs(env.BUGZOO_BUGS);
  return {
    port: Number(env.PORT ?? 8080),
    host: env.HOST ?? '0.0.0.0',
    bugs,
    mode: bugs.size === 0 ? 'clean' : 'practice',
  };
}
