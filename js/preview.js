document.addEventListener('DOMContentLoaded', async () => {
    const video = document.getElementById('preview');
    const saveGoogleDriveBtn = document.getElementById('saveGoogleDrive');
    const saveSupabaseBtn = document.getElementById('saveSupabase');
    const shareButton = document.getElementById('shareButton');
    let recordingBlob = null;
    let driveUploader = null;  

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

    async function convertToMp4(sourceBlob) {
        return new Promise((resolve, reject) => {
            const videoEl = document.createElement('video');
            videoEl.style.display = 'none';
            document.body.appendChild(videoEl);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const chunks = [];

            videoEl.onloadedmetadata = () => {
                canvas.width = videoEl.videoWidth;
                canvas.height = videoEl.videoHeight;

                const stream = canvas.captureStream(30); // 30 FPS

                // Add audio track if present in the video element
                const audioTracks = videoEl.captureStream().getAudioTracks();
                if (audioTracks.length > 0) {
                    audioTracks.forEach(track => stream.addTrack(track));
                }

                const options = {
                    mimeType: 'video/webm;codecs=h264',
                    videoBitsPerSecond: 2500000,
                    audioBitsPerSecond: 128000
                };

                let mediaRecorder;
                try {
                    mediaRecorder = new MediaRecorder(stream, options);
                } catch (e) {
                    cleanup();
                    reject(new Error('MP4 conversion not supported in this browser'));
                    return;
                }

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                mediaRecorder.onstop = () => {
                    const finalBlob = new Blob(chunks, { type: 'video/mp4' });
                    cleanup();
                    resolve(finalBlob);
                };

                // Start recording and playing
                mediaRecorder.start(1000);
                videoEl.play();

                function drawFrame() {
                    if (videoEl.ended || videoEl.paused) {
                        mediaRecorder.stop();
                        return;
                    }
                    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                    requestAnimationFrame(drawFrame);
                }

                drawFrame();
            };

            function cleanup() {
                videoEl.remove();
                canvas.remove();
            }

            videoEl.src = URL.createObjectURL(sourceBlob);
        });
    }

    async function extractFrames(videoBlob, fps = 10) {
        console.log('Extracting frames from video');
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        return new Promise(async (resolve, reject) => {
            try {
                // Create object URL for video blob
                const videoUrl = URL.createObjectURL(videoBlob);
                
                video.addEventListener('loadedmetadata', () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    video.currentTime = 0;
                });

                video.addEventListener('error', (e) => {
                    reject(new Error('Error loading video: ' + e.message));
                });

                const frames = [];
                const interval = 1000 / fps;

                video.addEventListener('seeked', async function handler() {
                    if (video.currentTime < video.duration) {
                        ctx.drawImage(video, 0, 0);
                        frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
                        video.currentTime += interval / 1000;
                    } else {
                        video.removeEventListener('seeked', handler);
                        URL.revokeObjectURL(videoUrl);
                        console.log(`Extracted ${frames.length} frames`);
                        resolve({ frames, width: canvas.width, height: canvas.height });
                    }
                });

                video.src = videoUrl;
            } catch (error) {
                reject(error);
            }
        });
    }

    async function createGif(frames, width, height, fps = 10) {
        console.log('Creating GIF');
        return new Promise((resolve, reject) => {
            const gif = new GIF({
                workers: 2,
                quality: 10,
                width: width,
                height: height,
                workerScript: chrome.runtime.getURL('lib/gif.worker.js')
            });

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

            frames.forEach(frame => {
                tempCtx.putImageData(frame, 0, 0);
                gif.addFrame(tempCanvas, { delay: 1000 / fps });
            });

            gif.on('progress', p => console.log('GIF Progress:', Math.round(p * 100) + '%'));
            
            gif.on('finished', blob => {
                console.log('GIF creation finished');
                resolve(blob);
            });

            gif.on('error', error => {
                console.error('GIF creation error:', error);
                reject(error);
            });

            gif.render();
        });
    }

    // Load FFmpeg
    let ffmpeg = null;
    async function loadFFmpeg() {
        if (ffmpeg) return ffmpeg;
        
        try {
            // Check if FFmpeg is available
            if (typeof FFmpeg === 'undefined') {
                throw new Error('FFmpeg library not loaded. Please check your internet connection and try again.');
            }

            const { createFFmpeg } = FFmpeg;
            console.log('Creating FFmpeg instance...');
            
            ffmpeg = createFFmpeg({
                log: true,
                logger: ({ message }) => console.log('FFmpeg Log:', message),
                corePath: chrome.runtime.getURL('ffmpeg/ffmpeg-core.js'),
                wasmPath: chrome.runtime.getURL('ffmpeg/ffmpeg-core.wasm'),
                workerPath: chrome.runtime.getURL('ffmpeg/ffmpeg-core.worker.js'),
                progress: (progress) => {
                    console.log('FFmpeg Progress:', progress);
                }
            });
            
            console.log('Loading FFmpeg...');
            await ffmpeg.load();
            console.log('FFmpeg loaded successfully');
            
            return ffmpeg;
        } catch (error) {
            console.error('Failed to load FFmpeg:', error);
            throw new Error('Failed to initialize video converter: ' + error.message);
        }
    }

    async function convertToGif(recordingBlob, progressCallback) {
        try {
            console.log('Starting GIF conversion process');
            progressCallback('Loading FFmpeg...');
            
            // Load FFmpeg
            const ffmpeg = await loadFFmpeg();
            progressCallback('Converting video...');
            
            // Convert blob to array buffer
            const videoData = await recordingBlob.arrayBuffer();
            
            // Write the input file
            ffmpeg.FS('writeFile', 'input.webm', new Uint8Array(videoData));
            progressCallback('Creating GIF...');
            
            // Run FFmpeg command with simpler settings
            await ffmpeg.run(
                '-i', 'input.webm',
                '-vf', 'fps=10,scale=480:-1',
                '-f', 'gif',
                'output.gif'
            );
            
            progressCallback('Finalizing...');
            
            // Read the output file
            const gifData = ffmpeg.FS('readFile', 'output.gif');
            
            // Clean up
            ffmpeg.FS('unlink', 'input.webm');
            ffmpeg.FS('unlink', 'output.gif');
            
            // Create blob
            const gifBlob = new Blob([gifData.buffer], { type: 'image/gif' });
            console.log('GIF conversion successful');
            
            return gifBlob;
        } catch (error) {
            console.error('Error in GIF conversion:', error);
            throw error;
        }
    }

    async function setupDownloadButtons() {
        try {
            const downloadMp4 = document.getElementById('downloadMp4');
            const downloadWebm = document.getElementById('downloadWebm');
            const downloadGif = document.getElementById('downloadGif');
            const preview = document.getElementById('preview');
            const timestamp = new Date().getTime();

            if (downloadMp4) {
                downloadMp4.onclick = async () => {
                    const description = downloadMp4.querySelector('.description');
                    const originalDescription = description.textContent;
                    downloadMp4.style.opacity = '0.5';
                    description.textContent = 'Converting to MP4...';
                    
                    try {
                        const mp4Blob = await convertToMp4(recordingBlob);
                        await downloadBlob(mp4Blob, `recording-${timestamp}.mp4`);
                    } catch (error) {
                        console.error('MP4 conversion failed:', error);
                        showError('Failed to convert to MP4: ' + error.message);
                    } finally {
                        downloadMp4.style.opacity = '1';
                        description.textContent = originalDescription;
                    }
                };
            }

            if (downloadWebm) {
                downloadWebm.onclick = async () => {
                    const description = downloadWebm.querySelector('.description');
                    const originalDescription = description.textContent;
                    downloadWebm.style.opacity = '0.5';
                    description.textContent = 'Downloading...';
                    
                    try {
                        await downloadBlob(recordingBlob, `recording-${timestamp}.webm`);
                    } catch (error) {
                        showError('Failed to download WebM: ' + error.message);
                    } finally {
                        downloadWebm.style.opacity = '1';
                        description.textContent = originalDescription;
                    }
                };
            }

            if (downloadGif) {
                // ! START HERE Commented out as GIF download is not working properly
                // downloadGif.onclick = async () => {
                //     const description = downloadGif.querySelector('.description');
                //     const originalDescription = description.textContent;
                    
                //     try {
                //         // Update UI to show progress
                //         downloadGif.style.opacity = '0.5';
                //         description.textContent = 'Initializing converter...';
                        
                //         // Convert and download
                //         const gifBlob = await convertToGif(recordingBlob, (status) => {
                //             description.textContent = status;
                //         });
                        
                //         if (!gifBlob) {
                //             throw new Error('GIF conversion failed - no blob received');
                //         }
                        
                //         description.textContent = 'Downloading GIF...';
                //         await downloadBlob(gifBlob, `recording-${timestamp}.gif`);
                //     } catch (error) {
                //         console.error('GIF conversion/download failed:', error);
                //         showError('Failed to convert/download GIF: ' + error.message);
                //     } finally {
                //         // Restore UI
                //         downloadGif.style.opacity = '1';
                //         description.textContent = originalDescription;
                //     }
                // };
                // ! UNTIL THIS Commented out as GIF download is not working properly (uncomment then try to fix the solution when needed)
                downloadGif.onclick = () => {
                    alert('GIF Downloading Coming Soon...');
                };
            }

            if (preview && recordingBlob) {
                preview.src = URL.createObjectURL(recordingBlob);
            }
        } catch (error) {
            console.error('Error setting up download buttons:', error);
            showError('Failed to setup download options: ' + error.message);
        }
    }

    function downloadBlob(blob, filename) {
        return new Promise((resolve, reject) => {
            try {
                console.log('Starting download:', { 
                    filename, 
                    blobSize: blob.size, 
                    type: blob.type 
                });

                // Ensure we have a valid blob
                if (!(blob instanceof Blob)) {
                    throw new Error('Invalid blob object');
                }

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);

                // Use timeout to ensure browser has time to process
                setTimeout(() => {
                    console.log('Triggering download...');
                    a.click();
                    
                    // Cleanup after small delay
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        console.log('Download cleanup complete');
                        resolve();
                    }, 1000);
                }, 100);
            } catch (error) {
                console.error('Download failed:', error);
                reject(error);
            }
        });
    }

    try {
        // Get recorded data
        const blobData = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'getRecordedBlob' }, (response) => {
                console.log('Got response:', response);
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (!response || !response.data) {
                    reject(new Error('No recording data received'));
                    return;
                }
                resolve(response);
            });
        });

        if (!blobData || !blobData.data) {
            throw new Error('Failed to get recording data');
        }

        console.log('Received blob data:', {
            size: blobData.size,
            type: blobData.type
        });

        // Reconstruct the blob from the array data
        const uint8Array = new Uint8Array(blobData.data);
        recordingBlob = new Blob([uint8Array], { type: blobData.type });

        console.log('Created blob:', {
            size: recordingBlob.size,
            type: recordingBlob.type
        });

        // Create object URL for video playback
        const videoURL = URL.createObjectURL(recordingBlob);
        console.log('Created video URL:', videoURL);
        
        video.src = videoURL;
        video.controls = true;

        // Set up video event handlers
        video.onloadeddata = () => {
            console.log('Video loaded successfully');
        };

        video.onerror = (e) => {
            console.error('Video error:', e);
            URL.revokeObjectURL(videoURL);
            showError('Failed to load video: ' + (video.error ? video.error.message : 'Unknown error'));
        };

        // Test playback with original format
        console.log('Testing original format:', recordingBlob.type);
        const originalWorks = await testVideoPlayback(recordingBlob);

        if (!originalWorks) {
            console.log('Original format failed, trying alternatives...');
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
                console.log('Trying format:', format);
                const altBlob = new Blob([recordingBlob], { type: format });
                if (await testVideoPlayback(altBlob)) {
                    console.log('Format works:', format);
                    recordingBlob = altBlob;
                    worked = true;
                    break;
                }
            }

            if (!worked) {
                throw new Error('No supported video format found');
            }
        }

        // Set up download buttons
        await setupDownloadButtons();

        // Set up feedback button
        const feedbackBtn = document.getElementById('giveFeedback');
        if (feedbackBtn) {
            feedbackBtn.addEventListener('click', () => {
                // Placeholder Google Form link - replace with actual form link
                const feedbackFormUrl = 'https://forms.gle/vjAurBpfHmfz3kau9';
                window.open(feedbackFormUrl, '_blank');
            });
        }

        // Show download button
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.style.display = 'inline-block';
            downloadBtn.onclick = async () => {
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
                alert('Please use Save to Supabase option as of now... Google Drive Upload Coming Soon...');
                return;
                // try {
                //     if (!window.driveUploader) {
                //         throw new Error('DriveUploader not initialized. Please refresh the page and try again.');
                //     }

                //     saveGoogleDriveBtn.disabled = true;
                //     const spinner = saveGoogleDriveBtn.querySelector('.loading-spinner');
                //     if (spinner) spinner.style.display = 'inline-block';
                    
                //     console.log('Starting Google Drive upload process...');
                //     await window.driveUploader.authenticate();
                //     console.log('Authentication successful, uploading file...');
                //     const result = await window.driveUploader.uploadToDrive(recordingBlob);
                    
                //     if (result?.webViewLink) {
                //         shareButton.onclick = () => window.open(result.webViewLink, '_blank');
                //         shareButton.style.display = 'flex';
                //     }
                    
                //     alert('Successfully uploaded to Google Drive!');
                // } catch (error) {
                //     console.error('Drive upload error:', error);
                //     showError('Upload failed: ' + (error.message || 'Unknown error occurred'));
                // } finally {
                //     saveGoogleDriveBtn.disabled = false;
                //     const spinner = saveGoogleDriveBtn.querySelector('.loading-spinner');
                //     if (spinner) spinner.style.display = 'none';
                // }
            });
        }

        // Set up Supabase upload
        if (saveSupabaseBtn) {
            saveSupabaseBtn.addEventListener('click', async () => {
                try {
                    const filename = `screen-recording-${new Date().toISOString()}.webm`;
                    
                    // Debug logging
                    console.log('Debug - recordingBlob:', recordingBlob);
                    console.log('Debug - filename:', filename);
                    console.log('Debug - supabaseUploader available?', window.supabaseUploader);
                    
                    // Show loading state
                    saveSupabaseBtn.style.opacity = '0.7';
                    saveSupabaseBtn.style.pointerEvents = 'none';
                    
                    // Upload to Supabase
                    const result = await window.supabaseUploader.uploadVideo(recordingBlob, filename);
                    
                    // Reset button state
                    saveSupabaseBtn.style.opacity = '1';
                    saveSupabaseBtn.style.pointerEvents = 'auto';
                    
                    if (result.success) {
                        // Show share button and update its link
                        shareButton.style.display = 'flex';
                        shareButton.onclick = () => {
                            navigator.clipboard.writeText(result.url);
                            alert('Link copied to clipboard!');
                        };
                        
                        alert('Successfully uploaded to Supabase!');
                    }
                } catch (error) {
                    console.error('Failed to upload to Supabase:', error);
                    alert('Failed to upload to Supabase. Please try again.');
                    
                    // Reset button state
                    saveSupabaseBtn.style.opacity = '1';
                    saveSupabaseBtn.style.pointerEvents = 'auto';
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
