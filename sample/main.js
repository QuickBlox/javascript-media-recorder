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
            
            self.ui.wrap.dispatchEvent(evClear);
        });
        
        self.ui.download.addEventListener('click', function() {
            self.ui.wrap.dispatchEvent(evDownload);
        });
    }
};

var streamCard = {
    stream: null,
    ui: {
        wrap: document.querySelector('.j-card'),
        start: document.querySelector('.j-start'),
        stop: document.querySelector('.j-stop'),
        pause: document.querySelector('.j-pause'),
        resume: document.querySelector('.j-resume'),
        video: document.querySelector('.j-video_local'),
        typesMedia: document.getElementsByName('type')
    },
    stopStreaming: function(stream) {
        stream.getTracks().forEach(function(track) {
            track.stop();
        });
    },
    getChoosesTypeMedia: function() {
        var typeMedia; // 1 - audio only, 2 - audion & video

        this.ui.typesMedia.forEach(function(rBtn) {
            if (rBtn.checked) {
                typeMedia = +rBtn.value;
            }
        });

        return typeMedia;
    },
    getMediaStream: function() {
        var self = this;

        var constraints = {
            audio: true, 
            video: this.getChoosesTypeMedia() === 1 ? false : true // 1 - audio only, 2 - audion & video
        };

        return new Promise(function(resolve, reject) {
            navigator.mediaDevices.getUserMedia(constraints)
                .then(function(stream) {
                    if(constraints.video) {
                        if(!stream.getVideoTracks().length) {
                            self.stopStreaming(stream);
                            reject({
                                name: 'NoVideoInput'
                            });
                        }
                    }

                    resolve(stream);
                })
                .catch(function(error) {
                    reject(error);
                });
        });
    },
    attachStreamToSource: function() {
        this.ui.video.pause();
        this.ui.video.src='';

        this.ui.video.src = URL.createObjectURL(this.stream);
        this.ui.video.play();
    },
    init: function() {
        var self = this;

        return new Promise(function(resolve, reject) {
            self.getMediaStream().then(function(stream) {
                if(self.stream) {
                    self.stopStreaming(self.stream);

                    self.stream = null;
                }

                self.stream = stream;
                self.attachStreamToSource();

                resolve(stream);
            }, function(e) {
                reject(e);
            });
        });
    },
    setupListeners: function(rec) {
        var self = this;

        var evStart = new CustomEvent('starting');
        var evStop = new CustomEvent('stopped');
        var evPause = new CustomEvent('paused');
        var evResume = new CustomEvent('resumed');
        

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

        function handleMediaTypesChanged() {
            self.init().then(function(stream) {
                var evChangeTypes = new CustomEvent('changedTypes', {
                    'detail': {
                        'stream': stream
                    }
                });

                self.ui.start.disabled = false;
                self.ui.pause.disabled = true;
                self.ui.resume.disabled = true;
                self.ui.stop.disabled = true;

                self.ui.wrap.dispatchEvent(evChangeTypes);
            });
        }
        
        for (var i = 0; i < self.ui.typesMedia.length; i++) {
            self.ui.typesMedia[i].addEventListener('change', handleMediaTypesChanged);
        }
    }
};

var rec;

streamCard.init().then(function(stream) {
    var opts = {
        callbacks: {
            onStart: function onStartRecording() {
                console.info('Starting record');
            },
            onStop: function onStoppedRecording(blob) {
                resultCard.blob = blob;
                resultCard.attachVideo(blob);
            },
            ondataavailable: function onDataAvaible(e) {
                // console.info(e);
            }
        }
    };

    streamCard.setupListeners();
    resultCard.setupListeners();

    opts.mimeType = streamCard.getChoosesTypeMedia() === 1 ? 'audio' : 'video';
    rec = new qbMediaRecorder(stream, opts);

    streamCard.ui.wrap.addEventListener('starting', function() {
        rec.start();
    }, false);

    streamCard.ui.wrap.addEventListener('stopped', function() {
        rec.stop();

        resultCard.toggleBtn(false);
    }, false);

    streamCard.ui.wrap.addEventListener('paused', function() {
        rec.pause();
    }, false);

    streamCard.ui.wrap.addEventListener('resumed', function() {
        rec.resume();
    }, false);

    streamCard.ui.wrap.addEventListener('changedTypes', function(e) {
        rec.stop();
        console.log('AFTERONSTOP');
        resultCard.toggleBtn(true);
        resultCard.detachVideo();

        opts.mimeType = streamCard.getChoosesTypeMedia() === 1 ? 'audio' : 'video';
        rec = new qbMediaRecorder(e.detail.stream, opts);
    }, false);

    /** Remove recorded media */
    resultCard.ui.wrap.addEventListener('clear', function() {
        resultCard.detachVideo();
    }, false);

    /** Download recorded media */
    resultCard.ui.wrap.addEventListener('download', function() {
        rec.download(null, resultCard.blob);
    }, false);
}).catch(function(e) {
    notify.show(e.name);
});

