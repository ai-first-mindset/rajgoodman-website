// Style tokens. Nodes store REFERENCES ("space.md"), never literal values, so a
// theme swap restyles the whole tree without editing a single node.
//
// A node's optional `style` is a StyleRefs map keyed by the theme's ordered
// slots: { space?: 'space.md', align?: 'align.center', surface?: 'surface.panel' }.
// The engine resolves those to classes generically in applyStyle(); no element
// ever sees or stores a colour or a pixel.

// Reference theme: the site's "Signal" design system. Structural tokens resolve
// to the .pb-* utility classes in site.css; value tokens resolve to the CSS
// custom properties declared in :root, so both stay single-sourced in CSS.
export const SIGNAL_THEME = {
  name: 'signal',
  label: 'Signal (site default)',
  slots: ['space', 'align', 'surface'],
  tokens: {
    'space.none': '',
    'space.sm': 'pb-mt-sm',
    'space.md': 'pb-mt-md',
    'space.lg': 'pb-mt-lg',

    'align.left': '',
    'align.center': 'pb-al-c',
    'align.right': 'pb-al-r',

    'surface.none': '',
    'surface.panel': 'pb-bg-panel',

    'color.accent': 'var(--yellow)',
    'color.accent-dark': 'var(--yellow-d)',
    'color.blue': 'var(--blue)',
    'color.ink': 'var(--ink)',
    'color.text': 'var(--tx)',
    'color.text-muted': 'var(--tx-60)',
    'color.line': 'var(--line)',
    'color.panel': 'var(--panel)',
    'type.body': 'var(--ff)',
    'type.mono': 'var(--mono)',
  },
  labels: {
    'space.none': 'None', 'space.sm': 'Small', 'space.md': 'Medium', 'space.lg': 'Large',
    'align.left': 'Left', 'align.center': 'Centre', 'align.right': 'Right',
    'surface.none': 'None', 'surface.panel': 'Panel',
  },
};

export function createTheme(theme = SIGNAL_THEME) {
  return {
    name: theme.name,
    slots: theme.slots,

    resolve(ref) {
      if (ref == null || ref === '') return '';
      const v = theme.tokens[ref];
      return v === undefined ? '' : v;
    },

    // Ordered so the emitted class list is deterministic across renders.
    classesFor(styleRefs) {
      if (!styleRefs || typeof styleRefs !== 'object') return '';
      const out = [];
      for (const slot of theme.slots) {
        const cls = this.resolve(styleRefs[slot]);
        if (cls) out.push(cls);
      }
      return out.join(' ');
    },

    // Token choices in a group ("space") -> [{ value, label }] for the inspector.
    options(group) {
      const prefix = `${group}.`;
      return Object.keys(theme.tokens)
        .filter((k) => k.startsWith(prefix))
        .map((value) => ({ value, label: theme.labels[value] || value.slice(prefix.length) }));
    },
  };
}
