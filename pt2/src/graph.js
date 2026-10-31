import { createRepository } from './repository.js';

export async function buildGraph(config, configPath) {
  const graph = new Map();
  if (isExcluded(config.package, config.filter)) return graph;
  const loadPackage = createRepository(config, configPath);
  const stack = [{
    name: config.package, req: config.version, exact: true, parent: null,
  }];

  while (stack.length) {
    const item = stack.pop();
    if (isExcluded(item.name, config.filter)) continue;
    if (item.registry && item.registry !== config.repository) {
      throw new Error(`Другой реестр пока не поддерживается: ${item.registry}`);
    }
    const node = await loadPackage(item.name, item.req, item.exact);
    if (item.parent !== null) addEdge(graph, item.parent, node.id);
    if (graph.has(node.id)) continue;
    graph.set(node.id, []);

    for (const dependency of [...node.dependencies].reverse()) {
      stack.push({
        name: dependency.package ?? dependency.name,
        req: dependency.req,
        registry: dependency.registry,
        exact: false,
        parent: node.id,
      });
    }
  }
  return graph;
}

function isExcluded(name, filter) {
  return filter !== '' && name.includes(filter);
}

function addEdge(graph, from, to) {
  const neighbors = graph.get(from);
  if (!neighbors.includes(to)) neighbors.push(to);
}
