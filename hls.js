const got = require('got');
const { Parser } = require('m3u8-parser');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

async function fetchM3u8Content(url) {
  try {
    const response = await got(url);
    return response.body;
  } catch (error) {
    console.log(error?.response?.body || error.message);
    throw new Error(`Failed to fetch M3U8: ${error?.response?.body || error.message}`);
  }
}

function parseM3u8(content) {
  const parser = new Parser();
  parser.push(content);
  parser.end();
  return parser.manifest;
}

async function getBestQualityStream(masterUrl) {
  const content = await fetchM3u8Content(masterUrl);
  const manifest = parseM3u8(content);

  console.log(Object.keys(manifest));

  if (!manifest.playlists || manifest.playlists.length === 0) {
    // This might be a direct media playlist
    return masterUrl;
  }

  // Sort playlists by bandwidth (quality) and get the highest quality
  const playlists = manifest.playlists.sort((a, b) => 
    (b.attributes.BANDWIDTH || 0) - (a.attributes.BANDWIDTH || 0)
  );

  const bestQuality = playlists[0];
  const streamUrl = new URL(bestQuality.uri, masterUrl).toString();
  return streamUrl;
}

async function downloadHLS(url, outputPath, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create temporary directory for segments
      const tempDir = path.join(path.dirname(outputPath), '.temp-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });
      // console.log(`Created temporary directory: ${tempDir}`);

      // Get the best quality stream URL
      // console.log('Fetching best quality stream...');
      const streamUrl = await getBestQualityStream(url);
      // console.log(`Selected stream URL: ${streamUrl}`);
      
      // Download segments to temporary files
      const segmentFiles = [];
      let totalSegments = 0;
      let downloadedSegments = 0;

      // Fetch the media playlist
      // console.log('Fetching media playlist...');
      const mediaContent = await fetchM3u8Content(streamUrl);
      const mediaManifest = parseM3u8(mediaContent);
      totalSegments = mediaManifest.segments.length;
      // console.log(`Total segments to download: ${totalSegments}`);

      // Download each segment
      for (let i = 0; i < mediaManifest.segments.length; i++) {
        process.stdout.write(`Downloading segment ${i + 1}/${totalSegments} (${Math.round((i + 1) / totalSegments * 100)}%)\r`);
        const segment = mediaManifest.segments[i];
        const segmentUrl = new URL(segment.uri, streamUrl).toString();
        const segmentPath = path.join(tempDir, `segment-${i}.ts`);
        
        try {
          const response = await got(segmentUrl);
          fs.writeFileSync(segmentPath, response.rawBody);
          segmentFiles.push(segmentPath);
          downloadedSegments++;
          
          if (onProgress) {
            onProgress((downloadedSegments / totalSegments) * 100);
          }
        } catch (error) {
          console.error(`Failed to download segment ${i}: ${error.message}`);
        }
      }

      // console.log('All segments downloaded, preparing for concatenation...');
      // Create concat file
      const concatFile = path.join(tempDir, 'concat.txt');
      const concatContent = segmentFiles.map(f => `file '${path.basename(f)}'`).join('\n');
      fs.writeFileSync(concatFile, concatContent);

      console.log('Starting FFmpeg process...');
      console.log(outputPath, concatFile);
      const ffmpegProcess = spawn(ffmpeg, [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFile,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        outputPath
      ]);

      ffmpegProcess.stderr.on('data', (data) => {
        console.log(`FFmpeg: ${data.toString()}`);
      });

      ffmpegProcess.on('close', (code) => {
        // return
        console.log('Cleaning up temporary files...');
        fs.rmSync(tempDir, { recursive: true, force: true });

        if (code === 0) {
          console.log('HLS download completed successfully');
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

    } catch (error) {
      console.error('Error in downloadHLS:', error);
      reject(error);
    }
  });
}

module.exports = { downloadHLS };