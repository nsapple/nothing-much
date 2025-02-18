import { VercelRequest, VercelResponse } from '@vercel/node';
import proxy from 'express-http-proxy';
import express from 'express';
import { URL } from 'url';

const app = express();

function decodeTarget(encoded: string): string {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

app.use('/proxy/:targetEncoded', (req, res, next) => {
  const targetEncoded = req.params.targetEncoded;
  let target: string;
  try {
    target = decodeTarget(targetEncoded);
  } catch (err) {
    return res.status(400).send('Invalid target encoding.');
  }

  return proxy(target, {
    proxyReqPathResolver: req => req.url,
    userResHeaderDecorator: headers => {
      if (headers['location']) {
        try {
          const locUrl = new URL(headers['location'], target);
          headers['location'] = `/proxy/${targetEncoded}${locUrl.pathname}${locUrl.search}`;
        } catch (e) {}
      }
      return headers;
    }
  })(req, res, next);
});

export default (req: VercelRequest, res: VercelResponse) => app(req, res);
