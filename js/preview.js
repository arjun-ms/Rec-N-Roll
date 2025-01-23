document.addEventListener('DOMContentLoaded', async () => {
    const video = document.getElementById('preview');
    const saveGoogleDriveBtn = document.getElementById('saveGoogleDrive');
    const shareButton = document.getElementById('shareButton');
    let recordingBlob = null;

    shareButton.style.display = 'none';

    function getMediaErrorMessage(error) {
        switch (error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
                return 'Video playback was aborted.';
            case MediaError.MEDIA_ERR_NETWORK:
                return 'A network error occurred while loading the video.';
            case MediaError.MEDIA_ERR_DECODE:
                return 'Video decoding failed - try a different format.';
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                return 'Video format or MIME type not supported.';
            default:
                return `An unknown error occurred: ${error.message}`;
        }
    }

    function showError(message) {
        console.error('Video Error:', message);
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '20px';
        errorDiv.style.textAlign = 'center';
        errorDiv.textContent = message;
        video.parentNode.insertBefore(errorDiv, video.nextSibling);
    }

    async function blobToBase64(blob) {
        if (!(blob instanceof Blob)) {
            console.error('Invalid blob:', blob);
            throw new Error('Invalid blob object');
        }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
            reader.readAsDataURL(blob);
        });
    }

    async function loadVideo(videoElement, dataUrl) {
        return new Promise((resolve, reject) => {
            let loadTimeout;
            let loadingStarted = false;

            const cleanup = () => {
                clearTimeout(loadTimeout);
                videoElement.removeEventListener('loadeddata', handleLoadedData);
                videoElement.removeEventListener('progress', handleProgress);
                videoElement.removeEventListener('error', handleError);
            };

            const handleLoadedData = () => {
                cleanup();
                resolve(true);
            };

            const handleProgress = () => {
                if (!loadingStarted) {
                    loadingStarted = true;
                    console.log('Video loading started...');
                }
                clearTimeout(loadTimeout);
                loadTimeout = setTimeout(() => {
                    cleanup();
                    reject(new Error('Video loading timed out after progress'));
                }, 10000);
            };

            const handleError = () => {
                cleanup();
                reject(new Error(getMediaErrorMessage(videoElement.error)));
            };

            videoElement.addEventListener('loadeddata', handleLoadedData);
            videoElement.addEventListener('progress', handleProgress);
            videoElement.addEventListener('error', handleError);

            loadTimeout = setTimeout(() => {
                if (!loadingStarted) {
                    cleanup();
                    reject(new Error('Video loading timed out before any progress'));
                }
            }, 5000);

            videoElement.src = dataUrl;
        });
    }

    async function testVideoPlayback(blob) {
        if (!(blob instanceof Blob)) {
            console.warn('Invalid blob in testVideoPlayback:', blob);
            return false;
        }

        const testVideo = document.createElement('video');
        testVideo.style.display = 'none';
        document.body.appendChild(testVideo);

        try {
            const dataUrl = await blobToBase64(blob);
            await loadVideo(testVideo, dataUrl);
            return true;
        } catch (error) {
            console.warn('Video test failed:', error.message);
            return false;
        } finally {
            testVideo.remove();
        }
    }

    try {
        // Get recorded data
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'getRecordedBlob' }, resolve);
        });

        console.log('Got response:', response);

        if (!response?.success) {
            throw new Error(response?.error || 'Failed to get recording data');
        }

        if (!response.chunks || !Array.isArray(response.chunks) || response.chunks.length === 0) {
            throw new Error('No video data received');
        }

        console.log('📥 Received data:', {
            chunks: response.chunks.length,
            type: response.type,
            firstChunkSize: response.chunks[0]?.length
        });

        // Convert arrays to Uint8Arrays
        const chunks = response.chunks.map(chunk => {
            if (!Array.isArray(chunk)) {
                console.error('Invalid chunk type:', typeof chunk);
                throw new Error('Invalid chunk type');
            }
            return new Uint8Array(chunk);
        });

        if (chunks.some(chunk => chunk.length === 0)) {
            throw new Error('Empty chunk detected');
        }

        // Create blob with original type
        const videoBlob = new Blob(chunks, { 
            type: response.type || 'video/webm' 
        });

        console.log('📦 Created video blob:', {
            size: videoBlob.size,
            type: videoBlob.type
        });

        if (videoBlob.size === 0) {
            throw new Error('Empty video data');
        }

        // Test playback with original format
        console.log('🎥 Testing original format:', videoBlob.type);
        const originalWorks = await testVideoPlayback(videoBlob);

        if (!originalWorks) {
            console.log('⚠️ Original format failed, trying alternatives...');
            const formats = [
                'video/webm;codecs=vp8,opus',
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=h264,opus',
                'video/webm',
                'video/mp4;codecs=h264',
                'video/mp4'
            ];

            let worked = false;
            for (const format of formats) {
                console.log('🔄 Trying format:', format);
                const altBlob = new Blob(chunks, { type: format });
                if (await testVideoPlayback(altBlob)) {
                    console.log('✅ Format works:', format);
                    recordingBlob = altBlob;
                    worked = true;
                    break;
                }
            }

            if (!worked) {
                throw new Error('No supported video format found');
            }
        } else {
            recordingBlob = videoBlob;
        }

        // Convert final blob to data URL for video element
        const videoDataUrl = await blobToBase64(recordingBlob);
        console.log('🎥 Created data URL, length:', videoDataUrl.length);

        // Load and display video
        await loadVideo(video, videoDataUrl);
        video.controls = true;
        console.log('✅ Video loaded successfully');

        // Show download button
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.style.display = 'inline-block';
            downloadBtn.onclick = () => {
                const url = URL.createObjectURL(recordingBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'recording.webm';
                a.click();
                URL.revokeObjectURL(url);
            };
        }

        // Set up Google Drive upload
        if (saveGoogleDriveBtn) {
            saveGoogleDriveBtn.addEventListener('click', async () => {
                try {
                    saveGoogleDriveBtn.disabled = true;
                    const spinner = saveGoogleDriveBtn.querySelector('.loading-spinner');
                    if (spinner) spinner.style.display = 'inline-block';
                    
                    await driveUploader.authenticate();
                    const result = await driveUploader.uploadToDrive(recordingBlob);
                    
                    if (result?.webViewLink) {
                        shareButton.onclick = () => window.open(result.webViewLink, '_blank');
                        shareButton.style.display = 'flex';
                    }
                    
                    alert('Successfully uploaded to Google Drive!');
                } catch (error) {
                    showError('Upload failed: ' + error.message);
                } finally {
                    saveGoogleDriveBtn.disabled = false;
                    const spinner = saveGoogleDriveBtn.querySelector('.loading-spinner');
                    if (spinner) spinner.style.display = 'none';
                }
            });
        }

    } catch (error) {
        console.error('Failed to load video:', error);
        showError(error.message || 'Failed to load video');
    }

    // Cleanup on page unload
    window.addEventListener('unload', () => {});
});
