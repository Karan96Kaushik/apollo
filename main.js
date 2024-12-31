const { download } = require('./downloader');
const { files } = require('./dlFiles');
const fs = require('fs');
async function main() {
  try {
    for (const course of files) {
      console.log(`\nProcessing course: ${course.name}`);

      // create a folder for the course
      const courseFolder = `./${course.name}`;
      fs.mkdirSync(courseFolder, { recursive: true });
      
      for (const video of course.videos) {
        const filename = `./${course.name}/${video.name}.mp4`;
        console.log(`\nStarting download: ${filename}`);
        
        try {
          const outPath = await download(video.url, { filename });
          console.log('Download complete:', outPath);
        } catch (error) {
          console.error(`Failed to download ${filename}:`, error.message);
          // Continue with next video instead of exiting
          continue;
        }
      }
    }
  } catch (error) {
    console.error('Process failed:', error.message);
    process.exit(1);
  }
}

main();