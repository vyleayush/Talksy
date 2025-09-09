// Advanced WorldChat Frontend with Notifications and Calling

class AdvancedWorldChatClient {
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

        // Notification settings
        this.notificationsEnabled = false;
        this.soundEnabled = true;
        this.notificationPermission = 'default';

        // WebRTC for calling
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCall = null;
        this.isInCall = false;

        // WebRTC configuration
        this.rtcConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

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
            enableNotifications: document.getElementById('enableNotifications'),

            // Header elements
            currentUserAvatar: document.getElementById('currentUserAvatar'),
            currentUsername: document.getElementById('currentUsername'),
            userCount: document.getElementById('userCount'),
            onlineCount: document.getElementById('onlineCount'),
            notificationToggle: document.getElementById('notificationToggle'),
            soundToggle: document.getElementById('soundToggle'),
            leaveBtn: document.getElementById('leaveBtn'),

            // Chat elements
            usersList: document.getElementById('usersList'),
            messagesArea: document.getElementById('messagesArea'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
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

            // Call modal
            callModal: document.getElementById('callModal'),
            callTitle: document.getElementById('callTitle'),
            callStatus: document.getElementById('callStatus'),
            callUserAvatar: document.getElementById('callUserAvatar'),
            callUserName: document.getElementById('callUserName'),
            videoContainer: document.getElementById('videoContainer'),
            localVideo: document.getElementById('localVideo'),
            remoteVideo: document.getElementById('remoteVideo'),
            answerCallBtn: document.getElementById('answerCallBtn'),
            declineCallBtn: document.getElementById('declineCallBtn'),
            endCallBtn: document.getElementById('endCallBtn'),
            muteBtn: document.getElementById('muteBtn'),
            videoToggleBtn: document.getElementById('videoToggleBtn'),

            // Notification modal
            notificationModal: document.getElementById('notificationModal'),
            allowNotifications: document.getElementById('allowNotifications'),
            denyNotifications: document.getElementById('denyNotifications'),

            // Upload progress
            uploadProgress: document.getElementById('uploadProgress'),

            // Sounds
            notificationSound: document.getElementById('notificationSound'),
            ringtone: document.getElementById('ringtone')
        };

