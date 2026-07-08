module.exports = {
  '*.{ts,tsx,js,jsx}': ['eslint --fix --no-warn-ignored', 'prettier --write'],
  '*.{json,md,yml,yaml,css,html}': ['prettier --write'],
};
