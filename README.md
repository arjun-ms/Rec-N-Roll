# Screen Recorder Pro Chrome Extension

A powerful Chrome extension for screen recording with YouTube integration for easy sharing.

## Features

- Screen recording with multiple source options (entire screen, window, or tab)
- System audio and microphone recording support
- Direct upload to YouTube as unlisted videos
- Recording history with easy access to past recordings
- Clean and intuitive user interface
- Progress indicators for recording and upload status

## Setup Instructions

### 1. Local Development Environment

1. Clone this repository:
```bash
git clone [repository-url]
cd screen-record-extension-js
```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the extension directory

### 2. YouTube API Configuration

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the YouTube Data API v3
3. Create OAuth 2.0 credentials:
   - Go to Credentials
   - Create OAuth 2.0 Client ID
   - Select "Chrome Extension" as application type
   - Add your extension ID to the authorized origins
4. Update the `manifest.json` file:
   - Replace `${YOUR_CLIENT_ID}` with your actual OAuth client ID

### 3. Testing

1. Manual Testing:
   - Test different recording sources (screen, window, tab)
   - Verify audio recording (system and microphone)
   - Test upload functionality with different video lengths
   - Check error handling by simulating various error conditions

2. Performance Testing:
   - Record long duration videos (30+ minutes)
   - Test with high resolution displays
   - Verify memory usage during long recordings
   - Test concurrent uploads

### 4. Deployment

1. Create a production build:
   - Ensure all API keys and credentials are properly configured
   - Remove any debug logging
   - Update version number in `manifest.json`

2. Package the extension:
   - Zip all the extension files
   - Make sure to exclude any development-only files

3. Submit to Chrome Web Store:
   - Create a developer account if needed
   - Submit the extension package
   - Provide necessary screenshots and descriptions
   - Wait for review and approval

## Security Considerations

- API keys and credentials are handled securely
- User data is processed locally when possible
- YouTube uploads are done securely using OAuth 2.0
- All communications use HTTPS
- Content Security Policy is properly configured

## Development Notes

- The extension uses the MediaRecorder API for capturing screen content
- Video processing is done client-side to maintain privacy
- YouTube API integration handles video uploads and sharing
- Error handling is implemented throughout the extension

## Troubleshooting

Common issues and solutions:

1. Recording fails to start:
   - Check if screen capture permissions are granted
   - Verify that the selected audio source is available

2. Upload fails:
   - Check internet connection
   - Verify YouTube API credentials
   - Ensure you're properly signed in

3. Audio issues:
   - Check system audio settings
   - Verify microphone permissions
   - Ensure correct audio source is selected

## License

[Add your license information here]
