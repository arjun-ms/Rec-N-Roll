class DriveUploader {
    constructor() {
        this.tokenDetails = null;
    }

    async authenticate() {
        try {
            return new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ 
                    interactive: true,
                    scopes: ['https://www.googleapis.com/auth/drive.file']
                }, (token) => {
                    if (chrome.runtime.lastError) {
                        console.error('Auth error:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    
                    if (!token) {
                        reject(new Error('Failed to get auth token'));
                        return;
                    }

                    this.tokenDetails = { token };
                    resolve(token);
                });
            });
        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    }

    async uploadToDrive(blob, filename = `screen-recording-${Date.now()}.webm`) {
        try {
            const token = await this.authenticate();
            console.log('Authentication successful, proceeding with upload');

            // Create metadata for the file
            const metadata = {
                name: filename,
                mimeType: blob.type,
                parents: ['root']
            };

            // Create multipart form data
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            console.log('Starting file upload to Drive');
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
                throw new Error(errorData?.error?.message || initResponse.statusText);
            }

            const result = await initResponse.json();
            console.log('File uploaded successfully, setting permissions');
            
            // Update file permissions to make it accessible via link
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

            console.log('Getting sharing link');
            // Get the sharable link
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
            console.log('Upload process completed successfully');
            return {
                ...result,
                webViewLink: shareResult.webViewLink,
                downloadLink: shareResult.webContentLink
            };
        } catch (error) {
            console.error('Error uploading to Drive:', error);
            // If we get a token error, clear it and let the user try again
            if (error.message.includes('token') || error.message.includes('auth')) {
                await this.clearToken();
            }
            throw error;
        }
    }

    async clearToken() {
        if (!this.tokenDetails?.token) return;
        
        return new Promise((resolve) => {
            chrome.identity.removeCachedAuthToken(
                { token: this.tokenDetails.token },
                () => {
                    this.tokenDetails = null;
                    resolve();
                }
            );
        });
    }
}

// Create uploader instance
const driveUploader = new DriveUploader();
