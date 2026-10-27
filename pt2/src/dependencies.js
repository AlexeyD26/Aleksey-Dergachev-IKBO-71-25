import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const REQUEST_TIMEOUT = 10000;

export async function getDependencies(config, configPath) {
  if (config.test_mode) {
    return readTestDependencies(config, configPath);
  }

  const base = config.repository.replace(/\/$/, '') + '/';
  const url = new URL(getIndexPath(config.package), base);
  const text = await downloadIndex(url);
  return parseDependencies(text, config.package, config.version);
}

export function getIndexPath(packageName) {
  const name = packageName.toLowerCase();
  if (name.length <= 2) return `${name.length}/${name}`;
  if (name.length === 3) return `3/${name[0]}/${name}`;
  return `${name.slice(0, 2)}/${name.slice(2, 4)}/${name}`;
}

async function downloadIndex(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (response.status === 404) {
      throw new Error('Пакет не найден в репозитории (HTTP 404).');
    }
    if (!response.ok) {
      throw new Error(`Репозиторий вернул HTTP ${response.status}.`);
    }
    return await response.text();
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('Репозиторий не ответил за 10 секунд.');
    }
    if (error instanceof TypeError) {
      throw new Error('Не удалось получить данные из репозитория.');
    }
    throw error;
  }
}

export function parseDependencies(text, packageName, version) {
  let entries;
  try {
    entries = text.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  } catch {
    throw new Error('Репозиторий вернул некорректный JSON.');
  }

  const entry = entries.find((item) =>
    typeof item?.name === 'string'
    && item.name.toLowerCase() === packageName.toLowerCase()
    && item.vers === version,
  );
  if (!entry) {
    throw new Error(`Версия ${packageName}@${version} не найдена.`);
  }
  if (!Array.isArray(entry.deps) || !entry.deps.every(isDependency)) {
    throw new Error('Некорректный список зависимостей в репозитории.');
  }
  return entry.deps;
}

function isDependency(dependency) {
  return dependency !== null
    && typeof dependency === 'object'
    && typeof dependency.name === 'string'
    && dependency.name.length > 0
    && typeof dependency.req === 'string'
    && dependency.req.length > 0;
}

function readTestDependencies(config, configPath) {
  const path = resolve(dirname(resolve(configPath)), config.repository);
  let repository;
  try {
    repository = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('Не удалось прочитать тестовый репозиторий как JSON.');
  }

  if (!repository || !Object.hasOwn(repository, config.package)) {
    throw new Error(`Пакет ${config.package} не найден в тестовом файле.`);
  }
  const names = repository[config.package];
  const valid = Array.isArray(names) && names.every((name) =>
    typeof name === 'string' && /^[A-Z]$/.test(name),
  );
  if (!valid) {
    throw new Error('Зависимости тестового пакета должны быть буквами A-Z.');
  }
  return names.map((name) => ({ name, req: '', kind: 'normal' }));
}
