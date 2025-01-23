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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request.action);
    
    switch (request.action) {
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
        console.log('Getting auth token, interactive:', interactive);
        chrome.identity.getAuthToken({ interactive }, (token) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
                console.error('Auth error:', lastError);
                reject(lastError);
                return;
            }

            if (!token) {
                console.error('No token received');
                reject(new Error('Failed to get auth token'));
                return;
            }

            console.log('Successfully obtained auth token');
            resolve(token);
        });
    });
}
