const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIR = __dirname;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const fileContent = `const rolesData = ${JSON.stringify(data, null, 2)};\n`;
        const dataPath = path.join(DIR, 'data', 'data.js');
        if (!fs.existsSync(path.dirname(dataPath))) {
          fs.mkdirSync(path.dirname(dataPath), { recursive: true });
        }
        fs.writeFileSync(dataPath, fileContent);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  let filePath;
  if (req.url === '/') {
    filePath = path.join(DIR, 'index.html');
  } else {
    filePath = path.join(DIR, req.url);
  }
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code == 'ENOENT') {
        if (req.url === '/data/data.js') {
          res.writeHead(200, { 'Content-Type': 'text/javascript' });
          res.end('const rolesData = [];\n');
        } else {
          res.writeHead(404);
          res.end('File not found');
        }
      }
      else {
        res.writeHead(500);
        res.end('Server Error: '+error.code);
      }
    }
    else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
