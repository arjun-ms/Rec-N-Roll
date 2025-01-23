document.addEventListener('DOMContentLoaded', async () => {
    const video = document.getElementById('preview');
    const saveGoogleDriveBtn = document.getElementById('saveGoogleDrive');
    const shareButton = document.getElementById('shareButton');
    let recordingBlob = null;
    let videoUrl = null;

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

    function cleanupVideoUrl() {
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl);
            videoUrl = null;
        }
    }

    try {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'getRecordedBlob' }, resolve);
        });

        if (!response?.success || !response?.buffer) {
            throw new Error('Failed to get recording data');
        }

        console.log('Received buffer type:', typeof response.buffer);
        console.log('Received buffer size:', response.buffer.byteLength);
        console.log('Received MIME type:', response.type);

        // Create blob from array buffer
        recordingBlob = new Blob([new Uint8Array(response.buffer)], { 
            type: response.type || 'video/webm'
        });

        console.log('Created blob size:', recordingBlob.size);
        
        if (recordingBlob.size === 0) {
            throw new Error('Recording is empty');
        }

        // Create video URL
        videoUrl = URL.createObjectURL(recordingBlob);
        console.log('Created video URL:', videoUrl);

        // Set up video
        video.src = videoUrl;
        video.controls = true;

        // Wait for video to be loaded
        await new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                console.log('Video metadata loaded. Duration:', video.duration);
                resolve();
            };
            video.onerror = () => reject(new Error(getMediaErrorMessage(video.error)));
        });

        // Set up download button
        document.getElementById('downloadWebm').addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = videoUrl;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `screen-recording-${timestamp}.webm`;
            a.click();
        });

        // Set up mp4 download button
        document.getElementById('downloadMp4').addEventListener('click', async () => {
            showError('MP4 conversion is not supported in this version');
        });

        // Set up gif download button
        document.getElementById('downloadGif').addEventListener('click', async () => {
            showError('GIF conversion is not supported in this version');
        });

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
        showError(error.message);
    }

    // Cleanup on page unload
    window.addEventListener('unload', cleanupVideoUrl);
});
