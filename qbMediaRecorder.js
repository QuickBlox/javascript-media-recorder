(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.QBMediaRecorder = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = {
    'unsupport': 'QBMediaRecorder is not supported this environment.',
    'unsupportCustomMimeType': 'Incorrect audio mimeType.',
    'unsupportCustomAudioRecorder': 'qbAudioRecorderWorker.js wasn\'t found.',
    'unsupportAudioContext': 'AudioContext API is not supported this environment.',
    'unsupportMediaRecorderWithOptions': 'Got a warning when creating a MediaRecorder, trying to create MediaRecorder without options.',
    'requreArgument': '1 argument required, but only 0 present.',
    'callbackError': 'Founded an error in callback:',
    'actionFailed': 'QBMediaRecorder is not created or has an invalid state.',
    'no_recorded_chunks': 'Does not have any recording data.',
    'streamRequired': 'MediaStream is required.',
    'InvalidState': 'QBMediaRecorder is not in a state in which the proposed operation is allowed to be executed.',
    'OutOfMemory': 'The UA has exhaused the available memory. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'IllegalStreamModification': 'A modification to the stream has occurred that makes it impossible to continue recording. An example would be the addition of a Track while recording is occurring. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'OtherRecordingError': 'Used for an fatal error other than those listed above. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'GenericError': 'The UA cannot provide the codec or recording option that has been requested'
};
},{}],2:[function(require,module,exports){
'use strict';

var ERRORS = require('./errors');

/**
 * @constructor QBMediaRecorder
 * @param {Object}   [opts] - Object of parameters.
 * @param {String}   opts[].mimeType=video - Specifies the media type and container format for the recording. You can set simply: 'video' or 'audio' or 'audio/webm' ('audio/wav' or 'audio/mp3' mimeTypes uses AudioContext API instead of MediaRecorder API);
 * @param {String}   opts[].workerPath - Relative path from index.html.
 * @param {Number}   opts[].timeslice=1000 - The minimum number of milliseconds of data to return in a single Blob, fire 'ondataavaible' callback (isn't need to use with 'audio/wav' of 'audio/mp3').
 * @param {Boolean}  opts[].ignoreMutedMedia=true - What to do with a muted input MediaStreamTrack, e.g. insert black frames/zero audio volume in the recording or ignore altogether.
 * @param {Function} opts[].onstart - Called to handle the start event.
 * @param {Function} opts[].onstop - Called to handle the stop event.
 * @param {Function} opts[].onpause - Called to handle the pause event.
 * @param {Function} opts[].onresume - Called to handle the resume event.
 * @param {Function} opts[].onerror - Called to handle an ErrorEvent.
 * @param {Function} opts[].onchange - Called to handle the change a stream event.
 * @param {Function} opts[].ondataavailable - Called to handle the dataavailable event. The Blob of recorded data is contained in this event (Callback isn't supported if use 'audio/wav' of 'audio/mp3' for recording).
 *
 * @example
 * var opts = {
 *     onstart: function onStart() { // Use named function.
 *         console.log('Recorder is started');
 *     },
 *     onstop: function onStop(Blob) {
 *         videoElement.src = URL.createObjectURL(blob);
 *     },
 *     mimeType: 'video/mp4'
 * };
 *
 * // uses as global variable, QBMediaRecorder is built as a UMD module.
 * var recorder = new QBMediaRecorder(opts);
 *
 * @example
 * // For record 'audio/mp3' or 'audio/wav' need to add {@link https://github.com/QuickBlox/javascript-media-recorder/blob/master/qbAudioRecorderWorker.js|'qbAudioRecorderWorker.js'} file to your project.
 * var opts = {
 *     // use named function
 *     onstart: function onStart() {
 *         console.log('Recorder is started');
 *     },
 *     onstop: function onStop(Blob) {
 *         videoElement.src = URL.createObjectURL(blob);
 *     },
 *     // 'audio/wav' or 'audio/mp3'
 *     mimeType: 'audio/mp3',
 *     // set relative path (from folder node_modules for example)
 *     workerPath: '../node_modules/javascript-media-recorder/qbAudioRecorderWorker.js'
 * };
 *
 * // uses as global variable, QBMediaRecorder is built as a UMD module.
 * var recorder = new QBMediaRecorder(opts);
 */
function QBMediaRecorder(opts) {
    var prefferedMimeType = opts && opts.mimeType ? opts.mimeType : false;
    this._customMimeType = (prefferedMimeType === 'audio/wav') ? 'audio/wav' :
                           (prefferedMimeType === 'audio/mp3') ? 'audio/mp3' : false;

    if (opts.workerPath) {
        if (this._customMimeType) {
            this._setCustomRecorderTools(opts.workerPath);
        } else {
            throw new Error(ERRORS.unsupportCustomMimeType);
        }
    }

    if(!QBMediaRecorder.isAvailable() && !this._customMimeType) {
        throw new Error(ERRORS.unsupport);
    }

    this.mimeType = this._getMimeType(prefferedMimeType);
    this.timeslice = opts && opts.timeslice && isNaN(+opts.timeslice) ? opts.timeslice : 1000;
    this.callbacks = opts ? this._getCallbacks(opts) : {};
    this.recordedBlobs = [];
    this.ignoreMutedMedia = opts && typeof(opts.ignoreMutedMedia) === 'boolean' ? opts.ignoreMutedMedia : true;

    this._stream = null;
    this._mediaRecorder = null;
    this._recordedChunks = [];
    this._keepRecording = false;
}

QBMediaRecorder.prototype._setCustomRecorderTools = function (workerPath) {
    var self = this;

    // init worker for custom audio types (audio/wav, audio/mp3)
    self.worker = new Worker(workerPath);

    QBMediaRecorder.isWorkerActive = !!self.worker;

    self._postMessageToWorker({
        cmd: 'init',
        mimeType: self.mimeType
    });

    self.worker.onmessage = function(event) {
        self._createBlob(event.data);
        self._closeAudioProcess();
    };

    if (!QBMediaRecorder._isAudioContext()) {
        throw new Error(ERRORS.unsupportAudioContext);
    }

    self.mimeType = self._customMimeType;
    /*
    * context = new AudioContext();
    * context.createScriptProcessor(bufferSize, numberOfInputChannels, numberOfOutputChannels);
    *
    * link: https://developer.mozilla.org/ru/docs/Web/API/AudioContext/createScriptProcessor
    */
    self.BUFFER_SIZE = 2048; // the buffer size in units of sample-frames.
    self.INPUT_CHANNELS = 1; // the number of channels for this node's input, defaults to 2
    self.OUTPUT_CHANNELS = 1; // the number of channels for this node's output, defaults to 2
    self._audioContext = null;
};

QBMediaRecorder.prototype._getMimeType = function (preffered) {
    var mimeType,
        type = 'video';

    if(preffered && QBMediaRecorder.isTypeSupported(preffered)) {
        mimeType = preffered;
    } else if(preffered) {
        type = preffered.toString().toLowerCase().indexOf('audio') === -1 ? 'video' : 'audio';
        mimeType = QBMediaRecorder.getSupportedMimeTypes(type)[0];
    } else {
        mimeType = QBMediaRecorder.getSupportedMimeTypes(type)[0];
    }

    return mimeType;
};

QBMediaRecorder.prototype._getCallbacks = function(opts) {
    var callbacks = {},
        callbackNames = ['onstart', 'onstop', 'onpause', 'onresume', 'onerror', 'onchange', 'ondataavailable'];

    callbackNames.forEach(function(name) {
        if (name in opts) {
            callbacks[name] = opts[name];
        }
    });

    return callbacks;
};

QBMediaRecorder._mimeTypes = require('./mimeTypes');

QBMediaRecorder._STATES = ['inactive', 'recording', 'paused'];

/**
 * It checks capability of recording in the environment.
 * Checks MediaRecorder, MediaRecorder.isTypeSupported and Blob.
 * @return {Boolean} Returns true if the QBMediaRecorder is available and can run, or false otherwise.
 *
 * @example
 * if(QBMediaRecorder.isAvailable()) {
 *     // ... show UI for recording
 * }
 */
QBMediaRecorder.isAvailable = function() {
    return !!(window && window.MediaRecorder && typeof window.MediaRecorder.isTypeSupported === 'function' && window.Blob);
};

QBMediaRecorder._isAudioContext = function () {
    return !!(window && (window.AudioContext || window.webkitAudioContext));
};

/**
 * Returns a Boolean which is true if the MIME type specified is one the user agent can record.
 * @param  {String} mimeType - The mimeType to check.
 * @return {Boolean}         - True if the MediaRecorder implementation is capable of recording Blob objects for the specified MIME type.
 *
 * @example
 * if( QBMediaRecorder.isTypeSupported('video/mp4') ) {
 *     el.textContent = 'Will be record in video/mp4';
 * }
 */
QBMediaRecorder.isTypeSupported = function(mimeType) {
    var result = false;

    if(!QBMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    if(!mimeType) {
        throw new Error(ERRORS.requreArgument);
    }

    switch(mimeType) {
        case 'audio/wav':
            if (QBMediaRecorder._isAudioContext()) {
                result = true;
            }
            break;

        case 'audio/mp3':
            if (QBMediaRecorder._isAudioContext()) {
                result = true;
            }
            break;

        default:
            result = window.MediaRecorder.isTypeSupported(mimeType);
            break;
    }

    return result;
};

/**
 * Return all supported mime types and container format.
 * @param  {String} [type=video] Type of media.
 * @return {Array}               Array of supported mimetypes. Recommended mimetype has 0 index.
 *
 * @example
 * var type = QBMediaRecorder.getSupportedMimeTypes('audio');
 * console.info(`Call will recording in ${type[0]}`);
 */
QBMediaRecorder.getSupportedMimeTypes = function(type) {
    var typeMedia = type || 'video';

    if (!QBMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    return QBMediaRecorder._mimeTypes[typeMedia].filter(function(mimeType) {
        return QBMediaRecorder.isTypeSupported(mimeType);
    });
};

/**
 * Return the current [state of QBMediaRecorder instance](https://w3c.github.io/mediacapture-record/MediaRecorder.html#idl-def-recordingstate).
 * Possibly states: **inactive**, **recording**, **paused**.
 * @return {String} Name of a state.
 *
 * @example
 * var recorder = new QBMediaRecorder();
 * // ...some code
 *
 * if(recorder.getState() == 'recording') {
 *     console.info('You are still recording.');
 * }
 */
QBMediaRecorder.prototype.getState = function() {
    return this._mediaRecorder ? this._mediaRecorder.state : QBMediaRecorder._STATES[0];
};


/**
 * Start to recording a stream.
 * Fire the method `stop` if an instance inprogress (has a state recording or paused).
 * Fire onstart callback.
 * @param {MediaStream} stream - Stream object representing a flux of audio- or video-related data.
 * @returns {void}
 *
 * @example
 * var options = {
 *     onstart: function onStart() {
 *         var time = 0,
 *             step = 1000;
 *
 *         setTimeout(function () {
 *             time += step;
 *             console.info(`You are recording ${time} sec.`);
 *         }, step);
 *     }
 * }
 *
 * var rec = new qbRecorder(options);
 * // ...
 * rec.start(stream);
 */
QBMediaRecorder.prototype.start = function(stream) {
    var self = this;

    if(!stream) {
        throw new Error(ERRORS.requreArgument);
    }

    var mediaRecorderState = this.getState();

    if(mediaRecorderState === QBMediaRecorder._STATES[1] || mediaRecorderState === QBMediaRecorder._STATES[2]) {
        this._mediaRecorder.stop();
    }

    if(this._stream) {
        this._stream = null;
    }
    // TODO: need to stream.clone
    self._stream = stream;
    self._mediaRecorder = null;
    self._recordedChunks.length = 0;

    if (self._customMimeType) {
        self._setCustomRecorder();
    } else {
        self._setMediaRecorder();
    }
    self._setEvents();
};

QBMediaRecorder.prototype._setMediaRecorder = function () {
    var self = this;

    try {
        self._mediaRecorder = new window.MediaRecorder(self._stream, {
            'mimeType': self.mimeType,
            'ignoreMutedMedia': self.ignoreMutedMedia
        });
    } catch(e) {
        console.warn(ERRORS.unsupportMediaRecorderWithOptions, e);

        self._mediaRecorder = new window.MediaRecorder(self._stream);
    }
};

QBMediaRecorder.prototype._setCustomRecorder = function() {
    var self = this;

    self._closeAudioProcess();

    self._mediaRecorder = {
        start: function() {
            try {
                this.state = QBMediaRecorder._STATES[1];
                self._startAudioProcess();
                this.onstart();
            } catch(error) {
                this.onerror(error);
            }
        },

        stop: function() {
            try {
                this.state = QBMediaRecorder._STATES[0];
                self._stopAudioProcess();
                this.onstop();
            } catch(error) {
                this.onerror(error);
            }
        },

        pause: function() {
            try {
                this.state = QBMediaRecorder._STATES[2];
                this.onpause();
            } catch(error) {
                this.onerror(error);
            }
        },

        resume: function() {
            try {
                this.state = QBMediaRecorder._STATES[1];
                this.onresume();
            } catch(error) {
                this.onerror(error);
            }
        },

        /* callbacks */
        onstart: function() {
            if (this.state !== 'recording') {
                this.state = QBMediaRecorder._STATES[1];
            }
        },

        onstop: function() {
            if (this.state !== 'inactive') {
                this.state = QBMediaRecorder._STATES[0];
            }
        },

        onpause: function() {
            if (this.state !== 'paused') {
                this.state = QBMediaRecorder._STATES[2];
            }
        },

        onresume: function() {
            if (this.state !== 'recording') {
                this.state = QBMediaRecorder._STATES[1];
            }
        },

        onerror: function() {
            try {
                self._closeAudioProcess();
            } catch(error) {
                throw new Error(error);
            }
        }
    };
};

QBMediaRecorder.prototype._fireCallback = function(name, args) {
    var self = this;

    if(Object.keys(self.callbacks).length !== 0 && typeof self.callbacks[name] === 'function') {
        try {
            self.callbacks[name](args);
        } catch(e) {
            console.error('Founded an error in callback:' + name, e);
        }
    }
};

QBMediaRecorder.prototype._setEvents = function() {
    var self = this;

    if (!self._customMimeType) {
        self._mediaRecorder.ondataavailable = function(e) {
            if(e.data && e.data.size > 0) {
                self._recordedChunks.push(e.data);
                self._fireCallback('ondataavailable', e);
            }
        };
    }

    self._mediaRecorder.onpause = function() {
        self._fireCallback('onpause');
    };

    self._mediaRecorder.onresume = function() {
        self._fireCallback('onresume');
    };

    self._mediaRecorder.onerror = function(error) {
        switch(error.name) {
            case 'InvalidState':
                console.error(ERRORS[error.name]);
                break;

            case 'OutOfMemory':
                console.error(ERRORS[error.name]);
                break;

            case 'IllegalStreamModification':
                console.error(ERRORS[error.name]);
                break;

            case 'OtherRecordingError':
                console.error(ERRORS[error.name]);
                break;

            case 'GenericError':
                console.error(ERRORS[error.name]);
                break;

            default:
                console.error('MediaRecorder Error', error);
                break;
        }

        if (self._mediaRecorder.state !== 'inactive') {
            self._mediaRecorder.stop();
        }

        if (self._userCallbacks && typeof self._userCallbacks.onErrorRecording === 'function') {
            self._fireCallback('onerror', error);
        }
    };

    self._mediaRecorder.onstop = function() {
        if (self._customMimeType) {
            self._stopAudioProcess();
        } else {
            self._createBlob(self._recordedChunks);
        }
    };

    self._mediaRecorder.start(self.timeslice);

    self._fireCallback('onstart');
};

/**
 * Stop to recording a stream.
 * @return {Blob} Blob of recorded chuncks.
 */
QBMediaRecorder.prototype.stop = function() {
    var mediaRecorder = this._mediaRecorder,
        mediaRecorderState = mediaRecorder && mediaRecorder.state ? mediaRecorder.state : 'inactive';

    if(mediaRecorder && (mediaRecorderState === 'recording' || mediaRecorderState === 'paused')){
        mediaRecorder.stop();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

/**
 * Pause to recording a stream.
 * @returns {void}
 */
QBMediaRecorder.prototype.pause = function() {
    var self = this;

    if(self._mediaRecorder && self._mediaRecorder.state === 'recording') {
        self._mediaRecorder.pause();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

/**
 * Resume to recording a stream.
 * @returns {void}
 */
QBMediaRecorder.prototype.resume = function() {
    var self = this;

    if(self._mediaRecorder && self._mediaRecorder.state === 'paused') {
        self._mediaRecorder.resume();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

/**
 * Change a recorded stream.
 * @param {MediaStream} stream - Stream object representing a flux of audio- or video-related data.
 * @returns {void}
 */
QBMediaRecorder.prototype.change = function(stream) {
    var self = this;

    if(!stream) {
        throw new Error(ERRORS.requreArgument);
    }

    self._keepRecording = true; // don't stop a record
    self.stop();

    self._stream = null;
    self._mediaRecorder = null;

    // TODO stream.clone
    self._stream = stream;

    if (self._customMimeType) {
        self._setCustomRecorder();
    } else {
        self._setMediaRecorder();
    }

    self._setEvents();
};

/**
 * Create a file from blob and download as the file. Its method will fire 'stop' if recording in progress.
 * @param {Strint} [fileName=Date.now()] - Name of file.
 * @param {Blob}   [blob] - You can set blob which you get from the method `stop` or don't set anything and we will get recorded chuncks.
 * @returns {void}
 *
 * @example
 * var rec = new qbRecorder();
 * rec.start(stream);
 * // ...
 * rec.download(false); // Set false, name will be generated based on Date.now()
 */
QBMediaRecorder.prototype.download = function(fileName, blob) {
    var self = this;

    var mediaRecorderState = this.getState();

    if(mediaRecorderState === QBMediaRecorder._STATES[1] || mediaRecorderState === QBMediaRecorder._STATES[2]) {
        this._mediaRecorder.stop();
    }

    var url = URL.createObjectURL(blob || self._getBlobRecorded()),
        a = document.createElement('a');

    a.style.display = 'none';
    a.href = url;
    a.download = (fileName || Date.now()) + '.' + self._getExtension();

    document.body.appendChild(a);

    // Start dowloading
    a.click();

    // Remove link
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
};

QBMediaRecorder.prototype._createBlob = function(chunks) {
    var self = this;

    var blob = new Blob(chunks, {
        'type' : self.mimeType
    });

    self.recordedBlobs.push(blob);

    if(!self._keepRecording) {
        if(self.recordedBlobs.length > 1) {
            self._fireCallback('onstop', blob);
        } else {
            self._fireCallback('onstop', self.recordedBlobs[0]);
        }
    }

    self._keepRecording = false;
}

/**
 * Create a Blob from recorded chunks.
 * @access private
 * @param {Object} [data] - Recorded data.
 * @return {Object} - Blob of recorded media or what you set in data
 */
QBMediaRecorder.prototype._getBlobRecorded = function(data) {
    var self = this,
        chunks = data || self._recordedChunks;

    if(!chunks.length) {
        console.warn(ERRORS.no_recorded_chunks);
        return false;
    }

    return new Blob(chunks, { 'type' : self.mimeType });
};

/**
 * Return a extension of a file. Based on available mimeType.
 * @access private
 * @return {String} For example, 'webm' / 'mp4' / 'ogg'
 */
QBMediaRecorder.prototype._getExtension = function() {
    var self = this;

    var endTypeMedia = self.mimeType.indexOf('/'),
        extension = self.mimeType.substring(endTypeMedia + 1),
        startCodecsInfo = extension.indexOf(';');

    if(startCodecsInfo !== -1) {
        extension = extension.substring(0, startCodecsInfo);
    }

    return extension;
};


QBMediaRecorder.prototype._startAudioProcess = function() {
    if(!QBMediaRecorder._isAudioContext()) {
        throw new Error(ERRORS.unsupport);
    }

    var self = this,
        audioContext,
        audioInput,
        recorder,
        volume;

    self._closeAudioProcess();

    audioContext = window.AudioContext || window.webkitAudioContext;
    self._audioContext = new audioContext;

    volume = self._audioContext.createGain();
    audioInput = self._audioContext.createMediaStreamSource(self._stream);
    recorder = self._audioContext.createScriptProcessor(self.BUFFER_SIZE, self.INPUT_CHANNELS, self.OUTPUT_CHANNELS);
    audioInput.connect(volume);

    self._postMessageToWorker({
        cmd: 'init',
        mimeType: self.mimeType,
        sampleRate: audioInput.context.sampleRate
    });

    recorder.onaudioprocess = function(e) {
        if (self._mediaRecorder.state === QBMediaRecorder._STATES[1]) {
            self._postMessageToWorker({
                cmd: 'record',
                bufferChunk: e.inputBuffer.getChannelData(0),
                bufferSize: self.BUFFER_SIZE
            });
        }
    };

    volume.connect(recorder);
    recorder.connect(self._audioContext.destination);
};

QBMediaRecorder.prototype._closeAudioProcess = function() {
    var self = this;

    if (self._audioContext) {
        self._audioContext.close()
            .then(function() {
                self._audioContext = null;
                self._postMessageToWorker({cmd: 'init', mimeType: ''});
            });
    }
};

QBMediaRecorder.prototype._stopAudioProcess = function() {
    this._postMessageToWorker({cmd: 'finish'});
};

QBMediaRecorder.prototype._postMessageToWorker = function(data) {
    if (QBMediaRecorder.isWorkerActive) {
        this.worker.postMessage(data);
    } else {
        throw new Error(ERRORS.unsupportCustomAudioRecorder);
    }
};

module.exports = QBMediaRecorder;
},{"./errors":1,"./mimeTypes":3}],3:[function(require,module,exports){
'use strict';

module.exports = {
    'audio': [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg',
        'audio/mp3',
        'audio/wav'
    ],
    'video': [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm;codecs=h264',
        'video/webm;codecs=opus',
        'video/webm',
        'video/mp4',
        'video/mpeg'
    ]
};
},{}]},{},[2])(2)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL21pbWVUeXBlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgICd1bnN1cHBvcnQnOiAnUUJNZWRpYVJlY29yZGVyIGlzIG5vdCBzdXBwb3J0ZWQgdGhpcyBlbnZpcm9ubWVudC4nLFxyXG4gICAgJ3Vuc3VwcG9ydEN1c3RvbU1pbWVUeXBlJzogJ0luY29ycmVjdCBhdWRpbyBtaW1lVHlwZS4nLFxyXG4gICAgJ3Vuc3VwcG9ydEN1c3RvbUF1ZGlvUmVjb3JkZXInOiAncWJBdWRpb1JlY29yZGVyV29ya2VyLmpzIHdhc25cXCd0IGZvdW5kLicsXHJcbiAgICAndW5zdXBwb3J0QXVkaW9Db250ZXh0JzogJ0F1ZGlvQ29udGV4dCBBUEkgaXMgbm90IHN1cHBvcnRlZCB0aGlzIGVudmlyb25tZW50LicsXHJcbiAgICAndW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zJzogJ0dvdCBhIHdhcm5pbmcgd2hlbiBjcmVhdGluZyBhIE1lZGlhUmVjb3JkZXIsIHRyeWluZyB0byBjcmVhdGUgTWVkaWFSZWNvcmRlciB3aXRob3V0IG9wdGlvbnMuJyxcclxuICAgICdyZXF1cmVBcmd1bWVudCc6ICcxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAwIHByZXNlbnQuJyxcclxuICAgICdjYWxsYmFja0Vycm9yJzogJ0ZvdW5kZWQgYW4gZXJyb3IgaW4gY2FsbGJhY2s6JyxcclxuICAgICdhY3Rpb25GYWlsZWQnOiAnUUJNZWRpYVJlY29yZGVyIGlzIG5vdCBjcmVhdGVkIG9yIGhhcyBhbiBpbnZhbGlkIHN0YXRlLicsXHJcbiAgICAnbm9fcmVjb3JkZWRfY2h1bmtzJzogJ0RvZXMgbm90IGhhdmUgYW55IHJlY29yZGluZyBkYXRhLicsXHJcbiAgICAnc3RyZWFtUmVxdWlyZWQnOiAnTWVkaWFTdHJlYW0gaXMgcmVxdWlyZWQuJyxcclxuICAgICdJbnZhbGlkU3RhdGUnOiAnUUJNZWRpYVJlY29yZGVyIGlzIG5vdCBpbiBhIHN0YXRlIGluIHdoaWNoIHRoZSBwcm9wb3NlZCBvcGVyYXRpb24gaXMgYWxsb3dlZCB0byBiZSBleGVjdXRlZC4nLFxyXG4gICAgJ091dE9mTWVtb3J5JzogJ1RoZSBVQSBoYXMgZXhoYXVzZWQgdGhlIGF2YWlsYWJsZSBtZW1vcnkuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJzogJ0EgbW9kaWZpY2F0aW9uIHRvIHRoZSBzdHJlYW0gaGFzIG9jY3VycmVkIHRoYXQgbWFrZXMgaXQgaW1wb3NzaWJsZSB0byBjb250aW51ZSByZWNvcmRpbmcuIEFuIGV4YW1wbGUgd291bGQgYmUgdGhlIGFkZGl0aW9uIG9mIGEgVHJhY2sgd2hpbGUgcmVjb3JkaW5nIGlzIG9jY3VycmluZy4gVXNlciBhZ2VudHMgU0hPVUxEIHByb3ZpZGUgYXMgbXVjaCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlIGluIHRoZSBtZXNzYWdlIGF0dHJpYnV0ZS4nLFxyXG4gICAgJ090aGVyUmVjb3JkaW5nRXJyb3InOiAnVXNlZCBmb3IgYW4gZmF0YWwgZXJyb3Igb3RoZXIgdGhhbiB0aG9zZSBsaXN0ZWQgYWJvdmUuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdHZW5lcmljRXJyb3InOiAnVGhlIFVBIGNhbm5vdCBwcm92aWRlIHRoZSBjb2RlYyBvciByZWNvcmRpbmcgb3B0aW9uIHRoYXQgaGFzIGJlZW4gcmVxdWVzdGVkJ1xyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBFUlJPUlMgPSByZXF1aXJlKCcuL2Vycm9ycycpO1xyXG5cclxuLyoqXHJcbiAqIEBjb25zdHJ1Y3RvciBRQk1lZGlhUmVjb3JkZXJcclxuICogQHBhcmFtIHtPYmplY3R9ICAgW29wdHNdIC0gT2JqZWN0IG9mIHBhcmFtZXRlcnMuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSAgIG9wdHNbXS5taW1lVHlwZT12aWRlbyAtIFNwZWNpZmllcyB0aGUgbWVkaWEgdHlwZSBhbmQgY29udGFpbmVyIGZvcm1hdCBmb3IgdGhlIHJlY29yZGluZy4gWW91IGNhbiBzZXQgc2ltcGx5OiAndmlkZW8nIG9yICdhdWRpbycgb3IgJ2F1ZGlvL3dlYm0nICgnYXVkaW8vd2F2JyBvciAnYXVkaW8vbXAzJyBtaW1lVHlwZXMgdXNlcyBBdWRpb0NvbnRleHQgQVBJIGluc3RlYWQgb2YgTWVkaWFSZWNvcmRlciBBUEkpO1xyXG4gKiBAcGFyYW0ge1N0cmluZ30gICBvcHRzW10ud29ya2VyUGF0aCAtIFJlbGF0aXZlIHBhdGggZnJvbSBpbmRleC5odG1sLlxyXG4gKiBAcGFyYW0ge051bWJlcn0gICBvcHRzW10udGltZXNsaWNlPTEwMDAgLSBUaGUgbWluaW11bSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIG9mIGRhdGEgdG8gcmV0dXJuIGluIGEgc2luZ2xlIEJsb2IsIGZpcmUgJ29uZGF0YWF2YWlibGUnIGNhbGxiYWNrIChpc24ndCBuZWVkIHRvIHVzZSB3aXRoICdhdWRpby93YXYnIG9mICdhdWRpby9tcDMnKS5cclxuICogQHBhcmFtIHtCb29sZWFufSAgb3B0c1tdLmlnbm9yZU11dGVkTWVkaWE9dHJ1ZSAtIFdoYXQgdG8gZG8gd2l0aCBhIG11dGVkIGlucHV0IE1lZGlhU3RyZWFtVHJhY2ssIGUuZy4gaW5zZXJ0IGJsYWNrIGZyYW1lcy96ZXJvIGF1ZGlvIHZvbHVtZSBpbiB0aGUgcmVjb3JkaW5nIG9yIGlnbm9yZSBhbHRvZ2V0aGVyLlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25zdGFydCAtIENhbGxlZCB0byBoYW5kbGUgdGhlIHN0YXJ0IGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25zdG9wIC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgc3RvcCBldmVudC5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0c1tdLm9ucGF1c2UgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBwYXVzZSBldmVudC5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0c1tdLm9ucmVzdW1lIC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgcmVzdW1lIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25lcnJvciAtIENhbGxlZCB0byBoYW5kbGUgYW4gRXJyb3JFdmVudC5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0c1tdLm9uY2hhbmdlIC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgY2hhbmdlIGEgc3RyZWFtIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25kYXRhYXZhaWxhYmxlIC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgZGF0YWF2YWlsYWJsZSBldmVudC4gVGhlIEJsb2Igb2YgcmVjb3JkZWQgZGF0YSBpcyBjb250YWluZWQgaW4gdGhpcyBldmVudCAoQ2FsbGJhY2sgaXNuJ3Qgc3VwcG9ydGVkIGlmIHVzZSAnYXVkaW8vd2F2JyBvZiAnYXVkaW8vbXAzJyBmb3IgcmVjb3JkaW5nKS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogdmFyIG9wdHMgPSB7XHJcbiAqICAgICBvbnN0YXJ0OiBmdW5jdGlvbiBvblN0YXJ0KCkgeyAvLyBVc2UgbmFtZWQgZnVuY3Rpb24uXHJcbiAqICAgICAgICAgY29uc29sZS5sb2coJ1JlY29yZGVyIGlzIHN0YXJ0ZWQnKTtcclxuICogICAgIH0sXHJcbiAqICAgICBvbnN0b3A6IGZ1bmN0aW9uIG9uU3RvcChCbG9iKSB7XHJcbiAqICAgICAgICAgdmlkZW9FbGVtZW50LnNyYyA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcbiAqICAgICB9LFxyXG4gKiAgICAgbWltZVR5cGU6ICd2aWRlby9tcDQnXHJcbiAqIH07XHJcbiAqXHJcbiAqIC8vIHVzZXMgYXMgZ2xvYmFsIHZhcmlhYmxlLCBRQk1lZGlhUmVjb3JkZXIgaXMgYnVpbHQgYXMgYSBVTUQgbW9kdWxlLlxyXG4gKiB2YXIgcmVjb3JkZXIgPSBuZXcgUUJNZWRpYVJlY29yZGVyKG9wdHMpO1xyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiAvLyBGb3IgcmVjb3JkICdhdWRpby9tcDMnIG9yICdhdWRpby93YXYnIG5lZWQgdG8gYWRkIHtAbGluayBodHRwczovL2dpdGh1Yi5jb20vUXVpY2tCbG94L2phdmFzY3JpcHQtbWVkaWEtcmVjb3JkZXIvYmxvYi9tYXN0ZXIvcWJBdWRpb1JlY29yZGVyV29ya2VyLmpzfCdxYkF1ZGlvUmVjb3JkZXJXb3JrZXIuanMnfSBmaWxlIHRvIHlvdXIgcHJvamVjdC5cclxuICogdmFyIG9wdHMgPSB7XHJcbiAqICAgICAvLyB1c2UgbmFtZWQgZnVuY3Rpb25cclxuICogICAgIG9uc3RhcnQ6IGZ1bmN0aW9uIG9uU3RhcnQoKSB7XHJcbiAqICAgICAgICAgY29uc29sZS5sb2coJ1JlY29yZGVyIGlzIHN0YXJ0ZWQnKTtcclxuICogICAgIH0sXHJcbiAqICAgICBvbnN0b3A6IGZ1bmN0aW9uIG9uU3RvcChCbG9iKSB7XHJcbiAqICAgICAgICAgdmlkZW9FbGVtZW50LnNyYyA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcbiAqICAgICB9LFxyXG4gKiAgICAgLy8gJ2F1ZGlvL3dhdicgb3IgJ2F1ZGlvL21wMydcclxuICogICAgIG1pbWVUeXBlOiAnYXVkaW8vbXAzJyxcclxuICogICAgIC8vIHNldCByZWxhdGl2ZSBwYXRoIChmcm9tIGZvbGRlciBub2RlX21vZHVsZXMgZm9yIGV4YW1wbGUpXHJcbiAqICAgICB3b3JrZXJQYXRoOiAnLi4vbm9kZV9tb2R1bGVzL2phdmFzY3JpcHQtbWVkaWEtcmVjb3JkZXIvcWJBdWRpb1JlY29yZGVyV29ya2VyLmpzJ1xyXG4gKiB9O1xyXG4gKlxyXG4gKiAvLyB1c2VzIGFzIGdsb2JhbCB2YXJpYWJsZSwgUUJNZWRpYVJlY29yZGVyIGlzIGJ1aWx0IGFzIGEgVU1EIG1vZHVsZS5cclxuICogdmFyIHJlY29yZGVyID0gbmV3IFFCTWVkaWFSZWNvcmRlcihvcHRzKTtcclxuICovXHJcbmZ1bmN0aW9uIFFCTWVkaWFSZWNvcmRlcihvcHRzKSB7XHJcbiAgICB2YXIgcHJlZmZlcmVkTWltZVR5cGUgPSBvcHRzICYmIG9wdHMubWltZVR5cGUgPyBvcHRzLm1pbWVUeXBlIDogZmFsc2U7XHJcbiAgICB0aGlzLl9jdXN0b21NaW1lVHlwZSA9IChwcmVmZmVyZWRNaW1lVHlwZSA9PT0gJ2F1ZGlvL3dhdicpID8gJ2F1ZGlvL3dhdicgOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAocHJlZmZlcmVkTWltZVR5cGUgPT09ICdhdWRpby9tcDMnKSA/ICdhdWRpby9tcDMnIDogZmFsc2U7XHJcblxyXG4gICAgaWYgKG9wdHMud29ya2VyUGF0aCkge1xyXG4gICAgICAgIGlmICh0aGlzLl9jdXN0b21NaW1lVHlwZSkge1xyXG4gICAgICAgICAgICB0aGlzLl9zZXRDdXN0b21SZWNvcmRlclRvb2xzKG9wdHMud29ya2VyUGF0aCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnRDdXN0b21NaW1lVHlwZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmKCFRQk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSAmJiAhdGhpcy5fY3VzdG9tTWltZVR5cGUpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5taW1lVHlwZSA9IHRoaXMuX2dldE1pbWVUeXBlKHByZWZmZXJlZE1pbWVUeXBlKTtcclxuICAgIHRoaXMudGltZXNsaWNlID0gb3B0cyAmJiBvcHRzLnRpbWVzbGljZSAmJiBpc05hTigrb3B0cy50aW1lc2xpY2UpID8gb3B0cy50aW1lc2xpY2UgOiAxMDAwO1xyXG4gICAgdGhpcy5jYWxsYmFja3MgPSBvcHRzID8gdGhpcy5fZ2V0Q2FsbGJhY2tzKG9wdHMpIDoge307XHJcbiAgICB0aGlzLnJlY29yZGVkQmxvYnMgPSBbXTtcclxuICAgIHRoaXMuaWdub3JlTXV0ZWRNZWRpYSA9IG9wdHMgJiYgdHlwZW9mKG9wdHMuaWdub3JlTXV0ZWRNZWRpYSkgPT09ICdib29sZWFuJyA/IG9wdHMuaWdub3JlTXV0ZWRNZWRpYSA6IHRydWU7XHJcblxyXG4gICAgdGhpcy5fc3RyZWFtID0gbnVsbDtcclxuICAgIHRoaXMuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG4gICAgdGhpcy5fcmVjb3JkZWRDaHVua3MgPSBbXTtcclxuICAgIHRoaXMuX2tlZXBSZWNvcmRpbmcgPSBmYWxzZTtcclxufVxyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fc2V0Q3VzdG9tUmVjb3JkZXJUb29scyA9IGZ1bmN0aW9uICh3b3JrZXJQYXRoKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgLy8gaW5pdCB3b3JrZXIgZm9yIGN1c3RvbSBhdWRpbyB0eXBlcyAoYXVkaW8vd2F2LCBhdWRpby9tcDMpXHJcbiAgICBzZWxmLndvcmtlciA9IG5ldyBXb3JrZXIod29ya2VyUGF0aCk7XHJcblxyXG4gICAgUUJNZWRpYVJlY29yZGVyLmlzV29ya2VyQWN0aXZlID0gISFzZWxmLndvcmtlcjtcclxuXHJcbiAgICBzZWxmLl9wb3N0TWVzc2FnZVRvV29ya2VyKHtcclxuICAgICAgICBjbWQ6ICdpbml0JyxcclxuICAgICAgICBtaW1lVHlwZTogc2VsZi5taW1lVHlwZVxyXG4gICAgfSk7XHJcblxyXG4gICAgc2VsZi53b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICBzZWxmLl9jcmVhdGVCbG9iKGV2ZW50LmRhdGEpO1xyXG4gICAgICAgIHNlbGYuX2Nsb3NlQXVkaW9Qcm9jZXNzKCk7XHJcbiAgICB9O1xyXG5cclxuICAgIGlmICghUUJNZWRpYVJlY29yZGVyLl9pc0F1ZGlvQ29udGV4dCgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnRBdWRpb0NvbnRleHQpO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYubWltZVR5cGUgPSBzZWxmLl9jdXN0b21NaW1lVHlwZTtcclxuICAgIC8qXHJcbiAgICAqIGNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XHJcbiAgICAqIGNvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKGJ1ZmZlclNpemUsIG51bWJlck9mSW5wdXRDaGFubmVscywgbnVtYmVyT2ZPdXRwdXRDaGFubmVscyk7XHJcbiAgICAqXHJcbiAgICAqIGxpbms6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL3J1L2RvY3MvV2ViL0FQSS9BdWRpb0NvbnRleHQvY3JlYXRlU2NyaXB0UHJvY2Vzc29yXHJcbiAgICAqL1xyXG4gICAgc2VsZi5CVUZGRVJfU0laRSA9IDIwNDg7IC8vIHRoZSBidWZmZXIgc2l6ZSBpbiB1bml0cyBvZiBzYW1wbGUtZnJhbWVzLlxyXG4gICAgc2VsZi5JTlBVVF9DSEFOTkVMUyA9IDE7IC8vIHRoZSBudW1iZXIgb2YgY2hhbm5lbHMgZm9yIHRoaXMgbm9kZSdzIGlucHV0LCBkZWZhdWx0cyB0byAyXHJcbiAgICBzZWxmLk9VVFBVVF9DSEFOTkVMUyA9IDE7IC8vIHRoZSBudW1iZXIgb2YgY2hhbm5lbHMgZm9yIHRoaXMgbm9kZSdzIG91dHB1dCwgZGVmYXVsdHMgdG8gMlxyXG4gICAgc2VsZi5fYXVkaW9Db250ZXh0ID0gbnVsbDtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldE1pbWVUeXBlID0gZnVuY3Rpb24gKHByZWZmZXJlZCkge1xyXG4gICAgdmFyIG1pbWVUeXBlLFxyXG4gICAgICAgIHR5cGUgPSAndmlkZW8nO1xyXG5cclxuICAgIGlmKHByZWZmZXJlZCAmJiBRQk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKHByZWZmZXJlZCkpIHtcclxuICAgICAgICBtaW1lVHlwZSA9IHByZWZmZXJlZDtcclxuICAgIH0gZWxzZSBpZihwcmVmZmVyZWQpIHtcclxuICAgICAgICB0eXBlID0gcHJlZmZlcmVkLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhdWRpbycpID09PSAtMSA/ICd2aWRlbycgOiAnYXVkaW8nO1xyXG4gICAgICAgIG1pbWVUeXBlID0gUUJNZWRpYVJlY29yZGVyLmdldFN1cHBvcnRlZE1pbWVUeXBlcyh0eXBlKVswXTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbWltZVR5cGUgPSBRQk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzKHR5cGUpWzBdO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBtaW1lVHlwZTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldENhbGxiYWNrcyA9IGZ1bmN0aW9uKG9wdHMpIHtcclxuICAgIHZhciBjYWxsYmFja3MgPSB7fSxcclxuICAgICAgICBjYWxsYmFja05hbWVzID0gWydvbnN0YXJ0JywgJ29uc3RvcCcsICdvbnBhdXNlJywgJ29ucmVzdW1lJywgJ29uZXJyb3InLCAnb25jaGFuZ2UnLCAnb25kYXRhYXZhaWxhYmxlJ107XHJcblxyXG4gICAgY2FsbGJhY2tOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcclxuICAgICAgICBpZiAobmFtZSBpbiBvcHRzKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrc1tuYW1lXSA9IG9wdHNbbmFtZV07XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIGNhbGxiYWNrcztcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5fbWltZVR5cGVzID0gcmVxdWlyZSgnLi9taW1lVHlwZXMnKTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5fU1RBVEVTID0gWydpbmFjdGl2ZScsICdyZWNvcmRpbmcnLCAncGF1c2VkJ107XHJcblxyXG4vKipcclxuICogSXQgY2hlY2tzIGNhcGFiaWxpdHkgb2YgcmVjb3JkaW5nIGluIHRoZSBlbnZpcm9ubWVudC5cclxuICogQ2hlY2tzIE1lZGlhUmVjb3JkZXIsIE1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkIGFuZCBCbG9iLlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIFFCTWVkaWFSZWNvcmRlciBpcyBhdmFpbGFibGUgYW5kIGNhbiBydW4sIG9yIGZhbHNlIG90aGVyd2lzZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogaWYoUUJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICogICAgIC8vIC4uLiBzaG93IFVJIGZvciByZWNvcmRpbmdcclxuICogfVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gISEod2luZG93ICYmIHdpbmRvdy5NZWRpYVJlY29yZGVyICYmIHR5cGVvZiB3aW5kb3cuTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQgPT09ICdmdW5jdGlvbicgJiYgd2luZG93LkJsb2IpO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLl9pc0F1ZGlvQ29udGV4dCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiAhISh3aW5kb3cgJiYgKHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCkpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgYSBCb29sZWFuIHdoaWNoIGlzIHRydWUgaWYgdGhlIE1JTUUgdHlwZSBzcGVjaWZpZWQgaXMgb25lIHRoZSB1c2VyIGFnZW50IGNhbiByZWNvcmQuXHJcbiAqIEBwYXJhbSAge1N0cmluZ30gbWltZVR5cGUgLSBUaGUgbWltZVR5cGUgdG8gY2hlY2suXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgICAgLSBUcnVlIGlmIHRoZSBNZWRpYVJlY29yZGVyIGltcGxlbWVudGF0aW9uIGlzIGNhcGFibGUgb2YgcmVjb3JkaW5nIEJsb2Igb2JqZWN0cyBmb3IgdGhlIHNwZWNpZmllZCBNSU1FIHR5cGUuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGlmKCBRQk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQnKSApIHtcclxuICogICAgIGVsLnRleHRDb250ZW50ID0gJ1dpbGwgYmUgcmVjb3JkIGluIHZpZGVvL21wNCc7XHJcbiAqIH1cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQgPSBmdW5jdGlvbihtaW1lVHlwZSkge1xyXG4gICAgdmFyIHJlc3VsdCA9IGZhbHNlO1xyXG5cclxuICAgIGlmKCFRQk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICBpZighbWltZVR5cGUpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnJlcXVyZUFyZ3VtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICBzd2l0Y2gobWltZVR5cGUpIHtcclxuICAgICAgICBjYXNlICdhdWRpby93YXYnOlxyXG4gICAgICAgICAgICBpZiAoUUJNZWRpYVJlY29yZGVyLl9pc0F1ZGlvQ29udGV4dCgpKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICBjYXNlICdhdWRpby9tcDMnOlxyXG4gICAgICAgICAgICBpZiAoUUJNZWRpYVJlY29yZGVyLl9pc0F1ZGlvQ29udGV4dCgpKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICByZXN1bHQgPSB3aW5kb3cuTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQobWltZVR5cGUpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBhbGwgc3VwcG9ydGVkIG1pbWUgdHlwZXMgYW5kIGNvbnRhaW5lciBmb3JtYXQuXHJcbiAqIEBwYXJhbSAge1N0cmluZ30gW3R5cGU9dmlkZW9dIFR5cGUgb2YgbWVkaWEuXHJcbiAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgICAgICAgIEFycmF5IG9mIHN1cHBvcnRlZCBtaW1ldHlwZXMuIFJlY29tbWVuZGVkIG1pbWV0eXBlIGhhcyAwIGluZGV4LlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgdHlwZSA9IFFCTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXMoJ2F1ZGlvJyk7XHJcbiAqIGNvbnNvbGUuaW5mbyhgQ2FsbCB3aWxsIHJlY29yZGluZyBpbiAke3R5cGVbMF19YCk7XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzID0gZnVuY3Rpb24odHlwZSkge1xyXG4gICAgdmFyIHR5cGVNZWRpYSA9IHR5cGUgfHwgJ3ZpZGVvJztcclxuXHJcbiAgICBpZiAoIVFCTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBRQk1lZGlhUmVjb3JkZXIuX21pbWVUeXBlc1t0eXBlTWVkaWFdLmZpbHRlcihmdW5jdGlvbihtaW1lVHlwZSkge1xyXG4gICAgICAgIHJldHVybiBRQk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKG1pbWVUeXBlKTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiB0aGUgY3VycmVudCBbc3RhdGUgb2YgUUJNZWRpYVJlY29yZGVyIGluc3RhbmNlXShodHRwczovL3czYy5naXRodWIuaW8vbWVkaWFjYXB0dXJlLXJlY29yZC9NZWRpYVJlY29yZGVyLmh0bWwjaWRsLWRlZi1yZWNvcmRpbmdzdGF0ZSkuXHJcbiAqIFBvc3NpYmx5IHN0YXRlczogKippbmFjdGl2ZSoqLCAqKnJlY29yZGluZyoqLCAqKnBhdXNlZCoqLlxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IE5hbWUgb2YgYSBzdGF0ZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogdmFyIHJlY29yZGVyID0gbmV3IFFCTWVkaWFSZWNvcmRlcigpO1xyXG4gKiAvLyAuLi5zb21lIGNvZGVcclxuICpcclxuICogaWYocmVjb3JkZXIuZ2V0U3RhdGUoKSA9PSAncmVjb3JkaW5nJykge1xyXG4gKiAgICAgY29uc29sZS5pbmZvKCdZb3UgYXJlIHN0aWxsIHJlY29yZGluZy4nKTtcclxuICogfVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5nZXRTdGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuX21lZGlhUmVjb3JkZXIgPyB0aGlzLl9tZWRpYVJlY29yZGVyLnN0YXRlIDogUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMF07XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIFN0YXJ0IHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogRmlyZSB0aGUgbWV0aG9kIGBzdG9wYCBpZiBhbiBpbnN0YW5jZSBpbnByb2dyZXNzIChoYXMgYSBzdGF0ZSByZWNvcmRpbmcgb3IgcGF1c2VkKS5cclxuICogRmlyZSBvbnN0YXJ0IGNhbGxiYWNrLlxyXG4gKiBAcGFyYW0ge01lZGlhU3RyZWFtfSBzdHJlYW0gLSBTdHJlYW0gb2JqZWN0IHJlcHJlc2VudGluZyBhIGZsdXggb2YgYXVkaW8tIG9yIHZpZGVvLXJlbGF0ZWQgZGF0YS5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciBvcHRpb25zID0ge1xyXG4gKiAgICAgb25zdGFydDogZnVuY3Rpb24gb25TdGFydCgpIHtcclxuICogICAgICAgICB2YXIgdGltZSA9IDAsXHJcbiAqICAgICAgICAgICAgIHN0ZXAgPSAxMDAwO1xyXG4gKlxyXG4gKiAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gKiAgICAgICAgICAgICB0aW1lICs9IHN0ZXA7XHJcbiAqICAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhgWW91IGFyZSByZWNvcmRpbmcgJHt0aW1lfSBzZWMuYCk7XHJcbiAqICAgICAgICAgfSwgc3RlcCk7XHJcbiAqICAgICB9XHJcbiAqIH1cclxuICpcclxuICogdmFyIHJlYyA9IG5ldyBxYlJlY29yZGVyKG9wdGlvbnMpO1xyXG4gKiAvLyAuLi5cclxuICogcmVjLnN0YXJ0KHN0cmVhbSk7XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oc3RyZWFtKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoIXN0cmVhbSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMucmVxdXJlQXJndW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBtZWRpYVJlY29yZGVyU3RhdGUgPSB0aGlzLmdldFN0YXRlKCk7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlclN0YXRlID09PSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXSB8fCBtZWRpYVJlY29yZGVyU3RhdGUgPT09IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzJdKSB7XHJcbiAgICAgICAgdGhpcy5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYodGhpcy5fc3RyZWFtKSB7XHJcbiAgICAgICAgdGhpcy5fc3RyZWFtID0gbnVsbDtcclxuICAgIH1cclxuICAgIC8vIFRPRE86IG5lZWQgdG8gc3RyZWFtLmNsb25lXHJcbiAgICBzZWxmLl9zdHJlYW0gPSBzdHJlYW07XHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuICAgIHNlbGYuX3JlY29yZGVkQ2h1bmtzLmxlbmd0aCA9IDA7XHJcblxyXG4gICAgaWYgKHNlbGYuX2N1c3RvbU1pbWVUeXBlKSB7XHJcbiAgICAgICAgc2VsZi5fc2V0Q3VzdG9tUmVjb3JkZXIoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2VsZi5fc2V0TWVkaWFSZWNvcmRlcigpO1xyXG4gICAgfVxyXG4gICAgc2VsZi5fc2V0RXZlbnRzKCk7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9zZXRNZWRpYVJlY29yZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyB3aW5kb3cuTWVkaWFSZWNvcmRlcihzZWxmLl9zdHJlYW0sIHtcclxuICAgICAgICAgICAgJ21pbWVUeXBlJzogc2VsZi5taW1lVHlwZSxcclxuICAgICAgICAgICAgJ2lnbm9yZU11dGVkTWVkaWEnOiBzZWxmLmlnbm9yZU11dGVkTWVkaWFcclxuICAgICAgICB9KTtcclxuICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMudW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zLCBlKTtcclxuXHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyB3aW5kb3cuTWVkaWFSZWNvcmRlcihzZWxmLl9zdHJlYW0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fc2V0Q3VzdG9tUmVjb3JkZXIgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBzZWxmLl9jbG9zZUF1ZGlvUHJvY2VzcygpO1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSB7XHJcbiAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzFdO1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fc3RhcnRBdWRpb1Byb2Nlc3MoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMub25zdGFydCgpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgc3RvcDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMF07XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9zdG9wQXVkaW9Qcm9jZXNzKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uc3RvcCgpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgcGF1c2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzJdO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vbnBhdXNlKCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMub25lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICByZXN1bWU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzFdO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vbnJlc3VtZSgpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyogY2FsbGJhY2tzICovXHJcbiAgICAgICAgb25zdGFydDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnN0YXRlICE9PSAncmVjb3JkaW5nJykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzFdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgb25zdG9wOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGUgIT09ICdpbmFjdGl2ZScpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1swXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIG9ucGF1c2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zdGF0ZSAhPT0gJ3BhdXNlZCcpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1syXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIG9ucmVzdW1lOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGUgIT09ICdyZWNvcmRpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBvbmVycm9yOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHNlbGYuX2Nsb3NlQXVkaW9Qcm9jZXNzKCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZmlyZUNhbGxiYWNrID0gZnVuY3Rpb24obmFtZSwgYXJncykge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmKE9iamVjdC5rZXlzKHNlbGYuY2FsbGJhY2tzKS5sZW5ndGggIT09IDAgJiYgdHlwZW9mIHNlbGYuY2FsbGJhY2tzW25hbWVdID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgc2VsZi5jYWxsYmFja3NbbmFtZV0oYXJncyk7XHJcbiAgICAgICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZvdW5kZWQgYW4gZXJyb3IgaW4gY2FsbGJhY2s6JyArIG5hbWUsIGUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3NldEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmICghc2VsZi5fY3VzdG9tTWltZVR5cGUpIHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgaWYoZS5kYXRhICYmIGUuZGF0YS5zaXplID4gMCkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fcmVjb3JkZWRDaHVua3MucHVzaChlLmRhdGEpO1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fZmlyZUNhbGxiYWNrKCdvbmRhdGFhdmFpbGFibGUnLCBlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnBhdXNlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgc2VsZi5fZmlyZUNhbGxiYWNrKCdvbnBhdXNlJyk7XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25yZXN1bWUgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBzZWxmLl9maXJlQ2FsbGJhY2soJ29ucmVzdW1lJyk7XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25lcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XHJcbiAgICAgICAgc3dpdGNoKGVycm9yLm5hbWUpIHtcclxuICAgICAgICAgICAgY2FzZSAnSW52YWxpZFN0YXRlJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnT3V0T2ZNZW1vcnknOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnT3RoZXJSZWNvcmRpbmdFcnJvcic6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ0dlbmVyaWNFcnJvcic6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdNZWRpYVJlY29yZGVyIEVycm9yJywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSAhPT0gJ2luYWN0aXZlJykge1xyXG4gICAgICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChzZWxmLl91c2VyQ2FsbGJhY2tzICYmIHR5cGVvZiBzZWxmLl91c2VyQ2FsbGJhY2tzLm9uRXJyb3JSZWNvcmRpbmcgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgc2VsZi5fZmlyZUNhbGxiYWNrKCdvbmVycm9yJywgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBpZiAoc2VsZi5fY3VzdG9tTWltZVR5cGUpIHtcclxuICAgICAgICAgICAgc2VsZi5fc3RvcEF1ZGlvUHJvY2VzcygpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHNlbGYuX2NyZWF0ZUJsb2Ioc2VsZi5fcmVjb3JkZWRDaHVua3MpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGFydChzZWxmLnRpbWVzbGljZSk7XHJcblxyXG4gICAgc2VsZi5fZmlyZUNhbGxiYWNrKCdvbnN0YXJ0Jyk7XHJcbn07XHJcblxyXG4vKipcclxuICogU3RvcCB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm4ge0Jsb2J9IEJsb2Igb2YgcmVjb3JkZWQgY2h1bmNrcy5cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXIgPSB0aGlzLl9tZWRpYVJlY29yZGVyLFxyXG4gICAgICAgIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlci5zdGF0ZSA/IG1lZGlhUmVjb3JkZXIuc3RhdGUgOiAnaW5hY3RpdmUnO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXIgJiYgKG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gJ3JlY29yZGluZycgfHwgbWVkaWFSZWNvcmRlclN0YXRlID09PSAncGF1c2VkJykpe1xyXG4gICAgICAgIG1lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLmFjdGlvbkZhaWxlZCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogUGF1c2UgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZihzZWxmLl9tZWRpYVJlY29yZGVyICYmIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgPT09ICdyZWNvcmRpbmcnKSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5wYXVzZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLmFjdGlvbkZhaWxlZCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogUmVzdW1lIHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIgJiYgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSA9PT0gJ3BhdXNlZCcpIHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnJlc3VtZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLmFjdGlvbkZhaWxlZCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogQ2hhbmdlIGEgcmVjb3JkZWQgc3RyZWFtLlxyXG4gKiBAcGFyYW0ge01lZGlhU3RyZWFtfSBzdHJlYW0gLSBTdHJlYW0gb2JqZWN0IHJlcHJlc2VudGluZyBhIGZsdXggb2YgYXVkaW8tIG9yIHZpZGVvLXJlbGF0ZWQgZGF0YS5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLmNoYW5nZSA9IGZ1bmN0aW9uKHN0cmVhbSkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmKCFzdHJlYW0pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnJlcXVyZUFyZ3VtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICBzZWxmLl9rZWVwUmVjb3JkaW5nID0gdHJ1ZTsgLy8gZG9uJ3Qgc3RvcCBhIHJlY29yZFxyXG4gICAgc2VsZi5zdG9wKCk7XHJcblxyXG4gICAgc2VsZi5fc3RyZWFtID0gbnVsbDtcclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG5cclxuICAgIC8vIFRPRE8gc3RyZWFtLmNsb25lXHJcbiAgICBzZWxmLl9zdHJlYW0gPSBzdHJlYW07XHJcblxyXG4gICAgaWYgKHNlbGYuX2N1c3RvbU1pbWVUeXBlKSB7XHJcbiAgICAgICAgc2VsZi5fc2V0Q3VzdG9tUmVjb3JkZXIoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2VsZi5fc2V0TWVkaWFSZWNvcmRlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX3NldEV2ZW50cygpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIGZpbGUgZnJvbSBibG9iIGFuZCBkb3dubG9hZCBhcyB0aGUgZmlsZS4gSXRzIG1ldGhvZCB3aWxsIGZpcmUgJ3N0b3AnIGlmIHJlY29yZGluZyBpbiBwcm9ncmVzcy5cclxuICogQHBhcmFtIHtTdHJpbnR9IFtmaWxlTmFtZT1EYXRlLm5vdygpXSAtIE5hbWUgb2YgZmlsZS5cclxuICogQHBhcmFtIHtCbG9ifSAgIFtibG9iXSAtIFlvdSBjYW4gc2V0IGJsb2Igd2hpY2ggeW91IGdldCBmcm9tIHRoZSBtZXRob2QgYHN0b3BgIG9yIGRvbid0IHNldCBhbnl0aGluZyBhbmQgd2Ugd2lsbCBnZXQgcmVjb3JkZWQgY2h1bmNrcy5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciByZWMgPSBuZXcgcWJSZWNvcmRlcigpO1xyXG4gKiByZWMuc3RhcnQoc3RyZWFtKTtcclxuICogLy8gLi4uXHJcbiAqIHJlYy5kb3dubG9hZChmYWxzZSk7IC8vIFNldCBmYWxzZSwgbmFtZSB3aWxsIGJlIGdlbmVyYXRlZCBiYXNlZCBvbiBEYXRlLm5vdygpXHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLmRvd25sb2FkID0gZnVuY3Rpb24oZmlsZU5hbWUsIGJsb2IpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICB2YXIgbWVkaWFSZWNvcmRlclN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMV0gfHwgbWVkaWFSZWNvcmRlclN0YXRlID09PSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1syXSkge1xyXG4gICAgICAgIHRoaXMuX21lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IgfHwgc2VsZi5fZ2V0QmxvYlJlY29yZGVkKCkpLFxyXG4gICAgICAgIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcblxyXG4gICAgYS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgYS5ocmVmID0gdXJsO1xyXG4gICAgYS5kb3dubG9hZCA9IChmaWxlTmFtZSB8fCBEYXRlLm5vdygpKSArICcuJyArIHNlbGYuX2dldEV4dGVuc2lvbigpO1xyXG5cclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcblxyXG4gICAgLy8gU3RhcnQgZG93bG9hZGluZ1xyXG4gICAgYS5jbGljaygpO1xyXG5cclxuICAgIC8vIFJlbW92ZSBsaW5rXHJcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoYSk7XHJcbiAgICAgICAgd2luZG93LlVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcclxuICAgIH0sIDEwMCk7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9jcmVhdGVCbG9iID0gZnVuY3Rpb24oY2h1bmtzKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIGJsb2IgPSBuZXcgQmxvYihjaHVua3MsIHtcclxuICAgICAgICAndHlwZScgOiBzZWxmLm1pbWVUeXBlXHJcbiAgICB9KTtcclxuXHJcbiAgICBzZWxmLnJlY29yZGVkQmxvYnMucHVzaChibG9iKTtcclxuXHJcbiAgICBpZighc2VsZi5fa2VlcFJlY29yZGluZykge1xyXG4gICAgICAgIGlmKHNlbGYucmVjb3JkZWRCbG9icy5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgIHNlbGYuX2ZpcmVDYWxsYmFjaygnb25zdG9wJywgYmxvYik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgc2VsZi5fZmlyZUNhbGxiYWNrKCdvbnN0b3AnLCBzZWxmLnJlY29yZGVkQmxvYnNbMF0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzZWxmLl9rZWVwUmVjb3JkaW5nID0gZmFsc2U7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYSBCbG9iIGZyb20gcmVjb3JkZWQgY2h1bmtzLlxyXG4gKiBAYWNjZXNzIHByaXZhdGVcclxuICogQHBhcmFtIHtPYmplY3R9IFtkYXRhXSAtIFJlY29yZGVkIGRhdGEuXHJcbiAqIEByZXR1cm4ge09iamVjdH0gLSBCbG9iIG9mIHJlY29yZGVkIG1lZGlhIG9yIHdoYXQgeW91IHNldCBpbiBkYXRhXHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRCbG9iUmVjb3JkZWQgPSBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgY2h1bmtzID0gZGF0YSB8fCBzZWxmLl9yZWNvcmRlZENodW5rcztcclxuXHJcbiAgICBpZighY2h1bmtzLmxlbmd0aCkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMubm9fcmVjb3JkZWRfY2h1bmtzKTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG5ldyBCbG9iKGNodW5rcywgeyAndHlwZScgOiBzZWxmLm1pbWVUeXBlIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBhIGV4dGVuc2lvbiBvZiBhIGZpbGUuIEJhc2VkIG9uIGF2YWlsYWJsZSBtaW1lVHlwZS5cclxuICogQGFjY2VzcyBwcml2YXRlXHJcbiAqIEByZXR1cm4ge1N0cmluZ30gRm9yIGV4YW1wbGUsICd3ZWJtJyAvICdtcDQnIC8gJ29nZydcclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldEV4dGVuc2lvbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHZhciBlbmRUeXBlTWVkaWEgPSBzZWxmLm1pbWVUeXBlLmluZGV4T2YoJy8nKSxcclxuICAgICAgICBleHRlbnNpb24gPSBzZWxmLm1pbWVUeXBlLnN1YnN0cmluZyhlbmRUeXBlTWVkaWEgKyAxKSxcclxuICAgICAgICBzdGFydENvZGVjc0luZm8gPSBleHRlbnNpb24uaW5kZXhPZignOycpO1xyXG5cclxuICAgIGlmKHN0YXJ0Q29kZWNzSW5mbyAhPT0gLTEpIHtcclxuICAgICAgICBleHRlbnNpb24gPSBleHRlbnNpb24uc3Vic3RyaW5nKDAsIHN0YXJ0Q29kZWNzSW5mbyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGV4dGVuc2lvbjtcclxufTtcclxuXHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9zdGFydEF1ZGlvUHJvY2VzcyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgaWYoIVFCTWVkaWFSZWNvcmRlci5faXNBdWRpb0NvbnRleHQoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgYXVkaW9Db250ZXh0LFxyXG4gICAgICAgIGF1ZGlvSW5wdXQsXHJcbiAgICAgICAgcmVjb3JkZXIsXHJcbiAgICAgICAgdm9sdW1lO1xyXG5cclxuICAgIHNlbGYuX2Nsb3NlQXVkaW9Qcm9jZXNzKCk7XHJcblxyXG4gICAgYXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xyXG4gICAgc2VsZi5fYXVkaW9Db250ZXh0ID0gbmV3IGF1ZGlvQ29udGV4dDtcclxuXHJcbiAgICB2b2x1bWUgPSBzZWxmLl9hdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xyXG4gICAgYXVkaW9JbnB1dCA9IHNlbGYuX2F1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzZWxmLl9zdHJlYW0pO1xyXG4gICAgcmVjb3JkZXIgPSBzZWxmLl9hdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKHNlbGYuQlVGRkVSX1NJWkUsIHNlbGYuSU5QVVRfQ0hBTk5FTFMsIHNlbGYuT1VUUFVUX0NIQU5ORUxTKTtcclxuICAgIGF1ZGlvSW5wdXQuY29ubmVjdCh2b2x1bWUpO1xyXG5cclxuICAgIHNlbGYuX3Bvc3RNZXNzYWdlVG9Xb3JrZXIoe1xyXG4gICAgICAgIGNtZDogJ2luaXQnLFxyXG4gICAgICAgIG1pbWVUeXBlOiBzZWxmLm1pbWVUeXBlLFxyXG4gICAgICAgIHNhbXBsZVJhdGU6IGF1ZGlvSW5wdXQuY29udGV4dC5zYW1wbGVSYXRlXHJcbiAgICB9KTtcclxuXHJcbiAgICByZWNvcmRlci5vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSA9PT0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMV0pIHtcclxuICAgICAgICAgICAgc2VsZi5fcG9zdE1lc3NhZ2VUb1dvcmtlcih7XHJcbiAgICAgICAgICAgICAgICBjbWQ6ICdyZWNvcmQnLFxyXG4gICAgICAgICAgICAgICAgYnVmZmVyQ2h1bms6IGUuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCksXHJcbiAgICAgICAgICAgICAgICBidWZmZXJTaXplOiBzZWxmLkJVRkZFUl9TSVpFXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdm9sdW1lLmNvbm5lY3QocmVjb3JkZXIpO1xyXG4gICAgcmVjb3JkZXIuY29ubmVjdChzZWxmLl9hdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fY2xvc2VBdWRpb1Byb2Nlc3MgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZiAoc2VsZi5fYXVkaW9Db250ZXh0KSB7XHJcbiAgICAgICAgc2VsZi5fYXVkaW9Db250ZXh0LmNsb3NlKClcclxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9hdWRpb0NvbnRleHQgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fcG9zdE1lc3NhZ2VUb1dvcmtlcih7Y21kOiAnaW5pdCcsIG1pbWVUeXBlOiAnJ30pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH1cclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3N0b3BBdWRpb1Byb2Nlc3MgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuX3Bvc3RNZXNzYWdlVG9Xb3JrZXIoe2NtZDogJ2ZpbmlzaCd9KTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3Bvc3RNZXNzYWdlVG9Xb3JrZXIgPSBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICBpZiAoUUJNZWRpYVJlY29yZGVyLmlzV29ya2VyQWN0aXZlKSB7XHJcbiAgICAgICAgdGhpcy53b3JrZXIucG9zdE1lc3NhZ2UoZGF0YSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0Q3VzdG9tQXVkaW9SZWNvcmRlcik7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFFCTWVkaWFSZWNvcmRlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgICdhdWRpbyc6IFtcclxuICAgICAgICAnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycsXHJcbiAgICAgICAgJ2F1ZGlvL3dlYm0nLFxyXG4gICAgICAgICdhdWRpby9vZ2cnLFxyXG4gICAgICAgICdhdWRpby9tcDMnLFxyXG4gICAgICAgICdhdWRpby93YXYnXHJcbiAgICBdLFxyXG4gICAgJ3ZpZGVvJzogW1xyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDknLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDgnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1oMjY0JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9b3B1cycsXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm0nLFxyXG4gICAgICAgICd2aWRlby9tcDQnLFxyXG4gICAgICAgICd2aWRlby9tcGVnJ1xyXG4gICAgXVxyXG59OyJdfQ==
