class DriveUploader {
    constructor() {
        this.tokenDetails = null;
        this.isUploading = false;
    }

    async authenticate() {
        try {
            console.log('Starting authentication...');
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ 
                    action: 'getAuthToken'
                }, async (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Message error:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    if (response.error) {
                        console.error('Auth error:', response.error);
                        // If token was revoked, try to clear it and authenticate again
                        if (response.error.includes('revoked') || response.error.includes('not granted')) {
                            await this.clearToken();
                            try {
                                const newToken = await this.authenticate();
                                resolve(newToken);
                                return;
                            } catch (retryError) {
                                reject(retryError);
                                return;
                            }
                        }
                        reject(new Error(response.error));
                        return;
                    }

                    if (!response.token) {
                        console.error('No token received');
                        reject(new Error('Failed to get auth token'));
                        return;
                    }

                    console.log('Successfully received auth token');
                    this.tokenDetails = { token: response.token };
                    resolve(response.token);
                });
            });
        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    }

    async uploadToDrive(blob, filename = `screen-recording-${Date.now()}.webm`) {
        if (this.isUploading) {
            throw new Error('Upload already in progress');
        }

        this.isUploading = true;
        const uploadButton = document.querySelector('#saveGoogleDriveBtn');
        const originalText = uploadButton?.textContent || '';

        try {
            if (!blob) {
                throw new Error('No recording data available');
            }

            this.updateUploadStatus(uploadButton, 'Authenticating...');
            const token = await this.authenticate();
            
            this.updateUploadStatus(uploadButton, 'Preparing upload...');
            const metadata = {
                name: filename,
                mimeType: blob.type,
                parents: ['root']
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            this.updateUploadStatus(uploadButton, 'Uploading to Drive...');
            const initResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: form
            });

            if (!initResponse.ok) {
                const errorData = await initResponse.json().catch(() => null);
                console.error('Upload failed:', errorData);
                throw new Error(errorData?.error?.message || 'Upload failed');
            }

            const result = await initResponse.json();
            this.updateUploadStatus(uploadButton, 'Setting permissions...');
            
            // Make the file accessible via link
            await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                })
            });

            this.updateUploadStatus(uploadButton, 'Getting share link...');
            const shareResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}?fields=webViewLink,webContentLink`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!shareResponse.ok) {
                throw new Error('Failed to get sharing link');
            }

            const shareResult = await shareResponse.json();
            this.updateUploadStatus(uploadButton, 'Upload complete! ', 2000);
            
            return {
                ...result,
                webViewLink: shareResult.webViewLink,
                downloadLink: shareResult.webContentLink
            };
        } catch (error) {
            console.error('Error uploading to Drive:', error);
            this.updateUploadStatus(uploadButton, `Error: ${error.message}`, 3000);
            
            if (error.message.includes('token') || error.message.includes('auth')) {
                await this.clearToken();
            }
            throw error;
        } finally {
            this.isUploading = false;
            // Reset button text after delay if it hasn't been changed by success message
            setTimeout(() => {
                if (uploadButton && uploadButton.textContent.includes('Error') || uploadButton.textContent.includes('...')) {
                    uploadButton.textContent = originalText;
                }
            }, 3000);
        }
    }

    updateUploadStatus(button, status, resetDelay = 0) {
        if (button) {
            button.textContent = status;
            if (resetDelay > 0) {
                setTimeout(() => {
                    button.textContent = 'Save to Google Drive';
                }, resetDelay);
            }
        }
    }

    async clearToken() {
        if (!this.tokenDetails?.token) return;
        
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { 
                    action: 'removeCachedToken', 
                    token: this.tokenDetails.token 
                },
                () => {
                    this.tokenDetails = null;
                    resolve();
                }
            );
        });
    }
}

// Create uploader instance and make it globally available
window.driveUploader = new DriveUploader();
