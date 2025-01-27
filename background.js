// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Open recorder.html in a new tab
        const recorderURL = chrome.runtime.getURL('recorder.html');
        await chrome.tabs.create({ url: recorderURL });
    } catch (error) {
        console.error('Error opening recorder:', error);
    }
});

// Initialize storage
let recordedBlob = null;
let recordingTabId = null;

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request.action);
    
    switch (request.action) {
        case 'getAuthToken':
            getAuthToken(true).then((token) => {
                sendResponse({ token });
            }).catch((error) => {
                console.error('Auth error:', error);
                sendResponse({ error: error.message });
            });
            return true; // Required for async response

        case 'removeCachedToken':
            if (request.token) {
                chrome.identity.removeCachedAuthToken({ token: request.token }, () => {
                    sendResponse({ success: true });
                });
                return true; // Required for async response
            }
            break;

        case 'GET_TAB_ID':
            sendResponse({ tabId: sender.tab.id });
            break;
            
        case 'START_RECORDING':
            try {
                // Store the tab ID that initiated recording
                recordingTabId = sender.tab.id;
                console.log('Starting recording from tab:', recordingTabId);
                
                // Forward the start recording message to the recorder tab
                chrome.tabs.sendMessage(recordingTabId, {
                    action: 'START_RECORDING',
                    options: request.options
                }, response => {
                    console.log('Recorder response:', response);
                    sendResponse(response);
                });
            } catch (error) {
                console.error('Error starting recording:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true;
            
        case 'STORE_RECORDED_BLOB':
            try {
                if (!request.chunks || !request.type) {
                    throw new Error('Invalid recording data');
                }

                console.log('Storing recording:', {
                    chunksLength: request.chunks.length,
                    type: request.type,
                    firstChunkLength: request.chunks[0]?.length
                });

                // Store the chunks as Uint8Arrays
                recordedBlob = {
                    chunks: request.chunks.map(chunk => {
                        // Verify chunk is array of numbers
                        if (!Array.isArray(chunk)) {
                            console.error('Invalid chunk type:', typeof chunk);
                            throw new Error('Invalid chunk type');
                        }
                        // Convert number array back to Uint8Array
                        return new Uint8Array(chunk);
                    }),
                    type: request.type
                };

                console.log('Recording stored successfully:', {
                    chunks: recordedBlob.chunks.length,
                    totalSize: recordedBlob.chunks.reduce((sum, chunk) => sum + chunk.length, 0),
                    type: recordedBlob.type
                });

                sendResponse({ success: true });
            } catch (error) {
                console.error('Error storing blob:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true;

        case 'getRecordedBlob':
            try {
                if (!recordedBlob || !recordedBlob.chunks || recordedBlob.chunks.length === 0) {
                    throw new Error('No recording available');
                }

                console.log('Retrieving recording:', {
                    chunks: recordedBlob.chunks.length,
                    totalSize: recordedBlob.chunks.reduce((sum, chunk) => sum + chunk.length, 0),
                    type: recordedBlob.type
                });

                // Convert Uint8Arrays to regular arrays for transfer
                const chunks = recordedBlob.chunks.map(chunk => Array.from(chunk));

                sendResponse({ 
                    success: true, 
                    chunks: chunks,
                    type: recordedBlob.type
                });
            } catch (error) {
                console.error('Error retrieving blob:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true;

        case 'STOP_RECORDING':
            try {
                if (!recordingTabId) {
                    throw new Error('No active recording tab');
                }
                
                // Forward stop recording message to the recorder tab
                chrome.tabs.sendMessage(recordingTabId, {
                    action: 'STOP_RECORDING'
                }, response => {
                    console.log('Stop recording response:', response);
                    sendResponse(response);
                });
                
                recordingTabId = null;
            } catch (error) {
                console.error('Error stopping recording:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true;

        case 'CLEAR_RECORDING':
            recordedBlob = null;
            recordingTabId = null;
            console.log('Cleared recording data');
            sendResponse({ success: true });
            return true;

        case 'UPLOAD_TO_DRIVE':
            try {
                if (!request.filename || !recordedBlob) {
                    throw new Error('Invalid upload data');
                }

                const blob = new Blob(recordedBlob.chunks, { type: recordedBlob.type });
                uploadToDrive(blob, request.filename).then((result) => {
                    sendResponse({ success: true, result });
                }).catch((error) => {
                    console.error('Upload error:', error);
                    sendResponse({ success: false, error: error.message });
                });
            } catch (error) {
                console.error('Error preparing upload:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true;

        default:
            console.warn('Unknown action:', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
            return true;
    }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed - testing auth...');
    testAuth();
});

async function testAuth() {
    try {
        const token = await getAuthToken(false);
        console.log('Initial auth test successful');
    } catch (error) {
        console.error('Initial auth test failed:', error);
    }
}

function isBraveBrowser() {
    return navigator.brave?.isBrave() || false;
}

async function getAuthToken(interactive = true) {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: interactive }, function (token) {
            if (chrome.runtime.lastError) {
                console.error('Auth error:', chrome.runtime.lastError);
                // If token was revoked, remove it and retry
                if (chrome.runtime.lastError.message.includes('revoked')) {
                    chrome.identity.removeCachedAuthToken({ token: token }, () => {
                        getAuthToken(interactive).then(resolve).catch(reject);
                    });
                    return;
                }
                reject(chrome.runtime.lastError);
                return;
            }
            if (token) {
                console.log('Successfully obtained auth token');
                resolve(token);
            } else {
                console.error('No token received');
                reject(new Error('Failed to get auth token'));
            }
        });
    });
}

async function uploadToDrive(blob, filename) {
    try {
        const token = await getAuthToken(true);
        
        // Create multipart form data
        const metadata = {
            name: filename,
            mimeType: blob.type
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        // Upload to Drive
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: form
        });

        if (!response.ok) {
            throw new Error('Upload failed: ' + response.statusText);
        }

        const result = await response.json();
        console.log('File uploaded successfully:', result);
        return result;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}
