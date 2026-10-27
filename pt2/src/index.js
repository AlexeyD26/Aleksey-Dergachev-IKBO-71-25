import { loadConfig } from './config.js';
import { getDependencies } from './dependencies.js';

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
  const dependencies = await getDependencies(config, configPath);
  printDependencies(config, dependencies);
}

function printDependencies(config, dependencies) {
  const name = config.test_mode
    ? config.package
    : `${config.package}@${config.version}`;
  console.log(`Прямые зависимости ${name}:`);
  if (dependencies.length === 0) {
    console.log('Прямых зависимостей нет.');
    return;
  }

  for (const dependency of dependencies) {
    const name = dependency.package ?? dependency.name;
    const details = [dependency.kind ?? 'normal'];
    if (dependency.optional) details.push('optional');
    if (dependency.target) details.push(dependency.target);
    if (dependency.package) details.push(`имя: ${dependency.name}`);
    const label = `${name} ${dependency.req}`.trim();
    console.log(`- ${label} [${details.join(', ')}]`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`Ошибка: ${error.message}`);
  process.exitCode = 1;
}
