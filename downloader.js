const path = require('path');
const fs = require('fs');
const got = require('got');
const os = require("os");
const { downloadHLS } = require('./hls');

// const downloadFolder = path.join(os.homedir(), "Downloads");
const downloadFolder = './';

// Ensure download directory exists
if (!fs.existsSync(downloadFolder)) {
  fs.mkdirSync(downloadFolder, { recursive: true });
}

function isHLSStream(url) {
  return url.endsWith('.m3u8') || url.includes('m3u8');
}

async function download(url, options = {}) {
  if (!url) {
    throw new Error("URL not specified");
  }

  // Extract filename from URL if not provided
  let filename = options.filename;
  if (!filename) {
    const urlPattern = /\/([^/]+?)(?:\.[a-z0-9]{1,5})?(?:\?|#|$)/i;
    const match = urlPattern.exec(url);
    filename = match ? match[1] : 'video';
  }

  // Add extension if missing
  if (!path.extname(filename)) {
    filename += '.mp4';
  }

  const outputPath = filename;

  if (isHLSStream(url)) {
    return downloadHLS(url, outputPath, (progress) => {
      process.stdout.write(`Downloading HLS: ${Math.round(progress)}%\r`);
    });
  }

  return new Promise((resolve, reject) => {
    const downloadStream = got.stream(url, {
      headers: options.headers || {},
    });

    let totalBytes = 0;
    let receivedBytes = 0;

    downloadStream.on('response', (response) => {
      totalBytes = parseInt(response.headers['content-length'] || 0);
    });

    downloadStream.on('downloadProgress', ({ transferred }) => {
      receivedBytes = transferred;
      const percentage = totalBytes ? Math.round((receivedBytes / totalBytes) * 100) : 0;
      process.stdout.write(`Downloading: ${percentage}%\r`);
    });

    const fileStream = fs.createWriteStream(outputPath);

    downloadStream.pipe(fileStream);

    fileStream.on('finish', () => {
      console.log(`\nDownload completed: ${outputPath}`);
      resolve(outputPath);
    });

    downloadStream.on('error', (error) => {
      fs.unlink(outputPath, () => reject(error));
    });
  });
}

module.exports = { download };