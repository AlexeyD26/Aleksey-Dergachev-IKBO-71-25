const UNIQUE_MATCH_COUNT = 1;

export function findReverseDependencies(graph, target) {
  const selected = findTarget(graph, target);
  const reversed = reverseEdges(graph);
  const stack = [selected];
  const visited = new Set();
  const packages = [];

  while (stack.length) {
    const node = stack.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    if (node !== selected) packages.push(node);
    for (const parent of [...reversed.get(node)].reverse()) {
      stack.push(parent);
    }
  }
  return { target: selected, packages };
}

function reverseEdges(graph) {
  const reversed = new Map();
  for (const node of graph.keys()) reversed.set(node, []);
  for (const [node, dependencies] of graph) {
    for (const dependency of dependencies) {
      reversed.get(dependency).push(node);
    }
  }
  return reversed;
}

function findTarget(graph, target) {
  if (graph.has(target)) return target;
  const matches = [...graph.keys()].filter((node) => {
    const name = node.replace(' [yanked]', '');
    return name === target || name.split('@')[0] === target;
  });
  if (matches.length === UNIQUE_MATCH_COUNT) return matches[0];
  if (matches.length > UNIQUE_MATCH_COUNT) {
    throw new Error(`Укажите версию пакета: ${matches.join(', ')}`);
  }
  throw new Error(`Пакет ${target} не найден в построенном графе.`);
}
