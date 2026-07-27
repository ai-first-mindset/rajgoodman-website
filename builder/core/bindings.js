// Content bindings. A prop value is either a literal or a Binding -- a reference
// to an external field -- and render() only ever sees resolved values. Swapping
// the data source changes the content without touching the element, which is
// what keeps elements domain-agnostic.
//
//   { $bind: 'page.title', fallback?: 'Untitled' }

export function isBinding(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v) && typeof v.$bind === 'string';
}

export function binding(path, fallback) {
  return fallback === undefined ? { $bind: path } : { $bind: path, fallback };
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// A data scope is whatever the host supplies (page record, site settings, ...).
// Sources are declared so the inspector's binding picker can offer real paths.
export function createDataScope(data = {}, sources = []) {
  return {
    data,
    sources,
    resolve(v) {
      if (!isBinding(v)) return v;
      const got = getPath(data, v.$bind);
      return got === undefined || got === null || got === '' ? (v.fallback ?? '') : got;
    },
    paths() {
      return sources.flatMap((s) => s.paths.map((p) => ({
        value: `${s.name}.${p.name}`,
        label: `${s.label} - ${p.label}`,
      })));
    },
  };
}

// Resolve bindings anywhere in a props object, including inside arrays/objects.
export function resolveDeep(value, scope) {
  if (isBinding(value)) return scope.resolve(value);
  if (Array.isArray(value)) return value.map((v) => resolveDeep(v, scope));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveDeep(v, scope)]));
  }
  return value;
}

// The sources the Pages CMS exposes today. Extending the vocabulary is data,
// not code: add a source here and every element can bind to it.
export function pageSources(page = {}, site = {}) {
  return createDataScope(
    { page, site },
    [
      {
        name: 'page',
        label: 'Page',
        paths: [
          { name: 'title', label: 'Title' },
          { name: 'slug', label: 'Slug' },
          { name: 'seo_title', label: 'SEO title' },
          { name: 'meta_description', label: 'Meta description' },
          { name: 'canonical_url', label: 'Canonical URL' },
        ],
      },
      {
        name: 'site',
        label: 'Site',
        paths: [
          { name: 'name', label: 'Site name' },
          { name: 'contact_url', label: 'Contact URL' },
        ],
      },
    ],
  );
}
