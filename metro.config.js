// Polyfill runs in scripts/polyfill-os.cjs before Expo CLI loads (metro.config.js is too late).
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const YAZIO_API_BASE = 'https://yzapi.yazio.com/v15';
const YAZIO_PROXY_PREFIX = '/api/yazio';

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Required for expo-sqlite on web (wa-sqlite.wasm).
config.resolver.assetExts.push('wasm');

// react-native-svg's fetchData.ts imports `buffer` on native; alias it to the
// npm polyfill (documented react-native-svg setup for Expo).
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer/'),
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyYazioRequest(req, res) {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');
  const targetPath =
    requestUrl.pathname.replace(YAZIO_PROXY_PREFIX, '') + requestUrl.search;
  const targetUrl = `${YAZIO_API_BASE}${targetPath}`;

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody ? await readRequestBody(req) : undefined;

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: body?.length ? body : undefined,
  });

  res.statusCode = upstream.status;
  const payload = Buffer.from(await upstream.arrayBuffer());
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === 'transfer-encoding' ||
      lower === 'content-encoding' ||
      lower === 'content-length'
    ) {
      return;
    }
    res.setHeader(key, value);
  });
  res.setHeader('Content-Length', String(payload.length));
  res.end(payload);
}

// SharedArrayBuffer requires cross-origin isolation headers.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    if (req.url?.startsWith(YAZIO_PROXY_PREFIX)) {
      proxyYazioRequest(req, res).catch((error) => {
        console.error('[yazio-proxy]', error);
        if (!res.headersSent) {
          res.statusCode = 502;
          res.end('YAZIO proxy error');
        }
      });
      return;
    }

    return middleware(req, res, next);
  };
};

module.exports = withNativeWind(config, { input: './global.css' });
