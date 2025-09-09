// Enhanced WorldChat Frontend with Media Support

class WorldChatClient {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.isTyping = false;
        this.typingTimer = null;
        this.isConnected = false;
        this.messageHistory = [];

        // Media recording
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.currentRecordedBlob = null;

        // DOM Elements
        this.elements = {
            welcomeScreen: document.getElementById('welcomeScreen'),
            chatInterface: document.getElementById('chatInterface'),
            joinForm: document.getElementById('joinForm'),
            usernameInput: document.getElementById('usernameInput'),
            profilePicInput: document.getElementById('profilePicInput'),
            uploadArea: document.getElementById('uploadArea'),
            profilePreview: document.getElementById('profilePreview'),
            previewImg: document.getElementById('previewImg'),
            removeProfile: document.getElementById('removeProfile'),
            joinBtn: document.getElementById('joinBtn'),
            currentUserAvatar: document.getElementById('currentUserAvatar'),
            currentUsername: document.getElementById('currentUsername'),
            userCount: document.getElementById('userCount'),
            onlineCount: document.getElementById('onlineCount'),
            usersList: document.getElementById('usersList'),
            messagesArea: document.getElementById('messagesArea'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            leaveBtn: document.getElementById('leaveBtn'),
            typingIndicator: document.getElementById('typingIndicator'),
            toastContainer: document.getElementById('toastContainer'),

            // Media controls
            imageBtn: document.getElementById('imageBtn'),
            videoBtn: document.getElementById('videoBtn'),
            voiceBtn: document.getElementById('voiceBtn'),
            imageInput: document.getElementById('imageInput'),
            videoInput: document.getElementById('videoInput'),

            // Voice modal
            voiceModal: document.getElementById('voiceModal'),
            closeVoiceModal: document.getElementById('closeVoiceModal'),
            voiceVisualizer: document.getElementById('voiceVisualizer'),
            recordingTime: document.getElementById('recordingTime'),
            recordingStatus: document.getElementById('recordingStatus'),
            startRecordBtn: document.getElementById('startRecordBtn'),
            stopRecordBtn: document.getElementById('stopRecordBtn'),
            playRecordBtn: document.getElementById('playRecordBtn'),
            sendVoiceBtn: document.getElementById('sendVoiceBtn'),
            voicePlayback: document.getElementById('voicePlayback'),

            // Upload progress
            uploadProgress: document.getElementById('uploadProgress')
        };

        this.initializeEventListeners();
        this.initializeSocketConnection();
        this.checkMediaSupport();
    }

