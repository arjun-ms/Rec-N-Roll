let recordedBlob = null;

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: 'recorder.html' });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received:', request.action, request);

    if (request.action === 'STORE_RECORDED_BLOB') {
        try {
            // Convert array back to Uint8Array
            const uint8Array = new Uint8Array(request.chunks[0]);
            
            // Create blob from Uint8Array
            recordedBlob = {
                data: Array.from(uint8Array),  // Store as regular array for serialization
                type: request.type,
                size: uint8Array.length
            };
            
            console.log('Blob stored:', {
                size: recordedBlob.size,
                type: recordedBlob.type
            });
            
            sendResponse({ success: true });
        } catch (error) {
            console.error('Failed to store blob:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    if (request.action === 'getRecordedBlob') {
        console.log('Sending recorded blob:', recordedBlob ? {
            size: recordedBlob.size,
            type: recordedBlob.type
        } : 'No blob available');
        
        sendResponse(recordedBlob);
        return true;
    }
});