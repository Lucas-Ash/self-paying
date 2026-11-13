/* Local preview: serves ./dist under the configured base path. */
const http = require('http'), fs = require('fs'), path = require('path');
const base = require('./site.config.json').basePath || '';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };
const port = process.env.PORT || 8080;
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith(base)) { res.writeHead(302, { Location: base + '/' }); return res.end(); }
  let f = path.join(__dirname, 'dist', path.normalize(p.slice(base.length)));
  if (f.endsWith(path.sep) || !path.extname(f)) f = path.join(f, 'index.html');
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end(fs.readFileSync(path.join(__dirname, 'dist/404.html'))); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(port, () => console.log(`http://localhost:${port}${base}/`));
