const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3000;
const DIR = __dirname;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

const dataDir = path.join(DIR, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const agyConfigDir = path.join(dataDir, 'agy-config');
if (!fs.existsSync(agyConfigDir)) fs.mkdirSync(agyConfigDir, { recursive: true });

const atsDir = path.join(dataDir, 'ats');
if (!fs.existsSync(atsDir)) fs.mkdirSync(atsDir, { recursive: true });

const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];

  if (req.method === 'POST' && pathname === '/save') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const fileContent = `const rolesData = ${JSON.stringify(data, null, 2)};\n`;
        const dataPath = path.join(DIR, 'data', 'data.js');
        
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

  if (req.method === 'POST' && pathname === '/api/agy') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { prompt } = JSON.parse(body);
        const child = spawn('unbuffer', ['-p', 'agy', '--print', '--dangerously-skip-permissions', prompt], {
          env: { ...process.env, TERM: 'dumb', NO_COLOR: '1' }
        });
        
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Transfer-Encoding': 'chunked'
        });
        
        // Regex to match ANSI escape codes including extended CSI and DCS sequences
        const stripAnsi = (str) => str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');

        child.stdout.on('data', (data) => {
          res.write(stripAnsi(data.toString()));
        });
        child.stderr.on('data', (data) => {
          res.write(stripAnsi(data.toString()));
        });
        child.on('close', (code) => {
          res.end(`\n\nProcess exited with code ${code}`);
        });
        child.on('error', (err) => {
          res.write(`\n\nFailed to start process: ${err.message}\nMake sure 'ato' is installed and accessible in this environment.`);
          res.end();
        });
      } catch (err) {
        res.writeHead(500);
        res.end(err.message);
      }
    });
    return;
  }

  let filePath;
  if (pathname === '/') {
    filePath = path.join(DIR, 'index.html');
  } else {
    filePath = path.join(DIR, pathname);
  }
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code == 'ENOENT') {
        if (pathname === '/data/data.js') {
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
