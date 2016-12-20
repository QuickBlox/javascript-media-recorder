/* JSHint inline rules */
/* jshint node: true, browser: true */
/* globals qbMediaRecorder, Promise */

'use strict';

var notify = {
    ui: document.querySelector('.j-notify'),
    hide: function() {
        this.ui.classList.remove('notify-active');
    },
    show: function(txt) {
        var n = this;

        n.ui.textContent = txt;
        n.ui.classList.add('notify-active');

        var timerId = setTimeout(function() {
            n.hide();
        }, 5000);
    }
};

var resultCard = {
    blob: null, // saved a blob after stopped a record
    ui: {
        wrap: document.querySelector('.j-result-card'),
        video: document.querySelector('.j-video_result'),
        clear: document.querySelector('.j-clear'),
        download: document.querySelector('.j-download')
    },
    toggleBtn: function(state) {
        this.ui.clear.disabled = state;
        this.ui.download.disabled = state;
    },
    attachVideo: function(blob) {
        this.ui.video.src = URL.createObjectURL(blob);

        this.ui.clear.disabled = false;
        this.ui.download.disabled = false;
    },
    detachVideo: function() {
        this.blob = null;
        this.ui.video.src = '';

        this.ui.clear.disabled = true;
        this.ui.download.disabled = true;
    },
    setupListeners: function(rec) {
        var self = this;

        var evClear = new CustomEvent('clear');
        var evDownload = new CustomEvent('download');

        self.ui.clear.addEventListener('click', function() {
            self.ui.video.pause();
            self.detachVideo();
            
            self.ui.wrap.dispatchEvent(evClear);
        });
        
        self.ui.download.addEventListener('click', function() {
            self.ui.wrap.dispatchEvent(evDownload);
        });
    }
};

