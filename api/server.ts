import express from 'express';
import proxy from 'express-http-proxy';
import path from 'path';
import { URL } from 'url';

const app = express();
const port = process.env.PORT || 3000;

// Serve the static HTML UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * Helper functions for URL-safe Base64 encoding/decoding.
 */
function encodeTarget(url: string): string {
  return Buffer.from(url)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeTarget(encoded: string): string {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * All requests to /proxy/:targetEncoded/* will be forwarded.
 */
app.use('/proxy/:targetEncoded', (req, res, next) => {
  const targetEncoded = req.params.targetEncoded;
  let target: string;
  try {
    target = decodeTarget(targetEncoded);
  } catch (err) {
    return res.status(400).send('Invalid target URL encoding.');
  }

  let targetUrlObj: URL;
  try {
    targetUrlObj = new URL(target);
  } catch (err) {
    return res.status(400).send('Invalid target URL.');
  }
  const targetHostname = targetUrlObj.hostname;

  // Set up the proxy middleware with dynamic target and response rewriting.
  return proxy(target, {
    // Remove the /proxy/:targetEncoded prefix before forwarding.
    proxyReqPathResolver: function (req) {
      return req.url; // req.url already equals the remaining path.
    },
    // Modify HTML responses by rewriting absolute URLs that point to the target.
    userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        let data = proxyResData.toString('utf8');
        // This regex matches any absolute URL that ends with the target hostname.
        const regex = new RegExp(
          `https?://[^/"']*${targetHostname.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`,
          'g'
        );
        // Replace matched URLs with our proxy route.
        data = data.replace(regex, '/proxy/' + targetEncoded);
        return data;
      }
      return proxyResData;
    },
    // Rewrite Location headers on redirects so that they continue via the proxy.
    userResHeaderDecorator: function (headers, userReq, userRes, proxyReq, proxyRes) {
      if (headers['location']) {
        try {
          // Use the target as base in case the location is relative.
          const locUrl = new URL(headers['location'], target);
          if (locUrl.hostname.endsWith(targetHostname)) {
            headers['location'] = '/proxy/' + targetEncoded + locUrl.pathname + locUrl.search;
          }
        } catch (e) {
          // If parsing fails, leave the header as is.
        }
      }
      return headers;
    },
    proxyErrorHandler: function (err, res, next) {
      console.error('Proxy error:', err);
      res.status(500).send('Proxy error.');
    }
  })(req, res, next);
});

app.listen(port, () => {
  console.log(`Reverse proxy server listening on port ${port}`);
});