    checkMediaSupport() {
        // Check if browser supports media recording
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('Media recording not supported');
            this.elements.voiceBtn.disabled = true;
            this.elements.voiceBtn.title = 'Voice recording not supported in this browser';
        }
    }

    initializeEventListeners() {
        // Welcome form submission
        this.elements.joinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleJoinChat();
        });

        // Profile picture upload
        this.elements.uploadArea.addEventListener('click', () => {
            this.elements.profilePicInput.click();
        });

        this.elements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.add('drag-over');
        });

        this.elements.uploadArea.addEventListener('dragleave', () => {
            this.elements.uploadArea.classList.remove('drag-over');
        });

        this.elements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });

        this.elements.profilePicInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        this.elements.removeProfile.addEventListener('click', () => {
            this.clearProfilePicture();
        });

        // Message input and sending
        this.elements.messageInput.addEventListener('input', () => {
            this.handleTyping();
            this.updateSendButton();
        });

        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendTextMessage();
            }
        });

        this.elements.sendBtn.addEventListener('click', () => {
            this.sendTextMessage();
        });

        // Media buttons
        this.elements.imageBtn.addEventListener('click', () => {
            this.elements.imageInput.click();
        });

        this.elements.videoBtn.addEventListener('click', () => {
            this.elements.videoInput.click();
        });

        this.elements.voiceBtn.addEventListener('click', () => {
            this.openVoiceModal();
        });

        // Media file inputs
        this.elements.imageInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handleMediaUpload(e.target.files[0], 'image');
            }
        });

        this.elements.videoInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handleMediaUpload(e.target.files[0], 'video');
            }
        });

        // Voice modal controls
        this.elements.closeVoiceModal.addEventListener('click', () => {
            this.closeVoiceModal();
        });

        this.elements.startRecordBtn.addEventListener('click', () => {
            this.startRecording();
        });

        this.elements.stopRecordBtn.addEventListener('click', () => {
            this.stopRecording();
        });

        this.elements.playRecordBtn.addEventListener('click', () => {
            this.playRecording();
        });

        this.elements.sendVoiceBtn.addEventListener('click', () => {
            this.sendVoiceMessage();
        });

        // Leave chat
        this.elements.leaveBtn.addEventListener('click', () => {
            this.leaveChat();
        });

        // Username input validation
        this.elements.usernameInput.addEventListener('input', (e) => {
            this.validateUsername(e.target.value);
        });

        // Close voice modal when clicking outside
        this.elements.voiceModal.addEventListener('click', (e) => {
            if (e.target === this.elements.voiceModal) {
                this.closeVoiceModal();
            }
        });
    }

    initializeSocketConnection() {
        try {
            this.socket = io();

            this.socket.on('connect', () => {
                console.log('Connected to server');
                this.isConnected = true;
                this.updateConnectionStatus(true);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.showToast('Connection lost. Trying to reconnect...', 'error');
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                this.showToast('Failed to connect to server', 'error');
            });

            // Chat events
            this.socket.on('active-users', (users) => {
                this.updateUsersList(users);
            });

            this.socket.on('message-history', (messages) => {
                this.loadMessageHistory(messages);
            });

            this.socket.on('new-message', (message) => {
                this.displayMessage(message);
                this.scrollToBottom();
            });

            this.socket.on('user-joined', (data) => {
                this.displaySystemMessage(data.message, 'user-joined');
                this.showToast(`${data.username} joined the chat!`, 'success');
            });

            this.socket.on('user-left', (data) => {
                this.displaySystemMessage(data.message, 'user-left');
                this.showToast(`${data.username} left the chat`, 'warning');
            });

            this.socket.on('user-typing', (data) => {
                this.handleUserTyping(data);
            });

            this.socket.on('error', (error) => {
                console.error('Socket error:', error);
                this.showToast(error, 'error');
            });

        } catch (error) {
            console.error('Failed to initialize socket connection:', error);
            this.showToast('Failed to initialize connection', 'error');
        }
    }

    async handleFileSelect(file) {
        // Validate file
        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showToast('File size must be less than 5MB', 'error');
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            this.elements.previewImg.src = e.target.result;
            this.elements.profilePreview.classList.remove('hidden');
            this.elements.uploadArea.style.display = 'none';
        };
        reader.readAsDataURL(file);

        // Upload file to server
        try {
            const formData = new FormData();
            formData.append('profilePic', file);

            const response = await fetch('/upload-profile', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.currentProfilePicUrl = result.fileUrl;
                this.showToast('Profile picture uploaded successfully!', 'success');
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('Failed to upload profile picture', 'error');
            this.clearProfilePicture();
        }
    }

    async handleMediaUpload(file, type) {
        // Validate file type and size
        const maxSizes = {
            image: 10 * 1024 * 1024, // 10MB
            video: 50 * 1024 * 1024  // 50MB
        };

        const allowedTypes = {
            image: 'image/',
            video: 'video/'
        };

        if (!file.type.startsWith(allowedTypes[type])) {
            this.showToast(`Please select a valid ${type} file`, 'error');
            return;
        }

        if (file.size > maxSizes[type]) {
            this.showToast(`${type} file size must be less than ${maxSizes[type] / 1024 / 1024}MB`, 'error');
            return;
        }

        // Show upload progress
        this.showUploadProgress(file.name, 'Uploading...');

        try {
            const formData = new FormData();
            formData.append(type, file);

            const response = await fetch(`/upload-${type}`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.hideUploadProgress();
                this.sendMediaMessage(type, result.fileUrl, result.fileName, result.fileSize);
                this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully!`, 'success');
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error(`${type} upload error:`, error);
            this.hideUploadProgress();
            this.showToast(`Failed to upload ${type}`, 'error');
        }
    }

    // Voice Recording Methods
    openVoiceModal() {
        this.elements.voiceModal.classList.remove('hidden');
        this.resetVoiceModal();
    }

    closeVoiceModal() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.stopRecording();
        }
        this.elements.voiceModal.classList.add('hidden');
        this.resetVoiceModal();
    }

    resetVoiceModal() {
        this.elements.recordingTime.textContent = '00:00';
        this.elements.recordingStatus.textContent = 'Click to start recording';
        this.elements.recordingStatus.classList.remove('recording');
        this.elements.startRecordBtn.classList.remove('hidden');
        this.elements.stopRecordBtn.classList.add('hidden');
        this.elements.playRecordBtn.classList.add('hidden');
        this.elements.sendVoiceBtn.classList.add('hidden');
        this.elements.voicePlayback.classList.add('hidden');
        this.elements.voiceVisualizer.querySelector('.voice-bars').classList.remove('recording');
        this.currentRecordedBlob = null;
        this.audioChunks = [];
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.currentRecordedBlob = audioBlob;

                // Create audio URL for playback
                const audioUrl = URL.createObjectURL(audioBlob);
                this.elements.voicePlayback.src = audioUrl;
                this.elements.voicePlayback.classList.remove('hidden');
                this.elements.playRecordBtn.classList.remove('hidden');
                this.elements.sendVoiceBtn.classList.remove('hidden');

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.recordingStartTime = Date.now();

            // Update UI
            this.elements.startRecordBtn.classList.add('hidden');
            this.elements.stopRecordBtn.classList.remove('hidden');
            this.elements.recordingStatus.textContent = 'Recording... Click stop when done';
            this.elements.recordingStatus.classList.add('recording');
            this.elements.voiceVisualizer.querySelector('.voice-bars').classList.add('recording');

            // Start timer
            this.recordingTimer = setInterval(() => {
                if (this.recordingStartTime) {
                    const elapsed = Date.now() - this.recordingStartTime;
                    const minutes = Math.floor(elapsed / 60000);
                    const seconds = Math.floor((elapsed % 60000) / 1000);
                    this.elements.recordingTime.textContent = 
                        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            }, 1000);

        } catch (error) {
            console.error('Error starting recording:', error);
            this.showToast('Unable to access microphone. Please check permissions.', 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        // Clear timer
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        // Update UI
        this.elements.startRecordBtn.classList.remove('hidden');
        this.elements.stopRecordBtn.classList.add('hidden');
        this.elements.recordingStatus.textContent = 'Recording completed. You can play it back or send it.';
        this.elements.recordingStatus.classList.remove('recording');
        this.elements.voiceVisualizer.querySelector('.voice-bars').classList.remove('recording');
    }

    playRecording() {
        if (this.elements.voicePlayback.src) {
            this.elements.voicePlayback.play();
        }
    }

    async sendVoiceMessage() {
        if (!this.currentRecordedBlob) {
            this.showToast('No voice recording found', 'error');
            return;
        }

        try {
            this.showUploadProgress('Voice Message', 'Uploading...');

            const formData = new FormData();
            formData.append('voice', this.currentRecordedBlob, 'voice-message.wav');

            const response = await fetch('/upload-voice', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.hideUploadProgress();
                this.sendMediaMessage('voice', result.fileUrl, 'Voice Message', result.fileSize);
                this.closeVoiceModal();
                this.showToast('Voice message sent!', 'success');
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Voice upload error:', error);
            this.hideUploadProgress();
            this.showToast('Failed to send voice message', 'error');
        }
    }
    // Message sending methods
    sendTextMessage() {
        const message = this.elements.messageInput.value.trim();

        if (!message || !this.isConnected) {
            return;
        }

        this.sendMessage('text', message);

        // Clear input
        this.elements.messageInput.value = '';
        this.updateSendButton();
        this.elements.messageInput.focus();
    }

    sendMediaMessage(type, fileUrl, fileName, fileSize) {
        this.sendMessage(type, '', fileUrl, fileName, fileSize);
    }

    sendMessage(type, message = '', fileUrl = null, fileName = null, fileSize = null) {
        if (!this.isConnected) {
            this.showToast('Not connected to server', 'error');
            return;
        }

        // Send message via socket
        this.socket.emit('send-message', {
            type,
            message,
            fileUrl,
            fileName,
            fileSize
        });

        // Stop typing indicator
        if (this.isTyping) {
            this.isTyping = false;
            this.socket.emit('typing-stop');
        }
    }

    displayMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.userId === this.socket.id ? 'own' : ''}`;

        const isOwn = message.userId === this.socket.id;

        // Create message content based on type
        let messageContent = '';

        switch (message.type) {
            case 'image':
                messageContent = this.createImageMessage(message);
                break;
            case 'video':
                messageContent = this.createVideoMessage(message);
                break;
            case 'voice':
                messageContent = this.createVoiceMessage(message);
                break;
            default:
                messageContent = `<div class="message-bubble">${this.escapeHtml(message.message)}</div>`;
        }

        messageElement.innerHTML = `
            <img src="${message.avatar}" alt="${message.username}" class="message-avatar">
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username">${message.username}</span>
                    <span class="message-time">${message.timestamp}</span>
                </div>
                ${messageContent}
            </div>
        `;

        this.elements.messagesArea.appendChild(messageElement);
        this.scrollToBottom();

        // Add click listeners for media
        this.addMediaEventListeners(messageElement, message);
    }

    createImageMessage(message) {
        return `
            <div class="message-media">
                <img src="${message.fileUrl}" 
                     alt="Shared image" 
                     class="message-image"
                     loading="lazy"
                     onclick="this.classList.toggle('fullscreen')"
                     title="Click to toggle fullscreen">
            </div>
        `;
    }

    createVideoMessage(message) {
        return `
            <div class="message-media">
                <video class="message-video" controls preload="metadata">
                    <source src="${message.fileUrl}" type="video/mp4">
                    <source src="${message.fileUrl}" type="video/webm">
                    <source src="${message.fileUrl}" type="video/ogg">
                    Your browser does not support the video element.
                </video>
            </div>
        `;
    }

    createVoiceMessage(message) {
        const duration = this.formatDuration(0); // Default duration, will be updated when loaded
        const waveformBars = Array(20).fill(0).map(() => 
            `<div class="voice-bar" style="height: ${Math.random() * 20 + 5}px;"></div>`
        ).join('');

        return `
            <div class="message-voice" data-voice-url="${message.fileUrl}">
                <div class="voice-controls-mini">
                    <button class="voice-play-btn" title="Play voice message">
                        ▶️
                    </button>
                </div>
                <div class="voice-waveform">
                    ${waveformBars}
                </div>
                <div class="voice-duration">${duration}</div>
                <audio preload="metadata" style="display: none;">
                    <source src="${message.fileUrl}" type="audio/wav">
                    <source src="${message.fileUrl}" type="audio/mp3">
                    <source src="${message.fileUrl}" type="audio/ogg">
                </audio>
            </div>
        `;
    }

    addMediaEventListeners(messageElement, message) {
        // Image fullscreen toggle
        const images = messageElement.querySelectorAll('.message-image');
        images.forEach(img => {
            img.addEventListener('click', () => {
                this.toggleImageFullscreen(img);
            });
        });

        // Voice message controls
        const voiceMessages = messageElement.querySelectorAll('.message-voice');
        voiceMessages.forEach(voiceMsg => {
            const playBtn = voiceMsg.querySelector('.voice-play-btn');
            const audio = voiceMsg.querySelector('audio');
            const waveformBars = voiceMsg.querySelectorAll('.voice-bar');
            const durationEl = voiceMsg.querySelector('.voice-duration');

            // Load audio metadata
            audio.addEventListener('loadedmetadata', () => {
                durationEl.textContent = this.formatDuration(audio.duration);
            });

            // Play/pause functionality
            let isPlaying = false;
            playBtn.addEventListener('click', () => {
                if (isPlaying) {
                    audio.pause();
                } else {
                    // Pause all other audio
                    document.querySelectorAll('.message-voice audio').forEach(a => {
                        if (a !== audio) a.pause();
                    });
                    audio.play();
                }
            });

            audio.addEventListener('play', () => {
                isPlaying = true;
                playBtn.textContent = '⏸️';
                playBtn.title = 'Pause voice message';
                this.animateVoiceWaveform(waveformBars, true);
            });

            audio.addEventListener('pause', () => {
                isPlaying = false;
                playBtn.textContent = '▶️';
                playBtn.title = 'Play voice message';
                this.animateVoiceWaveform(waveformBars, false);
            });

            audio.addEventListener('ended', () => {
                isPlaying = false;
                playBtn.textContent = '▶️';
                playBtn.title = 'Play voice message';
                this.animateVoiceWaveform(waveformBars, false);
            });

            // Update waveform based on playback progress
            audio.addEventListener('timeupdate', () => {
                const progress = audio.currentTime / audio.duration;
                this.updateVoiceWaveformProgress(waveformBars, progress);
            });
        });
    }

    toggleImageFullscreen(img) {
        if (img.classList.contains('fullscreen')) {
            img.classList.remove('fullscreen');
            img.style.cssText = '';
        } else {
            img.classList.add('fullscreen');
            img.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                object-fit: contain;
                background: rgba(0, 0, 0, 0.9);
                z-index: 9999;
                cursor: zoom-out;
            `;
        }
    }

    animateVoiceWaveform(bars, animate) {
        bars.forEach((bar, index) => {
            if (animate) {
                bar.style.animationDelay = `${index * 0.1}s`;
                bar.classList.add('active');
            } else {
                bar.classList.remove('active');
            }
        });
    }

    updateVoiceWaveformProgress(bars, progress) {
        const activeBarCount = Math.floor(bars.length * progress);
        bars.forEach((bar, index) => {
            if (index < activeBarCount) {
                bar.style.background = 'var(--primary)';
            } else {
                bar.style.background = 'var(--media-voice)';
            }
        });
    }

    formatDuration(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Upload progress methods
    showUploadProgress(filename, status) {
        const progressEl = this.elements.uploadProgress;
        const filenameEl = progressEl.querySelector('.upload-filename');
        const statusEl = progressEl.querySelector('.upload-status');
        const progressBar = progressEl.querySelector('.progress-fill');

        filenameEl.textContent = filename;
        statusEl.textContent = status;
        progressBar.style.width = '0%';
        progressEl.classList.remove('hidden');

        // Simulate progress (since we don't have real progress tracking)
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90; // Stop at 90% until real completion
            progressBar.style.width = progress + '%';
        }, 200);

        this.uploadProgressInterval = interval;
    }

    hideUploadProgress() {
        if (this.uploadProgressInterval) {
            clearInterval(this.uploadProgressInterval);
        }

        const progressEl = this.elements.uploadProgress;
        const progressBar = progressEl.querySelector('.progress-fill');

        // Complete the progress bar
        progressBar.style.width = '100%';

        // Hide after a short delay
        setTimeout(() => {
            progressEl.classList.add('hidden');
        }, 1000);
    }

    // Existing methods with minor updates
    clearProfilePicture() {
        this.elements.profilePreview.classList.add('hidden');
        this.elements.uploadArea.style.display = 'block';
        this.elements.previewImg.src = '';
        this.elements.profilePicInput.value = '';
        this.currentProfilePicUrl = null;
    }

    generateDefaultAvatar(username) {
        const colors = ['#4F46E5', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
        const color = colors[username.length % colors.length];
        const initial = username.charAt(0).toUpperCase();

        return `data:image/svg+xml,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="50" fill="${color}"/>
                <text x="50" y="58" font-family="Arial" font-size="36" fill="white" text-anchor="middle">${initial}</text>
            </svg>
        `)}`;
    }

    validateUsername(username) {
        const errorElement = document.getElementById('usernameError');

        if (username.length < 2) {
            errorElement.textContent = 'Username must be at least 2 characters long';
            errorElement.classList.add('show');
            return false;
        } else if (username.length > 20) {
            errorElement.textContent = 'Username must be less than 20 characters';
            errorElement.classList.add('show');
            return false;
        } else if (!/^[a-zA-Z0-9_\s]+$/.test(username)) {
            errorElement.textContent = 'Username can only contain letters, numbers, and underscores';
            errorElement.classList.add('show');
            return false;
        }

        errorElement.classList.remove('show');
        return true;
    }

    async handleJoinChat() {
        const username = this.elements.usernameInput.value.trim();

        if (!this.validateUsername(username)) {
            return;
        }

        if (!this.isConnected) {
            this.showToast('Not connected to server. Please try again.', 'error');
            return;
        }

        // Show loading state
        const btnText = this.elements.joinBtn.querySelector('.btn-text');
        const btnLoading = this.elements.joinBtn.querySelector('.btn-loading');
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        this.elements.joinBtn.disabled = true;

        try {
            // Prepare user data
            const avatar = this.currentProfilePicUrl || this.generateDefaultAvatar(username);

            this.currentUser = {
                username: username,
                avatar: avatar
            };

            // Join the chat
            this.socket.emit('join-chat', this.currentUser);

            // Switch to chat interface
            setTimeout(() => {
                this.showChatInterface();
                this.showToast(`Welcome to Enhanced WorldChat, ${username}!`, 'success');
            }, 1000);

        } catch (error) {
            console.error('Join chat error:', error);
            this.showToast('Failed to join chat. Please try again.', 'error');
        } finally {
            // Reset loading state
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
            this.elements.joinBtn.disabled = false;
        }
    }

    showChatInterface() {
        this.elements.welcomeScreen.classList.add('hidden');
        this.elements.chatInterface.classList.remove('hidden');

        // Update current user info
        this.elements.currentUserAvatar.src = this.currentUser.avatar;
        this.elements.currentUsername.textContent = this.currentUser.username;

        // Focus message input
        this.elements.messageInput.focus();

        // Clear welcome message after a delay
        setTimeout(() => {
            const welcomeMsg = this.elements.messagesArea.querySelector('.welcome-message');
            if (welcomeMsg) {
                welcomeMsg.style.animation = 'fadeOut 0.5s ease-out forwards';
                setTimeout(() => welcomeMsg.remove(), 500);
            }
        }, 5000);
    }

    handleTyping() {
        if (!this.isTyping && this.isConnected) {
            this.isTyping = true;
            this.socket.emit('typing-start');
        }

        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => {
            if (this.isTyping) {
                this.isTyping = false;
                this.socket.emit('typing-stop');
            }
        }, 1000);
    }

    handleUserTyping(data) {
        const typingText = this.elements.typingIndicator.querySelector('.typing-text');

        if (data.isTyping) {
            typingText.textContent = `${data.username} is typing...`;
            this.elements.typingIndicator.classList.add('show');
        } else {
            this.elements.typingIndicator.classList.remove('show');
        }
    }

    updateSendButton() {
        const hasText = this.elements.messageInput.value.trim().length > 0;
        this.elements.sendBtn.classList.toggle('active', hasText);
    }

    displaySystemMessage(message, type = 'info') {
        const messageElement = document.createElement('div');
        messageElement.className = `system-message ${type}`;
        messageElement.innerHTML = `
            <div class="system-message-content">
                ${this.escapeHtml(message)}
            </div>
        `;

        this.elements.messagesArea.appendChild(messageElement);
        this.scrollToBottom();
    }

    loadMessageHistory(messages) {
        // Clear existing messages except welcome message
        const existingMessages = this.elements.messagesArea.querySelectorAll('.message, .system-message');
        existingMessages.forEach(msg => msg.remove());

        // Display all messages
        messages.forEach(message => {
            this.displayMessage(message);
        });
    }

    updateUsersList(users) {
        this.elements.usersList.innerHTML = '';

        // Filter out current user and sort by online status
        const otherUsers = users.filter(user => this.socket && user.id !== this.socket.id);
        const sortedUsers = otherUsers.sort((a, b) => {
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return a.username.localeCompare(b.username);
        });

        sortedUsers.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.innerHTML = `
                <img src="${user.avatar}" alt="${user.username}" class="user-avatar">
                <div class="user-info">
                    <div class="user-name">${this.escapeHtml(user.username)}</div>
                    <div class="user-status">
                        ${user.isOnline !== false ? '<span class="status-dot"></span> Online' : 'Offline'}
                    </div>
                </div>
            `;
            this.elements.usersList.appendChild(userElement);
        });

        // Update counts
        const onlineCount = users.filter(u => u.isOnline !== false).length;
        const totalCount = users.length;

        this.elements.onlineCount.textContent = onlineCount;
        this.elements.userCount.textContent = `${totalCount} user${totalCount !== 1 ? 's' : ''} online`;
    }

    updateConnectionStatus(connected) {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = statusIndicator.nextElementSibling;

        if (connected) {
            statusIndicator.classList.add('connected');
            statusText.textContent = 'Connected';
        } else {
            statusIndicator.classList.remove('connected');
            statusText.textContent = 'Disconnected';
        }
    }

    leaveChat() {
        if (confirm('Are you sure you want to leave the chat?')) {
            if (this.socket) {
                this.socket.disconnect();
            }

            // Stop any ongoing recording
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.stopRecording();
            }

            // Reset to welcome screen
            this.elements.chatInterface.classList.add('hidden');
            this.elements.welcomeScreen.classList.remove('hidden');

            // Clear form
            this.elements.usernameInput.value = '';
            this.clearProfilePicture();

            // Reset state
            this.currentUser = null;
            this.isTyping = false;

            this.showToast('You have left the chat', 'success');

            // Reconnect for next use
            setTimeout(() => {
                this.initializeSocketConnection();
            }, 1000);
        }
    }

    scrollToBottom() {
        this.elements.messagesArea.scrollTop = this.elements.messagesArea.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 500);
        }, duration);
    }
}

// Initialize the enhanced chat application
document.addEventListener('DOMContentLoaded', () => {
    new WorldChatClient();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Scroll to bottom when user returns to tab
        const messagesArea = document.getElementById('messagesArea');
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Close modals with Escape key
    if (e.key === 'Escape') {
        const voiceModal = document.getElementById('voiceModal');
        if (voiceModal && !voiceModal.classList.contains('hidden')) {
            const closeBtn = document.getElementById('closeVoiceModal');
            if (closeBtn) closeBtn.click();
        }

        // Close fullscreen images
        const fullscreenImages = document.querySelectorAll('.message-image.fullscreen');
        fullscreenImages.forEach(img => {
            img.classList.remove('fullscreen');
            img.style.cssText = '';
        });
    }
});