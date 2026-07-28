(function attachCivitaiDomainConfig(globalScope) {
  const DEFAULT_CIVITAI_ORIGIN = 'https://civitai.com';
  const SUPPORTED_CIVITAI_ORIGINS = [
    DEFAULT_CIVITAI_ORIGIN,
    'https://civitai.red',
  ];
  const SUPPORTED_CIVITAI_MATCH_PATTERNS = SUPPORTED_CIVITAI_ORIGINS.map(
    (origin) => `${origin}/*`
  );

  function getUrlOrigin(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }

    try {
      return new URL(value).origin;
    } catch (error) {
      return null;
    }
  }

  function normalizeSupportedOrigin(value) {
    const origin = getUrlOrigin(value) || value;
    return SUPPORTED_CIVITAI_ORIGINS.includes(origin) ? origin : null;
  }

  function getApiBaseUrl(url, fallbackOrigin = DEFAULT_CIVITAI_ORIGIN) {
    return normalizeSupportedOrigin(url) ||
      normalizeSupportedOrigin(fallbackOrigin) ||
      DEFAULT_CIVITAI_ORIGIN;
  }

  function resolvePreferredOrigin({
    senderUrl = null,
    activeTabUrls = [],
    openTabUrls = [],
    storedOrigin = null,
    fallbackOrigin = DEFAULT_CIVITAI_ORIGIN,
  } = {}) {
    const candidates = [
      senderUrl,
      ...activeTabUrls,
      ...openTabUrls,
      storedOrigin,
      fallbackOrigin,
    ];

    for (const candidate of candidates) {
      const origin = normalizeSupportedOrigin(candidate);
      if (origin) {
        return origin;
      }
    }

    return DEFAULT_CIVITAI_ORIGIN;
  }

  const config = {
    DEFAULT_CIVITAI_ORIGIN,
    SUPPORTED_CIVITAI_ORIGINS,
    SUPPORTED_CIVITAI_MATCH_PATTERNS,
    normalizeSupportedOrigin,
    getApiBaseUrl,
    resolvePreferredOrigin,
  };

  globalScope.CivitaiDomainConfig = config;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
