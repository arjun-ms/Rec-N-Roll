class ScreenRecorder {
    constructor() {
        console.log('🟢ScreenRecorder constructor called');
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.startTime = null;
        this.stopping = false;
        this.recording = false;
        this.mimeType = 'video/webm'; // Use simple MIME type
        console.log('Using MIME type:', this.mimeType);
    }

    async startRecording() {
        if (this.recording || this.stopping) {
            await this.stopRecording();
        }

        try {
            // Reset state
            this.recordedChunks = [];
            this.stopping = false;
            this.recording = false;
            this.mediaRecorder = null;
            this.stream = null;
            this.startTime = null;

            // Get screen stream with audio
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.stream);

            // Set up data handler
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            // Handle errors
            this.mediaRecorder.onerror = (error) => {
                console.error('MediaRecorder error:', error);
                this.recording = false;
                this.stopping = false;
            };

            // Handle stream end
            this.stream.getVideoTracks()[0].addEventListener('ended', () => {
                if (this.recording && !this.stopping) {
                    this.stopRecording().catch(console.error);
                }
            });

            // Start recording with a shorter timeslice for more frequent data
            this.startTime = Date.now();
            this.recording = true;
            this.mediaRecorder.start(100); // Get data every 100ms
            return true;
        } catch (error) {
            this.cleanup();
            throw error;
        }
    }

    cleanup() {
        this.stopping = false;
        this.recording = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.stream = null;
        this.mediaRecorder = null;
        this.startTime = null;
    }

    stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.recording) {
                this.cleanup();
                resolve(null);
                return;
            }

            this.stopping = true;
            
            const handleStop = async () => {
                try {
                    // Create final blob from all chunks
                    const finalBlob = new Blob(this.recordedChunks, { type: this.mimeType });
                    console.log('Final recording size:', finalBlob.size, 'bytes');

                    // Convert blob to array buffer
                    const arrayBuffer = await finalBlob.arrayBuffer();
                    
                    // Send to background script
                    const response = await chrome.runtime.sendMessage({
                        action: 'STORE_RECORDED_BLOB',
                        chunks: [arrayBuffer],
                        type: this.mimeType
                    });

                    if (!response?.success) {
                        throw new Error('Failed to store recording');
                    }

                    this.cleanup();
                    resolve(finalBlob);
                } catch (error) {
                    this.cleanup();
                    reject(error);
                }
            };

            this.mediaRecorder.onstop = handleStop;
            this.mediaRecorder.stop();
        });
    }

    isRecording() {
        return this.recording && !this.stopping;
    }

    getRecordingTime() {
        return this.startTime && this.recording ? 
            Math.floor((Date.now() - this.startTime) / 1000) : 0;
    }
}

// Create recorder instance
const recorder = new ScreenRecorder();

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'START_RECORDING':
            recorder.startRecording()
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ 
                    success: false, 
                    error: error.message 
                }));
            return true;

        case 'STOP_RECORDING':
            recorder.stopRecording()
                .then(() => {
                    chrome.tabs.create({
                        url: chrome.runtime.getURL('preview.html')
                    });
                    sendResponse({ success: true });
                })
                .catch(error => sendResponse({ 
                    success: false, 
                    error: error.message 
                }));
            return true;

        case 'GET_RECORDING_STATUS':
            sendResponse({
                isRecording: recorder.isRecording(),
                duration: recorder.getRecordingTime()
            });
            return true;
    }
});