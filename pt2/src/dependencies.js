import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const REQUEST_TIMEOUT = 10000;

export async function getDependencies(config, configPath) {
  if (config.test_mode) {
    const repository = readTestRepository(config, configPath);
    return getTestDependencies(repository, config.package);
  }

  const entries = await readIndex(config.repository, config.package);
  return findDependencies(entries, config.package, config.version);
}

export async function readIndex(repository, packageName) {
  const base = repository.replace(/\/$/, '') + '/';
  const url = new URL(getIndexPath(packageName), base);
  return parseIndex(await downloadIndex(url));
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
  return findDependencies(parseIndex(text), packageName, version);
}

function parseIndex(text) {
  try {
    return text.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  } catch {
    throw new Error('Репозиторий вернул некорректный JSON.');
  }
}

function findDependencies(entries, packageName, version) {
  const entry = entries.find((item) =>
    typeof item?.name === 'string'
    && item.name.toLowerCase() === packageName.toLowerCase()
    && item.vers === version,
  );
  if (!entry) {
    throw new Error(`Версия ${packageName}@${version} не найдена.`);
  }
  return getPackageDependencies(entry);
}

export function getPackageDependencies(entry) {
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

export function readTestRepository(config, configPath) {
  const path = resolve(dirname(resolve(configPath)), config.repository);
  let repository;
  try {
    repository = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('Не удалось прочитать тестовый репозиторий как JSON.');
  }

  if (!repository || typeof repository !== 'object'
    || Array.isArray(repository)) {
    throw new Error('Тестовый репозиторий должен быть JSON-объектом.');
  }
  for (const [name, names] of Object.entries(repository)) {
    const valid = /^[A-Z]$/.test(name) && Array.isArray(names)
      && names.every((item) => typeof item === 'string'
        && /^[A-Z]$/.test(item));
    if (!valid) {
      throw new Error('В тестовом репозитории нужны имена A-Z и массивы.');
    }
  }
  return repository;
}

export function getTestDependencies(repository, packageName) {
  if (!Object.hasOwn(repository, packageName)) {
    throw new Error(`Пакет ${packageName} не найден в тестовом файле.`);
  }
  const names = repository[packageName];
  return names.map((name) => ({ name, req: '', kind: 'normal' }));
}
