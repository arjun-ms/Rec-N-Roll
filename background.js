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
            
        case 'STORE_RECORDED_BLOB':
            try {
                if (!request.chunks || !request.type) {
                    throw new Error('Invalid recording data');
                }
                recordedBlob = {
                    buffer: request.chunks[0],
                    type: request.type
                };
                sendResponse({ success: true });
            } catch (error) {
                console.error('Error storing blob:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true;

        case 'getRecordedBlob':
            if (recordedBlob) {
                sendResponse({ 
                    success: true, 
                    buffer: recordedBlob.buffer,
                    type: recordedBlob.type
                });
            } else {
                sendResponse({ 
                    success: false, 
                    error: 'No recording available' 
                });
            }
            return true;

        case 'START_RECORDING':
            // Clear any existing recording when starting new one
            recordedBlob = null;
            recordingTabId = null;
            console.log('Cleared existing recording before start');
            
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs[0];
                if (activeTab) {
                    chrome.tabs.sendMessage(activeTab.id, {
                        action: 'START_RECORDING',
                        options: request.options
                    }, sendResponse);
                } else {
                    sendResponse({ success: false, error: 'No active tab found' });
                }
            });
            return true;

        case 'STOP_RECORDING':
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs[0];
                if (activeTab) {
                    chrome.tabs.sendMessage(activeTab.id, {
                        action: 'STOP_RECORDING'
                    }, sendResponse);
                } else {
                    sendResponse({ success: false, error: 'No active tab found' });
                }
            });
            return true;

        case 'GET_RECORDING_STATUS':
            chrome.tabs.sendMessage(sender.tab.id, {
                action: 'GET_RECORDING_STATUS'
            }, sendResponse);
            return true;
            
        default:
            console.log('Unknown message action:', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
    return true;
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
