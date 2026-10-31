const comparisons = new Set(['==', '!=', '===', '!==', '<', '>', '<=', '>=']);

function isNumericLiteral(node) {
  if (node.type === 'Literal') return typeof node.value === 'number';
  return node.type === 'UnaryExpression'
    && ['-', '+'].includes(node.operator)
    && node.argument.type === 'Literal'
    && typeof node.argument.value === 'number';
}

const numericComparisons = {
  meta: {
    type: 'suggestion', schema: [],
    messages: { constant: 'Используйте именованную константу в сравнении.' },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (comparisons.has(node.operator)
          && [node.left, node.right].some(isNumericLiteral)) {
          context.report({ node, messageId: 'constant' });
        }
      },
    };
  },
};

const noComments = {
  meta: {
    type: 'suggestion', schema: [],
    messages: { comment: 'Описание функций хранится в README.' },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          context.report({ loc: comment.loc, messageId: 'comment' });
        }
      },
    };
  },
};

export default [{
  files: ['**/*.js', '**/*.cjs'],
  ignores: ['node_modules/**', 'coverage/**'],
  languageOptions: {
    ecmaVersion: 'latest',
    globals: {
      process: 'readonly', console: 'readonly', URL: 'readonly',
      fetch: 'readonly', AbortSignal: 'readonly', Response: 'readonly',
      DOMException: 'readonly',
    },
  },
  plugins: {
    coursework: {
      rules: { 'numeric-comparisons': numericComparisons,
        'no-comments': noComments },
    },
  },
  rules: {
    'max-len': ['error', { code: 80 }],
    'max-lines': ['error', 1000],
    'max-lines-per-function': ['error', 40],
    'max-params': ['error', 7],
    complexity: ['error', 10],
    camelcase: ['error', { properties: 'never', ignoreDestructuring: true }],
    indent: ['error', 2],
    'no-undef': 'error',
    'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    'coursework/numeric-comparisons': 'error',
    'coursework/no-comments': 'error',
  },
}, {
  files: ['**/*.cjs'],
  languageOptions: { globals: { __dirname: 'readonly' } },
}];
