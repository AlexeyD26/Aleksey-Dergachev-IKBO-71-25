function formatValue(value, constants) {
  if (Array.isArray(value)) {
    const items = value.map((item) => formatValue(item, constants));
    return `[${items.join(', ')}]`;
  }

  if (typeof value === 'string') {
    return JSON.stringify(value).replaceAll('\u007f', '\\u007f');
  }

  if (value.decimal !== undefined) {
    return value.decimal.replace(/^([+-]?)0+(?=[0-9])/, '$1');
  }

  const { reference } = value;
  if (!constants.has(reference)) {
    throw new Error(`Константа «${reference}» ещё не объявлена.`);
  }
  return constants.get(reference);
}

export function toToml(declarations) {
  const constants = new Map();

  for (const { name, value } of declarations) {
    if (constants.has(name)) {
      throw new Error(`Константа «${name}» уже объявлена.`);
    }
    constants.set(name, formatValue(value, constants));
  }

  return [...constants]
    .map(([name, value]) => `${name} = ${value}\n`)
    .join('');
}
