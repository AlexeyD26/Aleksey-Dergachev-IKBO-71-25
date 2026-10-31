import {
  accessSync, constants, existsSync, readFileSync, statSync,
} from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { parse } from 'yaml';
import { valid } from 'semver';

const FIELDS = [
  'package', 'repository', 'test_mode', 'version', 'output', 'filter',
];

export function loadConfig(filePath) {
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(`Не удалось прочитать файл настроек: ${filePath}`);
  }

  let config;
  try {
    config = parse(text);
  } catch {
    throw new Error('Некорректный YAML: проверьте отступы и ключи.');
  }

  validateFields(config);
  validateValues(config);
  const folder = dirname(resolve(filePath));
  validateRepository(config, folder);
  validateOutput(config.output, folder);
  return config;
}

function validateFields(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('В YAML должен быть объект с настройками.');
  }

  for (const field of FIELDS) {
    if (!Object.hasOwn(config, field)) {
      throw new Error(`Отсутствует параметр: ${field}`);
    }
  }

  for (const field of Object.keys(config)) {
    if (!FIELDS.includes(field)) {
      throw new Error(`Неизвестный параметр: ${field}`);
    }
  }
}

function validateValues(config) {
  for (const field of FIELDS) {
    if (field === 'test_mode') continue;
    if (typeof config[field] !== 'string') {
      throw new Error(`Параметр ${field} должен быть строкой.`);
    }
    if (field !== 'filter' && config[field].trim() === '') {
      throw new Error(`Параметр ${field} не должен быть пустым.`);
    }
  }

  if (typeof config.test_mode !== 'boolean') {
    throw new Error('Параметр test_mode должен быть true или false.');
  }

  const namePattern = config.test_mode
    ? /^[A-Z]$/
    : /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
  if (!namePattern.test(config.package)) {
    throw new Error('Некорректное имя package; в тестовом режиме: A-Z.');
  }

  if (!isVersion(config.version)) {
    throw new Error('Некорректная version. Пример версии: "1.0.0".');
  }
}

function isVersion(version) {
  return /^\d/.test(version)
    && version.trim() === version
    && valid(version) !== null;
}

function validateRepository(config, folder) {
  if (config.test_mode) {
    const filePath = resolve(folder, config.repository);
    try {
      accessSync(filePath, constants.R_OK);
      if (!statSync(filePath).isFile()) throw new Error();
    } catch {
      throw new Error('Параметр repository: тестовый файл недоступен.');
    }
    return;
  }

  try {
    const url = new URL(config.repository);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error('Параметр repository: нужен HTTP или HTTPS URL.');
  }
}

function validateOutput(output, folder) {
  if (extname(output).toLowerCase() !== '.png') {
    throw new Error('Параметр output: нужен файл с расширением .png.');
  }

  const filePath = resolve(folder, output);
  try {
    accessSync(dirname(filePath), constants.W_OK);
    if (!statSync(dirname(filePath)).isDirectory()) {
      throw new Error();
    }
    if (existsSync(filePath)) {
      if (!statSync(filePath).isFile()) throw new Error();
      accessSync(filePath, constants.W_OK);
    }
  } catch {
    throw new Error('Параметр output: файл или папка для записи недоступны.');
  }
}
