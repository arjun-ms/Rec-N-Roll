// FFmpeg Web Worker
self.importScripts('./ffmpeg.min.js');

let ffmpeg = null;

async function initFFmpeg() {
    if (ffmpeg) return;

    try {
        const { createFFmpeg } = FFmpeg;
        ffmpeg = createFFmpeg({
            log: true,
            logger: ({ message }) => {
                console.log('FFmpeg Log:', message);
                self.postMessage({ type: 'log', message });
            },
            progress: (progress) => {
                console.log('FFmpeg Progress:', progress);
                self.postMessage({ type: 'progress', progress });
            },
            mainName: 'main',
            corePath: './ffmpeg-core.js',
            wasmPath: './ffmpeg-core.wasm',
            workerPath: './ffmpeg-core.worker.js'
        });

        console.log('Loading FFmpeg...');
        await ffmpeg.load();
        console.log('FFmpeg loaded successfully');
        self.postMessage({ type: 'ready' });
    } catch (error) {
        console.error('FFmpeg initialization error:', error);
        self.postMessage({ type: 'error', message: error.message });
    }
}

// Initialize FFmpeg when the worker starts
initFFmpeg().catch(error => {
    console.error('Failed to initialize FFmpeg:', error);
});

self.onmessage = async function(e) {
    if (!e.data) return;

    try {
        const { type, inputData, inputName, outputName, command } = e.data;

        switch (type) {
            case 'convert':
                if (!ffmpeg) {
                    throw new Error('FFmpeg not initialized');
                }

                console.log('Writing input file...');
                ffmpeg.FS('writeFile', inputName, inputData);

                console.log('Running FFmpeg command:', command);
                await ffmpeg.run(...command);

                console.log('Reading output file...');
                const data = ffmpeg.FS('readFile', outputName);

                console.log('Cleaning up...');
                ffmpeg.FS('unlink', inputName);
                ffmpeg.FS('unlink', outputName);

                console.log('Sending result back...');
                self.postMessage({
                    type: 'complete',
                    result: data.buffer
                }, [data.buffer]);
                break;
        }
    } catch (error) {
        console.error('Operation error:', error);
        self.postMessage({
            type: 'error',
            message: error.message
        });
    }
};
