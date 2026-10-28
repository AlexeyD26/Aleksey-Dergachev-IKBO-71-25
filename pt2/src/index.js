import { loadConfig } from './config.js';
import { buildGraph } from './graph.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 1 && args[0] === '--help') {
    console.log('Запуск: node src/index.js [путь к config.yaml]');
    return;
  }

  if (args.length > 1) {
    throw new Error('Нужно указать только один путь к YAML-файлу.');
  }

  const configPath = args[0] ?? 'config.yaml';
  const config = loadConfig(configPath);
  const graph = await buildGraph(config, configPath);
  printGraph(config, graph);
}

function printGraph(config, graph) {
  const name = config.test_mode
    ? config.package
    : `${config.package}@${config.version}`;
  console.log(`Граф зависимостей ${name}:`);
  if (graph.size === 0) {
    console.log('Пакет исключён фильтром.');
    return;
  }

  for (const [node, dependencies] of graph) {
    const targets = dependencies.length > 0
      ? dependencies.join(', ')
      : '(нет зависимостей)';
    console.log(`${node} -> ${targets}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`Ошибка: ${error.message}`);
  process.exitCode = 1;
}
