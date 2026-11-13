import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const client = readFileSync(new URL('../lib/ui/client.js', import.meta.url), 'utf8');

// Execute the shipped classic-script factory and real slot registration, then
// recursively render EVERY function component, including hidden retained panels.
// This is a synchronous render harness, not a browser/React effects simulator.
function mountClient({ language = 'en', view = 'quota', snapshot = null, rpcPresent = true } = {}) {
  let exported;
  let frame;
  const registrations = [];
  const components = [];
  const nodes = [];
  const effects = [];
  const Fragment = Symbol('Fragment');
  const React = {
    Fragment,
    createElement(type, props, ...children) {
      return { type, props: { ...props, children: children.length === 1 ? children[0] : children }, children };
    },
    useState(initial) {
      const index = frame.index++;
      const value = frame.name === 'SettingsSection' && index === 3 ? view : typeof initial === 'function' ? initial() : initial;
      return [value, () => {}];
    },
    useRef: value => ({ current: value }),
    useCallback: fn => fn,
    useEffect: effect => effects.push(effect),
  };
  const context = {
    window: { __ModuleLoader__: { load(spec) {
      assert.equal(spec.id, 'dsh-plugin-oauth-subs');
      exported = spec.factory(id => {
        if (id === 'react') return React;
        throw new Error('No optional host module: ' + id);
      });
    } } },
    document: { documentElement: { lang: language }, hidden: false, getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } },
    navigator: { language },
    localStorage: { getItem: () => snapshot === null ? null : JSON.stringify(snapshot) },
    console, URL, Date,
  };
  vm.runInNewContext(client, context, { filename: 'shipped-client.js' });
  const rpc = { call: () => { throw new Error('Render must not perform RPC'); } };
  exported.apply({
    get: key => key === 'connection' ? { rpc: rpcPresent ? rpc : undefined } : undefined,
    slots: {
      inject: (_slot, register) => register(),
      register: (options, component) => registrations.push({ options, component }),
    },
  });
  const main = registrations.find(entry => entry.options.name === 'main');
  assert(main, 'main slot must be registered');
  assert(registrations.some(entry => entry.options.name === 'sidebar.panellist'));
  function render(value) {
    if (Array.isArray(value)) return value.forEach(render);
    if (value === null || value === undefined || typeof value !== 'object') return;
    if (typeof value.type === 'function') {
      const previous = frame; frame = { name: value.type.name, index: 0 };
      components.push(frame.name);
      let child;
      try { child = value.type(value.props); } finally { frame = previous; }
      return render(child);
    }
    nodes.push(value);
    value.children.forEach(render); // Do not skip hidden=true.
  }
  render(React.createElement(main.component, main.options.inject()));
  const sidebar = registrations.find(entry => entry.options.name === 'sidebar.panellist');
  render(React.createElement(sidebar.component, { size: 20 }));
  return { components, nodes, effects };
}

for (const language of ['en', 'zh-CN']) {
  for (const view of ['quota', 'models', 'version']) {
    test('complete client registration and retained-panel render: ' + language + '/' + view, () => {
      const { components, nodes } = mountClient({ language, view });
      assert(components.includes('SettingsSection'));
      assert(components.includes('AboutPanel'), 'hidden AboutPanel must actually render');
      assert(components.includes('VersionBand'), 'shared version component must render');
      assert(components.includes('ModelsPanel'));
      assert.equal(components.filter(name => name === 'ProviderCard').length, 14);
      const panels = nodes.filter(node => node.props.role === 'tabpanel');
      assert(panels.some(node => node.props.key === 'version' && node.props.hidden === (view !== 'version')));
      assert(nodes.some(node => node.props.className?.startsWith('osubs-ver')));
      assert(!nodes.some(node => node.props.className?.includes('osubs-auto-row')));
      assert(nodes.some(node => node.type === 'a' && node.props.href === 'https://github.com/jianghaotj/dsh-plugin-oauth-subs#install'));
    });
  }
}
test('complete root render with cached release metadata and empty synthetic account lists', () => {
  const snapshot = {
    accounts: { kiro: { accounts: [] }, copilot: { accounts: [] } },
    catalog: { groups: [] },
    update: { version: '0.0.112', repo: 'https://github.com/jianghaotj/dsh-plugin-oauth-subs', repoSlug: 'jianghaotj/dsh-plugin-oauth-subs', status: 'update', latest: { tag: 'v0.0.113' } },
  };
  const { components, nodes } = mountClient({ snapshot });
  assert(components.includes('AboutPanel')); assert(components.includes('VersionBand'));
  const text = nodes.flatMap(node => node.children).filter(child => typeof child === 'string').join(' ');
  assert.match(text, /0\.0\.112/); assert.match(text, /v0\.0\.113/);
});
test('no RPC renders a useful fallback rather than throwing', () => {
  const { nodes, components } = mountClient({ rpcPresent: false });
  assert(components.includes('SettingsSection'));
  assert(nodes.some(node => node.type === 'p' && node.props.className === 'osubs-hint'));
});
