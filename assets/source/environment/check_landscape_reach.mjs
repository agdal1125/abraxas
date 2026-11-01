import { readFileSync } from 'node:fs';

const script = new URL('../../../scripts/check-village-reach.mjs', import.meta.url);
const source = readFileSync(script, 'utf8')
  .replaceAll('import.meta.url', JSON.stringify(script.href))
  .replace('const radius = 0.3,', 'const radius = 0.45,')
  .replace("const targets = [...map.actors, ...['lake', 'plaza', 'gate'].map(id => ({ id, ...map.zones[id] }))];", "const targets = [...map.actors, ...['lake', 'plaza', 'gate'].map(id => ({ id, ...map.zones[id] })), ...map.props.filter(p => p.asset === 'signboard')];");
await import(`data:text/javascript,${encodeURIComponent(source)}`);
