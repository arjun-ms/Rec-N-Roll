// recorder-ui.js file is responsible for handling the UI interactions and initiating the recording.
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const timer = document.getElementById('timer');
const status = document.getElementById('status');
let timerInterval;

function updateTimer(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    timer.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function startTimer() {
    let seconds = 0;
    timer.style.display = 'block';
    updateTimer(seconds);
    
    timerInterval = setInterval(() => {
        seconds++;
        updateTimer(seconds);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timer.style.display = 'none';
}

startBtn.addEventListener('click', async () => {
    const options = {
        showCursor: document.getElementById('showCursor').checked,
        recordMicrophone: document.getElementById('recordMicrophone').checked
    };

    try {
        startBtn.disabled = true;
        status.textContent = 'Initializing recording...';

        // Send message directly to recorder.js
        startRecording(options)
            .then(() => {
                startBtn.style.display = 'none';
                stopBtn.style.display = 'inline-block';
                status.textContent = 'Recording in progress...';
                startTimer();
            })
            .catch(error => {
                console.error('Failed to start recording:', error);
                status.textContent = 'Failed to start recording';
                startBtn.disabled = false;
            });
    } catch (error) {
        console.error('Error in click handler:', error);
        status.textContent = 'Failed to start recording';
        startBtn.disabled = false;
    }
});

stopBtn.addEventListener('click', () => {
    try {
        stopBtn.disabled = true;
        status.textContent = 'Stopping recording...';

        stopRecording();
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        status.textContent = 'Recording saved';
        stopTimer();
    } catch (error) {
        console.error('Error stopping recording:', error);
        status.textContent = 'Failed to stop recording';
    } finally {
        stopBtn.disabled = false;
    }
});