        this.initializeEventListeners();
        this.initializeSocketConnection();
        this.checkMediaSupport();
        this.initializeNotifications();
    }

    checkMediaSupport() {
        // Check if browser supports media recording and WebRTC
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('Media recording not supported');
            this.elements.voiceBtn.disabled = true;
            this.elements.voiceBtn.title = 'Voice recording not supported in this browser';
        }

        if (!window.RTCPeerConnection) {
            console.warn('WebRTC not supported');
            this.showToast('Voice/Video calling not supported in this browser', 'warning');
        }
    }

    initializeNotifications() {
        // Check notification permission status
        if ('Notification' in window) {
            this.notificationPermission = Notification.permission;
            this.updateNotificationUI();

            if (this.notificationPermission === 'default') {
                // Show notification permission modal after joining
                setTimeout(() => {
                    if (this.currentUser) {
                        this.showNotificationModal();
                    }
                }, 3000);
            } else if (this.notificationPermission === 'granted') {
                this.notificationsEnabled = true;
                this.updateNotificationUI();
            }
        }
    }

    updateNotificationUI() {
        const notifyBtn = this.elements.notificationToggle;
        const soundBtn = this.elements.soundToggle;

        if (this.notificationsEnabled && this.notificationPermission === 'granted') {
            notifyBtn.classList.add('active');
            notifyBtn.title = 'Notifications enabled';
        } else {
            notifyBtn.classList.remove('active');
            notifyBtn.classList.add('disabled');
            notifyBtn.title = 'Notifications disabled';
        }

        if (this.soundEnabled) {
            soundBtn.classList.add('active');
            soundBtn.textContent = '🔊';
            soundBtn.title = 'Sound enabled';
        } else {
            soundBtn.classList.remove('active');
            soundBtn.textContent = '🔇';
            soundBtn.title = 'Sound disabled';
        }
    }

    showNotificationModal() {
        this.elements.notificationModal.classList.remove('hidden');
    }

    hideNotificationModal() {
        this.elements.notificationModal.classList.add('hidden');
    }

    async requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission;

            if (permission === 'granted') {
                this.notificationsEnabled = true;
                this.showToast('Notifications enabled! You\'ll receive alerts for new messages and calls.', 'success');
            } else {
                this.showToast('Notifications disabled. You can enable them later in browser settings.', 'warning');
            }

            this.updateNotificationUI();
        }
    }

    showDesktopNotification(title, body, icon, tag) {
        if (this.notificationsEnabled && this.notificationPermission === 'granted') {
            const notification = new Notification(title, {
                body: body,
                icon: icon || '/favicon.ico',
                tag: tag,
                requireInteraction: false,
                silent: !this.soundEnabled
            });

            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);

            // Focus window when notification is clicked
            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            // Play sound if enabled
            if (this.soundEnabled) {
                this.playNotificationSound();
            }
        }
    }

    playNotificationSound() {
        if (this.soundEnabled && this.elements.notificationSound) {
            this.elements.notificationSound.currentTime = 0;
            this.elements.notificationSound.play().catch(e => {
                console.log('Could not play notification sound:', e);
            });
        }
    }

    playRingtone() {
        if (this.soundEnabled && this.elements.ringtone && !this.isInCall) {
            this.elements.ringtone.currentTime = 0;
            this.elements.ringtone.play().catch(e => {
                console.log('Could not play ringtone:', e);
            });
        }
    }

    stopRingtone() {
        if (this.elements.ringtone) {
            this.elements.ringtone.pause();
            this.elements.ringtone.currentTime = 0;
        }
    }

    initializeEventListeners() {
        // Welcome form submission
        this.elements.joinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleJoinChat();
        });

        // Notification controls
        this.elements.notificationToggle.addEventListener('click', () => {
            if (this.notificationPermission !== 'granted') {
                this.showNotificationModal();
            } else {
                this.notificationsEnabled = !this.notificationsEnabled;
                this.updateNotificationUI();
                this.showToast(
                    this.notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled', 
                    'success'
                );
            }
        });

        this.elements.soundToggle.addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            this.updateNotificationUI();
            this.showToast(
                this.soundEnabled ? 'Sound enabled' : 'Sound disabled', 
                'success'
            );
        });

        // Notification modal
        this.elements.allowNotifications.addEventListener('click', async () => {
            await this.requestNotificationPermission();
            this.hideNotificationModal();
        });

        this.elements.denyNotifications.addEventListener('click', () => {
            this.hideNotificationModal();
            this.showToast('You can enable notifications later from the chat header', 'info');
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

        // Call modal controls
        this.elements.answerCallBtn.addEventListener('click', () => {
            this.answerCall();
        });

        this.elements.declineCallBtn.addEventListener('click', () => {
            this.declineCall();
        });

        this.elements.endCallBtn.addEventListener('click', () => {
            this.endCall();
        });

        this.elements.muteBtn.addEventListener('click', () => {
            this.toggleMute();
        });

        this.elements.videoToggleBtn.addEventListener('click', () => {
            this.toggleVideo();
        });

        // Leave chat
        this.elements.leaveBtn.addEventListener('click', () => {
            this.leaveChat();
        });

        // Username input validation
        this.elements.usernameInput.addEventListener('input', (e) => {
            this.validateUsername(e.target.value);
        });

        // Close modals when clicking outside
        this.elements.voiceModal.addEventListener('click', (e) => {
            if (e.target === this.elements.voiceModal) {
                this.closeVoiceModal();
            }
        });

        this.elements.callModal.addEventListener('click', (e) => {
            if (e.target === this.elements.callModal) {
                // Don't close call modal by clicking outside during active call
                if (!this.isInCall) {
                    this.hideCallModal();
                }
            }
        });

        this.elements.notificationModal.addEventListener('click', (e) => {
            if (e.target === this.elements.notificationModal) {
                this.hideNotificationModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key to close modals
            if (e.key === 'Escape') {
                if (!this.elements.voiceModal.classList.contains('hidden')) {
                    this.closeVoiceModal();
                }
                if (!this.elements.notificationModal.classList.contains('hidden')) {
                    this.hideNotificationModal();
                }
                // Don't close call modal with Escape during active call
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
                this.showDesktopNotification(
                    'WorldChat Disconnected',
                    'Connection lost. Trying to reconnect...',
                    null,
                    'connection'
                );
                this.showToast('Connection lost. Trying to reconnect...', 'error');
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                this.showToast('Failed to connect to server', 'error');
            });

            // Enhanced chat events with notifications
            this.socket.on('active-users', (users) => {
                this.updateUsersList(users);
            });

            this.socket.on('message-history', (messages) => {
                this.loadMessageHistory(messages);
            });

            this.socket.on('new-message', (message) => {
                this.displayMessage(message);
                this.scrollToBottom();

                // Show notification for messages from other users
                if (message.userId !== this.socket.id && message.isNotification) {
                    let notificationText = '';
                    let icon = message.avatar;

                    switch (message.type) {
                        case 'text':
                            notificationText = message.message;
                            break;
                        case 'image':
                            notificationText = 'sent an image';
                            break;
                        case 'video':
                            notificationText = 'shared a video';
                            break;
                        case 'voice':
                            notificationText = 'sent a voice message';
                            break;
                    }

                    this.showDesktopNotification(
                        `${message.username} - WorldChat`,
                        notificationText,
                        icon,
                        'new-message'
                    );
                }
            });

            this.socket.on('user-joined', (data) => {
                this.displaySystemMessage(data.message, 'user-joined');

                // Show notification for user joining
                this.showDesktopNotification(
                    'User Joined - WorldChat',
                    data.message,
                    data.avatar,
                    'user-joined'
                );

                this.showToast(`${data.username} joined the chat!`, 'success');
            });

            this.socket.on('user-left', (data) => {
                this.displaySystemMessage(data.message, 'user-left');

                // Show notification for user leaving
                if (data.isNotification) {
                    this.showDesktopNotification(
                        'User Left - WorldChat',
                        data.message,
                        null,
                        'user-left'
                    );
                }

                this.showToast(`${data.username} left the chat`, 'warning');
            });

            this.socket.on('user-typing', (data) => {
                this.handleUserTyping(data);
            });

            // Call events
            this.socket.on('incoming-call', (data) => {
                this.handleIncomingCall(data);
            });

            this.socket.on('call-initiated', (data) => {
                this.handleCallInitiated(data);
            });

            this.socket.on('call-accepted', (data) => {
                this.handleCallAccepted(data);
            });

            this.socket.on('call-declined', (data) => {
                this.handleCallDeclined(data);
            });

            this.socket.on('call-ended', (data) => {
                this.handleCallEnded(data);
            });

            // WebRTC signaling events
            this.socket.on('webrtc-offer', (data) => {
                this.handleWebRTCOffer(data);
            });

            this.socket.on('webrtc-answer', (data) => {
                this.handleWebRTCAnswer(data);
            });

            this.socket.on('webrtc-ice-candidate', (data) => {
                this.handleWebRTCIceCandidate(data);
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
}