var inputCard = {
    stream: null,
    devices: {
        audio: [],
        video: []
    },
    ui: {
        wrap: document.querySelector('.j-card'),
        video: document.querySelector('.j-video_local'),

        start: document.querySelector('.j-start'),
        stop: document.querySelector('.j-stop'),
        pause: document.querySelector('.j-pause'),
        resume: document.querySelector('.j-resume'),

        selectAudioSource: document.getElementById('j-audioSource'),
        selectVideoSource: document.getElementById('j-videoSource'),
    },
    _createOptions: function(type) {
        var docfrag = document.createDocumentFragment();

        /* create a default option */
        var optDef = document.createElement('option');
        optDef.textContent = `Choose an input ${type}-device`;
        optDef.value = 'default';

        docfrag.appendChild(optDef);

        /* create a options with available sources */
        this.devices[type].forEach(function(device, index) {
            var option = document.createElement('option');

            option.value = device.deviceId;
            option.textContent = device.label || `${index + 1} ${type} source`;

            docfrag.appendChild(option);
        });

        /* create a option which off a type a media */
        var optOff = document.createElement('option');
        optOff.textContent = `Off ${type} source`;
        optOff.value = 0;

        docfrag.appendChild(optOff);

        return docfrag;
    },
    _processDevices: function(devices) {
        var self = this;

        var docfragAudio = document.createDocumentFragment(),
            docfragVideo = document.createDocumentFragment()

        devices.forEach(function(device) {
            if(device.kind.indexOf('input') !== -1) {
                if(device.kind === 'audioinput') {
                    /* set audio source to collection */
                    self.devices.audio.push(device);
                }

                if(device.kind === 'videoinput') {
                    /* set video source to collection */
                    self.devices.video.push(device);
                }
            }
        });

        if(self.devices.audio.length > 1) {
            self.ui.selectAudioSource.appendChild( self._createOptions('audio') );
            self.ui.selectAudioSource.classList.remove('invisible');
        }

        if(self.devices.video.length > 1) {
            self.ui.selectVideoSource.appendChild( self._createOptions('video') );
            self.ui.selectVideoSource.classList.remove('invisible');
        }
    },
    getDevices: function() {
        var self = this;

        navigator.mediaDevices.enumerateDevices()
            .then(function(devices) {
                 self._processDevices(devices);
            })
    },
    attachStreamToSource: function() {
        this.ui.video.pause();
        this.ui.video.src='';

        this.ui.video.src = URL.createObjectURL(this.stream);
        this.ui.video.play();
    },
    getUserMedia: function(attrs) {
        var constraints = attrs || { audio: true, video: true };

        return navigator.mediaDevices.getUserMedia(constraints)
    },
    _getSources: function() {
        var sVideo = this.ui.selectVideoSource,
            sAudio = this.ui.selectAudioSource,
            selectedAudioSource = sAudio.options[sAudio.selectedIndex].value,
            selectedVideoSource = sVideo.options[sVideo.selectedIndex].value;

        var constraints = {};

        if(selectedAudioSource === 'default') {
            constraints.audio = true;
        } else if(selectedAudioSource === '0') {
            constraints.audio = false;
        } else {
            constraints.audio = {deviceId: selectedAudioSource};
        }

        if(selectedVideoSource === 'default') {
            constraints.video = true;
        } else if(selectedVideoSource === '0') {
            constraints.video = false;
        } else {
            constraints.video = {deviceId: selectedVideoSource};
        }

        return constraints;
    },
    _stopStreaming: function() {
        this.stream.getTracks().forEach(function(track) {
            track.stop();
        });
    },
    _setupListeners: function() {
        var self = this;

        var evStart = new CustomEvent('started');
        var evPause = new CustomEvent('paused');
        var evResume = new CustomEvent('resumed');
        var evStop = new CustomEvent('stopped');
        var evChange = new CustomEvent('changed');

        self.ui.start.addEventListener('click', function() {
            self.ui.start.disabled = true;
            self.ui.resume.disabled = true;

            self.ui.stop.disabled = false;
            self.ui.pause.disabled = false;

            self.ui.wrap.dispatchEvent(evStart);
        });

        self.ui.stop.addEventListener('click', function() {
            self.ui.start.disabled = false;

            self.ui.stop.disabled = true;
            self.ui.pause.disabled = true;
            self.ui.resume.disabled = true;

            self.ui.wrap.dispatchEvent(evStop);
        });

        self.ui.pause.addEventListener('click', function() {
            self.ui.start.disabled = true;
            self.ui.pause.disabled = true;

            self.ui.resume.disabled = false;
            self.ui.stop.disabled = false;

            self.ui.wrap.dispatchEvent(evPause);
        });

        self.ui.resume.addEventListener('click', function() {
            self.ui.start.disabled = true;
            self.ui.resume.disabled = true;

            self.ui.pause.disabled = false;
            self.ui.stop.disabled = false;

            self.ui.wrap.dispatchEvent(evResume);
        });

        function handleSources() {
            var constrains = self._getSources();
            
            self._stopStreaming();
            self.stream = null;

            self.getUserMedia(constrains).then(function(stream) {
                console.info('1', stream);
                self.stream = stream;
                self.attachStreamToSource();

                self.ui.wrap.dispatchEvent(evChange);
            });
        }

        self.ui.selectAudioSource.addEventListener('change', handleSources);
        self.ui.selectVideoSource.addEventListener('change', handleSources);
    },
    init: function() {
        var self = this;

        return new Promise(function(resolve, reject) {
            self.getUserMedia()
                .then(function(stream) {
                    self.stream = stream;
                    self.attachStreamToSource();
                    self.getDevices();
                    self._setupListeners();

                    resolve();
                }).catch(function(error) {
                    reject(error);
                })
        });
    }
};

/* Start !FUN */
inputCard.init()
    .then(function() {
        var opts = {
                'callbacks': {
                    onStart: function onStartRecording() {
                    },
                    onStop: function onStoppedRecording(blob) {
                        console.error(blob);
                        resultCard.blob = blob;
                        resultCard.attachVideo(blob);
                    },
                    ondataavailable: function onDataAvaible(e) {
                    }
                }
            };

        var rec = new qbMediaRecorder(opts);

        resultCard.setupListeners();

        inputCard.ui.wrap.addEventListener('started', function() {
            rec.start(inputCard.stream);
        }, false);

        inputCard.ui.wrap.addEventListener('paused', function() {
            rec.pause();
        }, false);

        inputCard.ui.wrap.addEventListener('resumed', function() {
            rec.resume();
        }, false);

        inputCard.ui.wrap.addEventListener('changed', function() {
            if(rec.getState() === 'recording') {
                console.info(inputCard.stream);
                rec.change(inputCard.stream);
            }
        }, false);

        inputCard.ui.wrap.addEventListener('stopped', function() {
            rec.stop();
            resultCard.toggleBtn(false);
        }, false);

        resultCard.ui.wrap.addEventListener('download', function() {
            rec.download(null, resultCard.blob);
        }, false);
    })
    .catch(function(error) {
        notify.show(`Error: ${error.name}`);
    });








