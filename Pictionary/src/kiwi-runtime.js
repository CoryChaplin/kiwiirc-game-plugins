function getKiwi() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.kiwi;
}

module.exports = new Proxy(
  {},
  {
    get(_, prop) {
      const k = getKiwi();
      return k && k[prop];
    },
  },
);
