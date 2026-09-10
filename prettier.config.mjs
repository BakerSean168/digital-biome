export default {
  plugins: ['prettier-plugin-astro'],
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  overrides: [
    {
      files: '*.astro',
      options: { parser: 'astro' },
    },
  ],
};
