const urlParams = new URLSearchParams(window.location.search);
const streamUrl = urlParams.get('url');

if (Hls.isSupported()) {
    const video = document.getElementById('video');
    const hls = new Hls();
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, function() {
        video.play();
    });
} 

function downloadVideo() {
    downloadM3U8ToMP4(streamUrl, 'video.mp4');
} 

document.addEventListener('DOMContentLoaded', function() {
    const downloadButton = document.getElementById('downloadButton');
    if (downloadButton) {
        downloadButton.addEventListener('click', downloadVideo);
    }
}); 

async function downloadM3U8ToMP4(m3u8Url, filename = 'video.mp4', onProgress = progress => console.log(`Progress: ${progress}%`)) {
    if (!Hls.isSupported()) {
        throw new Error('HLS.js is not supported in this browser');
    }

    return new Promise((resolve, reject) => {
        const hls = new Hls({
            fragLoadingTimeOut: 120000,
            manifestLoadingTimeOut: 120000,
            enableWorker: true,
            maxBufferLength: 0,
            maxMaxBufferLength: 0,
            startLevel: -1,
            capLevelToPlayerSize: true,
            debug: true,
            maxFragLookUpTolerance: 0.2,
            backBufferLength: 0,
            progressive: false,
            fragLoadingMaxRetry: 5,
            fragLoadingRetryDelay: 1000,
            fragLoadingMaxRetryTimeout: 5000,
            manifestLoadingMaxRetry: 5,
            manifestLoadingRetryDelay: 1000,
            abrEwmaDefaultEstimate: 500000
        });

        const videoElement = document.createElement('video');
        const mediaBuffer = [];
        let totalFragments = 0;
        let downloadedFragments = 0;
        let isDownloading = false;
        let lastProgress = 0;
        let retryCount = 0;
        const MAX_RETRIES = 3;

        const updateProgress = () => {
            if (totalFragments === 0) return;
            const progress = Math.round((downloadedFragments / totalFragments) * 100);
            if (progress !== lastProgress) {
                lastProgress = progress;
                onProgress(progress);
            }
        };

        hls.loadSource(m3u8Url);
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSING_ERROR, (event, data) => {
            console.error('Manifest parsing error:', data);
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                console.log(`Retrying manifest load... Attempt ${retryCount}`);
                setTimeout(() => hls.loadSource(m3u8Url), 1000 * retryCount);
            } else {
                reject(`Failed to parse manifest after ${MAX_RETRIES} attempts`);
                cleanup();
            }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            const levels = hls.levels;
            const highestQuality = levels.length - 1;
            hls.currentLevel = highestQuality;

            isDownloading = true;
            console.log('Starting download...');
        });

        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
            if (totalFragments === 0) {
                totalFragments = data.details.fragments.length;
                console.log(`Total fragments to download: ${totalFragments}`);
            }
        });

        let lastFragmentTime = Date.now();
        const STALL_TIMEOUT = 15000;
        let stallCount = 0;
        const MAX_STALLS = 3;

        hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
            lastFragmentTime = Date.now();
            console.log(`Loading fragment ${data.frag.sn}`);
        });

        let currentFragment = 0;
        const fragmentRetries = new Map();
        const MAX_FRAGMENT_RETRIES = 3;

        const loadFragment = (fragmentId) => {
            if (!isDownloading) return;
            
            const retryCount = fragmentRetries.get(fragmentId) || 0;
            if (retryCount >= MAX_FRAGMENT_RETRIES) {
                console.error(`Failed to load fragment ${fragmentId} after ${MAX_FRAGMENT_RETRIES} attempts`);
                reject(`Fragment ${fragmentId} failed to load`);
                cleanup();
                return;
            }

            console.log(`Attempting to load fragment ${fragmentId} (attempt ${retryCount + 1})`);
            hls.trigger(Hls.Events.LEVEL_LOADING, {
                frag: { sn: fragmentId }
            });
        };

        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
            if (!isDownloading) return;

            try {
                mediaBuffer.push(data.payload.data || data.payload);
                downloadedFragments++;
                lastFragmentTime = Date.now();
                currentFragment = data.frag.sn;
                console.log(`Successfully loaded fragment ${currentFragment}`);
                updateProgress();

                fragmentRetries.delete(currentFragment);

                if (downloadedFragments === totalFragments) {
                    finishDownload();
                }
            } catch (error) {
                console.error(`Error processing fragment ${currentFragment}:`, error);
                const retryCount = fragmentRetries.get(currentFragment) || 0;
                fragmentRetries.set(currentFragment, retryCount + 1);
                loadFragment(currentFragment);
            }
        });

        const stallCheckInterval = setInterval(() => {
            if (isDownloading && (Date.now() - lastFragmentTime) > STALL_TIMEOUT) {
                console.warn(`Download appears to be stalled at fragment ${currentFragment}`);
                loadFragment(currentFragment);
            }
        }, 5000);

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            console.log(`Switched to quality level ${data.level}`);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS Error:', {
                type: data.type,
                details: data.details,
                fatal: data.fatal,
                frag: data.frag ? data.frag.sn : 'unknown'
            });
            
            if (data.fatal) {
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    const fragId = data.frag ? data.frag.sn : currentFragment;
                    const retryCount = fragmentRetries.get(fragId) || 0;
                    if (retryCount < MAX_FRAGMENT_RETRIES) {
                        fragmentRetries.set(fragId, retryCount + 1);
                        console.log(`Retrying fragment ${fragId} after network error`);
                        setTimeout(() => loadFragment(fragId), 1000 * (retryCount + 1));
                        return;
                    }
                }
                reject(`Fatal error: ${data.type} - ${data.details}`);
                cleanup();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError();
            }
        });

        const finishDownload = () => {
            try {
                console.log('Finalizing download...');
                isDownloading = false;
                
                const blob = new Blob(mediaBuffer, { type: 'video/mp4' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;

                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                cleanup();
                URL.revokeObjectURL(url);
                resolve('Download complete');
            } catch (error) {
                console.error('Error finalizing download:', error);
                reject(error);
                cleanup();
            }
        };

        const cleanup = () => {
            try {
                clearInterval(stallCheckInterval);
                hls.destroy();
                mediaBuffer.length = 0;
                isDownloading = false;
            } catch (error) {
                console.error('Error during cleanup:', error);
            }
        };
    });
}

// Example usage:
/*
downloadM3U8ToMP4(
    'https://example.com/video.m3u8',
    'video.mp4',
    (progress) => console.log(`Download progress: ${progress}%`)
).then(() => {
    console.log('Download completed successfully');
}).catch(error => {
    console.error('Download failed:', error);
});
*/