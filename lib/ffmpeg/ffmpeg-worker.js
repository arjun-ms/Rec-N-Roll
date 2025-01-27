// Handle FFmpeg operations in sandboxed environment
let ffmpegInstance = null;
let ffmpegLoading = false;

async function initFFmpeg() {
    if (ffmpegLoading) {
        console.log('FFmpeg already loading...');
        return;
    }
    
    if (ffmpegInstance) {
        console.log('FFmpeg already initialized');
        return ffmpegInstance;
    }

    ffmpegLoading = true;
    console.log('Starting FFmpeg initialization...');

    try {
        // Check if FFmpeg is available
        if (typeof FFmpeg === 'undefined') {
            throw new Error('FFmpeg library not loaded');
        }
        console.log('FFmpeg library found');

        const { createFFmpeg } = FFmpeg;
        console.log('Creating FFmpeg instance...');

        ffmpegInstance = createFFmpeg({
            log: true,
            logger: ({ message }) => {
                console.log('FFmpeg Log:', message);
                window.parent.postMessage({ type: 'log', message }, '*');
            },
            progress: (progress) => {
                console.log('FFmpeg Progress:', progress);
                window.parent.postMessage({ type: 'progress', progress }, '*');
            }
        });

        console.log('FFmpeg instance created, loading...');
        await ffmpegInstance.load();
        console.log('FFmpeg loaded successfully');
        
        window.parent.postMessage({ type: 'loaded' }, '*');
        return ffmpegInstance;
    } catch (error) {
        console.error('FFmpeg initialization error:', error);
        window.parent.postMessage({ 
            type: 'error', 
            message: `FFmpeg initialization failed: ${error.message}` 
        }, '*');
        throw error;
    } finally {
        ffmpegLoading = false;
    }
}

// Initialize FFmpeg as soon as the script loads
console.log('FFmpeg worker script starting...');
initFFmpeg().catch(error => {
    console.error('Initial FFmpeg load failed:', error);
});

window.addEventListener('message', async function(e) {
    if (!e.data) return;
    console.log('Worker received message:', e.data.type);
    
    try {
        if (!ffmpegInstance || e.data.type === 'init') {
            await initFFmpeg();
        }

        switch (e.data.type) {
            case 'convert':
                if (!ffmpegInstance) {
                    throw new Error('FFmpeg not initialized');
                }
                
                console.log('Starting conversion...');
                const { inputData, inputName, outputName, command } = e.data;
                
                console.log('Writing input file...');
                ffmpegInstance.FS('writeFile', inputName, inputData);
                
                console.log('Running FFmpeg command:', command);
                await ffmpegInstance.run(...command);
                
                console.log('Reading output file...');
                const data = ffmpegInstance.FS('readFile', outputName);
                
                console.log('Cleaning up...');
                ffmpegInstance.FS('unlink', inputName);
                ffmpegInstance.FS('unlink', outputName);
                
                console.log('Sending result back...');
                window.parent.postMessage({ 
                    type: 'complete', 
                    result: data.buffer 
                }, '*', [data.buffer]);
                break;
        }
    } catch (error) {
        console.error('Operation error:', error);
        window.parent.postMessage({ 
            type: 'error', 
            message: error.message 
        }, '*');
    }
});

// Signal that the worker script is ready
console.log('FFmpeg worker script loaded');
window.parent.postMessage({ type: 'init' }, '*');
