import { VercelRequest, VercelResponse } from '@vercel/node';
import uvProxy from 'ultraviolet-proxy'; // Make sure this package is installed

function decodeTarget(encoded: string): string {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export default async (req: VercelRequest, res: VercelResponse) => {
  // Extract the encoded target from the query string (or from the dynamic path parameter)
  const { targetEncoded } = req.query;
  if (typeof targetEncoded !== 'string') {
    return res.status(400).send('Missing target encoding.');
  }

  let target: string;
  try {
    target = decodeTarget(targetEncoded);
  } catch (error) {
    return res.status(400).send('Invalid target encoding.');
  }

  // Configure ultraviolet proxy options.
  // This example assumes ultraviolet-proxy supports rewriting links/redirects and handling subdomains.
  const options = {
    target,                // The URL to proxy
    rewriteLinks: true,    // Option to rewrite URLs in HTML responses
    // You can add additional configuration options (like headers, timeouts, etc.) if needed.
  };

  try {
    // uvProxy returns a handler function that takes (req, res) like an Express middleware.
    const handler = uvProxy(options);
    await handler(req, res);
  } catch (err) {
    console.error('UV Proxy Error:', err);
    res.status(500).send('Proxy error.');
  }
};
