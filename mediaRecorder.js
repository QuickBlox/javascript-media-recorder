(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.QBMediaRecorder = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = {
    'unsupport': 'QBMediaRecorder is not supported this environment.',
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
    'GenericError': 'The UA cannot provide the codec or recording option that has been requested',
    'ondataavailableIsOff': 'QBMediaRecorder.ondataavailable() callback isn\'t supported for "audio/wav" and "audio/mp3" formats'
};
},{}],2:[function(require,module,exports){
'use strict';

var ERRORS = require('./errors');

/**
 * @constructor QBMediaRecorder
 * @param {Object}   [opts] - Object of parameters.
 * @param {String}   opts[].mimeType=video - Specifies the media type and container format for the recording. You can set simply: 'video' or 'audio' or 'audio/webm' ('audio/wav' or 'audio/mp3' mimeTypes uses AudioContext API instead of MediaRecorder API);
 * @param {Number}   opts[].timeslice=1000 - The minimum number of milliseconds of data to return in a single Blob, fire 'ondataavaible' callback (Isn't need to use with 'audio/wav' of 'audio/mp3').
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
 *     mimeType: 'video/mp4' // Supported 'audio/mp3' in QBMediaRecorder version 0.3.0.
 * };
 *
 * // uses as global variable, QBMediaRecorder is built as a UMD module.
 * var recorder = new QBMediaRecorder(opts);
 *
 * @see For record 'audio/mp3' need to connect encoderMP3 (just connect {@link https://www.npmjs.com/package/lamejs|'lame.all.js'} or {@link https://www.npmjs.com/package/lamejs|'lame.min.js'} file to global environment) before init QBMediaRecorder.
 */
function QBMediaRecorder(opts) {
    var prefferedMimeType = opts && opts.mimeType ? opts.mimeType : false;
    this._customMimeType = (prefferedMimeType === 'audio/wav') ? 'audio/wav' :
                           (prefferedMimeType === 'audio/mp3') ? 'audio/mp3' : false;

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

    if (this._customMimeType) {
        this._setCustomRecorderTools();
    }
}

QBMediaRecorder.prototype._setCustomRecorderTools = function () {
    if(!QBMediaRecorder._isAudioContext()) {
        throw new Error(ERRORS.unsupport);
    }

    var self = this;

    self.mimeType = self._customMimeType;
    self._audioContext = null;
    self._buffer = [];
    self._recordingLength = 0;

    if (QBMediaRecorder._isMp3Encoder() && this._customMimeType === 'audio/mp3') {
        self._mp3encoder = new lamejs.Mp3Encoder(1, 48000, 128);
    }
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

QBMediaRecorder._isMp3Encoder = function () {
    return !!(window && (window.AudioContext || window.webkitAudioContext) && window.lamejs);
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
            if (QBMediaRecorder._isAudioContext() && QBMediaRecorder._isMp3Encoder()) {
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
 * @return {Array}                   Array of supported mimetypes.Recommended mimetype has 0 index.
 *
 * @example
 * var type = QBMediaRecorder.getSupportedMimeTypes('audio');
 * console.info(`Call will recording in ${type[0]}`);
 */
QBMediaRecorder.getSupportedMimeTypes = function(type) {
    var typeMedia = type || 'video';

    if(!QBMediaRecorder.isAvailable()) {
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
                this.state = 'recording';
                self._startAudioProcess();
                this.onstart();
            } catch(error) {
                this.onerror(error);
            }
        },

        stop: function() {
            try {
                this.state = 'stopped';
                self._stopAudioProcess();
                this.onstop();
            } catch(error) {
                this.onerror(error);
            }
        },

        pause: function() {
            try {
                this.state = 'paused';
                this.onpause();
            } catch(error) {
                this.onerror(error);
            }
        },

        resume: function() {
            try {
                this.state = 'recording';
                this.onresume();
            } catch(error) {
                this.onerror(error);
            }
        },

        /* callbacks */
        onstart: function() {
            if (this.state !== 'recording') {
                this.state = 'recording';
            }
        },

        onstop: function() {
            if (this.state !== 'stopped') {
                this.state = 'stopped';
            }
        },

        onpause: function() {
            if (this.state !== 'paused') {
                this.state = 'paused';
            }
        },

        onresume: function() {
            if (this.state !== 'recording') {
                this.state = 'recording';
            }
        },

        onerror: function() {
            try {
                self._closeAudioProcess();
            } catch(error) {
                throw new Error(error);
            }
        },

        ondataavailable: function() {
            this.onerror( new Error(ERRORS.ondataavailableIsOff) );
        }
    };
};

QBMediaRecorder.prototype._setEvents = function() {
    var self = this;

    function fireCallback(name, args) {
        if(Object.keys(self.callbacks).length !== 0 && typeof self.callbacks[name] === 'function') {
            try {
                self.callbacks[name](args);
            } catch(e) {
                console.error('Founded an error in callback:' + name, e);
            }
        }
    }

    self._mediaRecorder.ondataavailable = function(e) {
        if(e.data && e.data.size > 0) {
            self._recordedChunks.push(e.data);
            fireCallback('ondataavailable', e);
        }
    };

    self._mediaRecorder.onpause = function() {
        fireCallback('onpause');
    };

    self._mediaRecorder.onresume = function() {
        fireCallback('onresume');
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

        if(self._mediaRecorder.state !== 'inactive' && self._mediaRecorder.state !== 'stopped') {
            self._mediaRecorder.stop();
        }

        if(self._userCallbacks && typeof self._userCallbacks.onErrorRecording === 'function') {
            fireCallback('onerror', error);
        }
    };

    self._mediaRecorder.onstop = function() {
        var blob = new Blob(self._recordedChunks, {
            'type' : self.mimeType
        });

        self.recordedBlobs.push(blob);

        if(!self._keepRecording) {
            if(self.recordedBlobs.length > 1) {
                fireCallback('onstop', blob);
            } else {
                fireCallback('onstop', self.recordedBlobs[0]);
            }
        }

        self._keepRecording = false;
    };

    self._mediaRecorder.start(self.timeslice);

    fireCallback('onstart');
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
    recorder = self._audioContext.createScriptProcessor(1024, 1, 1);
    audioInput.connect(volume);

    recorder.onaudioprocess = function(e) {
        if (self._mediaRecorder.state === QBMediaRecorder._STATES[1]) {
            self._buffer.push(new Float32Array(e.inputBuffer.getChannelData(0)));
            self._recordingLength += 1024;
        }
    };

    volume.connect(recorder);
    recorder.connect(self._audioContext.destination);
};

QBMediaRecorder.prototype._closeAudioProcess = function() {
    var self = this;

    if (!!self._audioContext) {
        self._audioContext.close()
            .then(function() {
                self._audioContext = null;
                self._recordingLength = 0;
                self._buffer = [];
            });
    }
};

QBMediaRecorder.prototype._stopAudioProcess = function() {
    var self = this;

    self._recordedChunks = self._getBlobData();
    self._closeAudioProcess();
};

QBMediaRecorder.prototype._encodeMP3 = function(buffer) {
    var data = new Int16Array(buffer),
        mp3encoder = new lamejs.Mp3Encoder(1, 48000, 128),
        encodedBuffer = mp3encoder.encodeBuffer(data),
        flushedBuffer = mp3encoder.flush(),
        mp3Data = [];

    mp3Data.push(encodedBuffer);
    mp3Data.push(new Int8Array(flushedBuffer));

    return mp3Data;
};

QBMediaRecorder.prototype._encodeWAV = function(samples) {
    var buffer = new ArrayBuffer(44 + samples.length * 2),
        view = new DataView(buffer);

    _writeString(view, 0, 'RIFF');
    view.setUint32(4, 32 + samples.length * 2, true);
    _writeString(view, 8, 'WAVE');
    _writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    _writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    _floatTo16BitPCM(view, 44, samples);

    function _floatTo16BitPCM(output, offset, input) {
        for (var i = 0; i < input.length; i++, offset += 2) {
            var s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }

    function _writeString(view, offset, string) {
        for (var i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    return view;
};

QBMediaRecorder.prototype._getBlobData = function() {
    var self = this,
        result = new Float32Array(self._recordingLength),
        bufferLength = self._buffer.length,
        offset = 0,
        buffer,
        view,
        data;

    for (var i = 0; i < bufferLength; i++){
        buffer = self._buffer[i];
        result.set(buffer, offset);
        offset += buffer.length;
    }

    view = self._encodeWAV(result);

    switch(self._customMimeType) {
        case 'audio/wav':
            data = [view];
            break;

        case 'audio/mp3':
            data = self._encodeMP3(view.buffer);
            break;

        default:
            throw new Error(ERRORS.unsupportMediaRecorderWithOptions);
            break;
    }

    return data;
};

module.exports = QBMediaRecorder;
},{"./errors":1,"./mimeTypes":3}],3:[function(require,module,exports){
'use strict';

module.exports = {
    'audio': [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg',
        'audio/wav',
        'audio/mp3'
    ],
    'video': [
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm;codecs=daala',
        'video/webm',
        'video/mp4',
        'video/mpeg'
    ]
};
},{}]},{},[2])(2)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL21pbWVUeXBlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy90QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgICd1bnN1cHBvcnQnOiAnUUJNZWRpYVJlY29yZGVyIGlzIG5vdCBzdXBwb3J0ZWQgdGhpcyBlbnZpcm9ubWVudC4nLFxyXG4gICAgJ3Vuc3VwcG9ydE1lZGlhUmVjb3JkZXJXaXRoT3B0aW9ucyc6ICdHb3QgYSB3YXJuaW5nIHdoZW4gY3JlYXRpbmcgYSBNZWRpYVJlY29yZGVyLCB0cnlpbmcgdG8gY3JlYXRlIE1lZGlhUmVjb3JkZXIgd2l0aG91dCBvcHRpb25zLicsXHJcbiAgICAncmVxdXJlQXJndW1lbnQnOiAnMSBhcmd1bWVudCByZXF1aXJlZCwgYnV0IG9ubHkgMCBwcmVzZW50LicsXHJcbiAgICAnY2FsbGJhY2tFcnJvcic6ICdGb3VuZGVkIGFuIGVycm9yIGluIGNhbGxiYWNrOicsXHJcbiAgICAnYWN0aW9uRmFpbGVkJzogJ1FCTWVkaWFSZWNvcmRlciBpcyBub3QgY3JlYXRlZCBvciBoYXMgYW4gaW52YWxpZCBzdGF0ZS4nLFxyXG4gICAgJ25vX3JlY29yZGVkX2NodW5rcyc6ICdEb2VzIG5vdCBoYXZlIGFueSByZWNvcmRpbmcgZGF0YS4nLFxyXG4gICAgJ3N0cmVhbVJlcXVpcmVkJzogJ01lZGlhU3RyZWFtIGlzIHJlcXVpcmVkLicsXHJcbiAgICAnSW52YWxpZFN0YXRlJzogJ1FCTWVkaWFSZWNvcmRlciBpcyBub3QgaW4gYSBzdGF0ZSBpbiB3aGljaCB0aGUgcHJvcG9zZWQgb3BlcmF0aW9uIGlzIGFsbG93ZWQgdG8gYmUgZXhlY3V0ZWQuJyxcclxuICAgICdPdXRPZk1lbW9yeSc6ICdUaGUgVUEgaGFzIGV4aGF1c2VkIHRoZSBhdmFpbGFibGUgbWVtb3J5LiBVc2VyIGFnZW50cyBTSE9VTEQgcHJvdmlkZSBhcyBtdWNoIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYXMgcG9zc2libGUgaW4gdGhlIG1lc3NhZ2UgYXR0cmlidXRlLicsXHJcbiAgICAnSWxsZWdhbFN0cmVhbU1vZGlmaWNhdGlvbic6ICdBIG1vZGlmaWNhdGlvbiB0byB0aGUgc3RyZWFtIGhhcyBvY2N1cnJlZCB0aGF0IG1ha2VzIGl0IGltcG9zc2libGUgdG8gY29udGludWUgcmVjb3JkaW5nLiBBbiBleGFtcGxlIHdvdWxkIGJlIHRoZSBhZGRpdGlvbiBvZiBhIFRyYWNrIHdoaWxlIHJlY29yZGluZyBpcyBvY2N1cnJpbmcuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdPdGhlclJlY29yZGluZ0Vycm9yJzogJ1VzZWQgZm9yIGFuIGZhdGFsIGVycm9yIG90aGVyIHRoYW4gdGhvc2UgbGlzdGVkIGFib3ZlLiBVc2VyIGFnZW50cyBTSE9VTEQgcHJvdmlkZSBhcyBtdWNoIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYXMgcG9zc2libGUgaW4gdGhlIG1lc3NhZ2UgYXR0cmlidXRlLicsXHJcbiAgICAnR2VuZXJpY0Vycm9yJzogJ1RoZSBVQSBjYW5ub3QgcHJvdmlkZSB0aGUgY29kZWMgb3IgcmVjb3JkaW5nIG9wdGlvbiB0aGF0IGhhcyBiZWVuIHJlcXVlc3RlZCcsXHJcbiAgICAnb25kYXRhYXZhaWxhYmxlSXNPZmYnOiAnUUJNZWRpYVJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSgpIGNhbGxiYWNrIGlzblxcJ3Qgc3VwcG9ydGVkIGZvciBcImF1ZGlvL3dhdlwiIGFuZCBcImF1ZGlvL21wM1wiIGZvcm1hdHMnXHJcbn07IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEVSUk9SUyA9IHJlcXVpcmUoJy4vZXJyb3JzJyk7XHJcblxyXG4vKipcclxuICogQGNvbnN0cnVjdG9yIFFCTWVkaWFSZWNvcmRlclxyXG4gKiBAcGFyYW0ge09iamVjdH0gICBbb3B0c10gLSBPYmplY3Qgb2YgcGFyYW1ldGVycy5cclxuICogQHBhcmFtIHtTdHJpbmd9ICAgb3B0c1tdLm1pbWVUeXBlPXZpZGVvIC0gU3BlY2lmaWVzIHRoZSBtZWRpYSB0eXBlIGFuZCBjb250YWluZXIgZm9ybWF0IGZvciB0aGUgcmVjb3JkaW5nLiBZb3UgY2FuIHNldCBzaW1wbHk6ICd2aWRlbycgb3IgJ2F1ZGlvJyBvciAnYXVkaW8vd2VibScgKCdhdWRpby93YXYnIG9yICdhdWRpby9tcDMnIG1pbWVUeXBlcyB1c2VzIEF1ZGlvQ29udGV4dCBBUEkgaW5zdGVhZCBvZiBNZWRpYVJlY29yZGVyIEFQSSk7XHJcbiAqIEBwYXJhbSB7TnVtYmVyfSAgIG9wdHNbXS50aW1lc2xpY2U9MTAwMCAtIFRoZSBtaW5pbXVtIG51bWJlciBvZiBtaWxsaXNlY29uZHMgb2YgZGF0YSB0byByZXR1cm4gaW4gYSBzaW5nbGUgQmxvYiwgZmlyZSAnb25kYXRhYXZhaWJsZScgY2FsbGJhY2sgKElzbid0IG5lZWQgdG8gdXNlIHdpdGggJ2F1ZGlvL3dhdicgb2YgJ2F1ZGlvL21wMycpLlxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59ICBvcHRzW10uaWdub3JlTXV0ZWRNZWRpYT10cnVlIC0gV2hhdCB0byBkbyB3aXRoIGEgbXV0ZWQgaW5wdXQgTWVkaWFTdHJlYW1UcmFjaywgZS5nLiBpbnNlcnQgYmxhY2sgZnJhbWVzL3plcm8gYXVkaW8gdm9sdW1lIGluIHRoZSByZWNvcmRpbmcgb3IgaWdub3JlIGFsdG9nZXRoZXIuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbnN0YXJ0IC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgc3RhcnQgZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbnN0b3AgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBzdG9wIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25wYXVzZSAtIENhbGxlZCB0byBoYW5kbGUgdGhlIHBhdXNlIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25yZXN1bWUgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSByZXN1bWUgZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbmVycm9yIC0gQ2FsbGVkIHRvIGhhbmRsZSBhbiBFcnJvckV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25jaGFuZ2UgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBjaGFuZ2UgYSBzdHJlYW0gZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbmRhdGFhdmFpbGFibGUgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBkYXRhYXZhaWxhYmxlIGV2ZW50LiBUaGUgQmxvYiBvZiByZWNvcmRlZCBkYXRhIGlzIGNvbnRhaW5lZCBpbiB0aGlzIGV2ZW50IChDYWxsYmFjayBpc24ndCBzdXBwb3J0ZWQgaWYgdXNlICdhdWRpby93YXYnIG9mICdhdWRpby9tcDMnIGZvciByZWNvcmRpbmcpLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgb3B0cyA9IHtcclxuICogICAgIG9uc3RhcnQ6IGZ1bmN0aW9uIG9uU3RhcnQoKSB7IC8vIFVzZSBuYW1lZCBmdW5jdGlvbi5cclxuICogICAgICAgICBjb25zb2xlLmxvZygnUmVjb3JkZXIgaXMgc3RhcnRlZCcpO1xyXG4gKiAgICAgfSxcclxuICogICAgIG9uc3RvcDogZnVuY3Rpb24gb25TdG9wKEJsb2IpIHtcclxuICogICAgICAgICB2aWRlb0VsZW1lbnQuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcclxuICogICAgIH0sXHJcbiAqICAgICBtaW1lVHlwZTogJ3ZpZGVvL21wNCcgLy8gU3VwcG9ydGVkICdhdWRpby9tcDMnIGluIFFCTWVkaWFSZWNvcmRlciB2ZXJzaW9uIDAuMy4wLlxyXG4gKiB9O1xyXG4gKlxyXG4gKiAvLyB1c2VzIGFzIGdsb2JhbCB2YXJpYWJsZSwgUUJNZWRpYVJlY29yZGVyIGlzIGJ1aWx0IGFzIGEgVU1EIG1vZHVsZS5cclxuICogdmFyIHJlY29yZGVyID0gbmV3IFFCTWVkaWFSZWNvcmRlcihvcHRzKTtcclxuICpcclxuICogQHNlZSBGb3IgcmVjb3JkICdhdWRpby9tcDMnIG5lZWQgdG8gY29ubmVjdCBlbmNvZGVyTVAzIChqdXN0IGNvbm5lY3Qge0BsaW5rIGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL2xhbWVqc3wnbGFtZS5hbGwuanMnfSBvciB7QGxpbmsgaHR0cHM6Ly93d3cubnBtanMuY29tL3BhY2thZ2UvbGFtZWpzfCdsYW1lLm1pbi5qcyd9IGZpbGUgdG8gZ2xvYmFsIGVudmlyb25tZW50KSBiZWZvcmUgaW5pdCBRQk1lZGlhUmVjb3JkZXIuXHJcbiAqL1xyXG5mdW5jdGlvbiBRQk1lZGlhUmVjb3JkZXIob3B0cykge1xyXG4gICAgdmFyIHByZWZmZXJlZE1pbWVUeXBlID0gb3B0cyAmJiBvcHRzLm1pbWVUeXBlID8gb3B0cy5taW1lVHlwZSA6IGZhbHNlO1xyXG4gICAgdGhpcy5fY3VzdG9tTWltZVR5cGUgPSAocHJlZmZlcmVkTWltZVR5cGUgPT09ICdhdWRpby93YXYnKSA/ICdhdWRpby93YXYnIDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgKHByZWZmZXJlZE1pbWVUeXBlID09PSAnYXVkaW8vbXAzJykgPyAnYXVkaW8vbXAzJyA6IGZhbHNlO1xyXG5cclxuICAgIGlmKCFRQk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSAmJiAhdGhpcy5fY3VzdG9tTWltZVR5cGUpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5taW1lVHlwZSA9IHRoaXMuX2dldE1pbWVUeXBlKHByZWZmZXJlZE1pbWVUeXBlKTtcclxuICAgIHRoaXMudGltZXNsaWNlID0gb3B0cyAmJiBvcHRzLnRpbWVzbGljZSAmJiBpc05hTigrb3B0cy50aW1lc2xpY2UpID8gb3B0cy50aW1lc2xpY2UgOiAxMDAwO1xyXG4gICAgdGhpcy5jYWxsYmFja3MgPSBvcHRzID8gdGhpcy5fZ2V0Q2FsbGJhY2tzKG9wdHMpIDoge307XHJcbiAgICB0aGlzLnJlY29yZGVkQmxvYnMgPSBbXTtcclxuICAgIHRoaXMuaWdub3JlTXV0ZWRNZWRpYSA9IG9wdHMgJiYgdHlwZW9mKG9wdHMuaWdub3JlTXV0ZWRNZWRpYSkgPT09ICdib29sZWFuJyA/IG9wdHMuaWdub3JlTXV0ZWRNZWRpYSA6IHRydWU7XHJcblxyXG4gICAgdGhpcy5fc3RyZWFtID0gbnVsbDtcclxuICAgIHRoaXMuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG4gICAgdGhpcy5fcmVjb3JkZWRDaHVua3MgPSBbXTtcclxuICAgIHRoaXMuX2tlZXBSZWNvcmRpbmcgPSBmYWxzZTtcclxuXHJcbiAgICBpZiAodGhpcy5fY3VzdG9tTWltZVR5cGUpIHtcclxuICAgICAgICB0aGlzLl9zZXRDdXN0b21SZWNvcmRlclRvb2xzKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3NldEN1c3RvbVJlY29yZGVyVG9vbHMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBpZighUUJNZWRpYVJlY29yZGVyLl9pc0F1ZGlvQ29udGV4dCgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBzZWxmLm1pbWVUeXBlID0gc2VsZi5fY3VzdG9tTWltZVR5cGU7XHJcbiAgICBzZWxmLl9hdWRpb0NvbnRleHQgPSBudWxsO1xyXG4gICAgc2VsZi5fYnVmZmVyID0gW107XHJcbiAgICBzZWxmLl9yZWNvcmRpbmdMZW5ndGggPSAwO1xyXG5cclxuICAgIGlmIChRQk1lZGlhUmVjb3JkZXIuX2lzTXAzRW5jb2RlcigpICYmIHRoaXMuX2N1c3RvbU1pbWVUeXBlID09PSAnYXVkaW8vbXAzJykge1xyXG4gICAgICAgIHNlbGYuX21wM2VuY29kZXIgPSBuZXcgbGFtZWpzLk1wM0VuY29kZXIoMSwgNDgwMDAsIDEyOCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRNaW1lVHlwZSA9IGZ1bmN0aW9uIChwcmVmZmVyZWQpIHtcclxuICAgIHZhciBtaW1lVHlwZSxcclxuICAgICAgICB0eXBlID0gJ3ZpZGVvJztcclxuXHJcbiAgICBpZihwcmVmZmVyZWQgJiYgUUJNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZChwcmVmZmVyZWQpKSB7XHJcbiAgICAgICAgbWltZVR5cGUgPSBwcmVmZmVyZWQ7XHJcbiAgICB9IGVsc2UgaWYocHJlZmZlcmVkKSB7XHJcbiAgICAgICAgdHlwZSA9IHByZWZmZXJlZC50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkuaW5kZXhPZignYXVkaW8nKSA9PT0gLTEgPyAndmlkZW8nIDogJ2F1ZGlvJztcclxuICAgICAgICBtaW1lVHlwZSA9IFFCTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXModHlwZSlbMF07XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIG1pbWVUeXBlID0gUUJNZWRpYVJlY29yZGVyLmdldFN1cHBvcnRlZE1pbWVUeXBlcyh0eXBlKVswXTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbWltZVR5cGU7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRDYWxsYmFja3MgPSBmdW5jdGlvbihvcHRzKSB7XHJcbiAgICB2YXIgY2FsbGJhY2tzID0ge30sXHJcbiAgICAgICAgY2FsbGJhY2tOYW1lcyA9IFsnb25zdGFydCcsICdvbnN0b3AnLCAnb25wYXVzZScsICdvbnJlc3VtZScsICdvbmVycm9yJywgJ29uY2hhbmdlJywgJ29uZGF0YWF2YWlsYWJsZSddO1xyXG5cclxuICAgIGNhbGxiYWNrTmFtZXMuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XHJcbiAgICAgICAgaWYgKG5hbWUgaW4gb3B0cykge1xyXG4gICAgICAgICAgICBjYWxsYmFja3NbbmFtZV0gPSBvcHRzW25hbWVdO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBjYWxsYmFja3M7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIuX21pbWVUeXBlcyA9IHJlcXVpcmUoJy4vbWltZVR5cGVzJyk7XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIuX1NUQVRFUyA9IFsnaW5hY3RpdmUnLCAncmVjb3JkaW5nJywgJ3BhdXNlZCddO1xyXG5cclxuLyoqXHJcbiAqIEl0IGNoZWNrcyBjYXBhYmlsaXR5IG9mIHJlY29yZGluZyBpbiB0aGUgZW52aXJvbm1lbnQuXHJcbiAqIENoZWNrcyBNZWRpYVJlY29yZGVyLCBNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCBhbmQgQmxvYi5cclxuICogQHJldHVybiB7Qm9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIHRoZSBRQk1lZGlhUmVjb3JkZXIgaXMgYXZhaWxhYmxlIGFuZCBjYW4gcnVuLCBvciBmYWxzZSBvdGhlcndpc2UuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGlmKFFCTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpKSB7XHJcbiAqICAgICAvLyAuLi4gc2hvdyBVSSBmb3IgcmVjb3JkaW5nXHJcbiAqIH1cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuICEhKHdpbmRvdyAmJiB3aW5kb3cuTWVkaWFSZWNvcmRlciAmJiB0eXBlb2Ygd2luZG93Lk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkID09PSAnZnVuY3Rpb24nICYmIHdpbmRvdy5CbG9iKTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5faXNBdWRpb0NvbnRleHQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4gISEod2luZG93ICYmICh3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQpKTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5faXNNcDNFbmNvZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuICEhKHdpbmRvdyAmJiAod2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0KSAmJiB3aW5kb3cubGFtZWpzKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGEgQm9vbGVhbiB3aGljaCBpcyB0cnVlIGlmIHRoZSBNSU1FIHR5cGUgc3BlY2lmaWVkIGlzIG9uZSB0aGUgdXNlciBhZ2VudCBjYW4gcmVjb3JkLlxyXG4gKiBAcGFyYW0gIHtTdHJpbmd9IG1pbWVUeXBlIC0gVGhlIG1pbWVUeXBlIHRvIGNoZWNrLlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgIC0gVHJ1ZSBpZiB0aGUgTWVkaWFSZWNvcmRlciBpbXBsZW1lbnRhdGlvbiBpcyBjYXBhYmxlIG9mIHJlY29yZGluZyBCbG9iIG9iamVjdHMgZm9yIHRoZSBzcGVjaWZpZWQgTUlNRSB0eXBlLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBpZiggUUJNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXA0JykgKSB7XHJcbiAqICAgICBlbC50ZXh0Q29udGVudCA9ICdXaWxsIGJlIHJlY29yZCBpbiB2aWRlby9tcDQnO1xyXG4gKiB9XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkID0gZnVuY3Rpb24obWltZVR5cGUpIHtcclxuICAgIHZhciByZXN1bHQgPSBmYWxzZTtcclxuXHJcbiAgICBpZighUUJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYoIW1pbWVUeXBlKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy5yZXF1cmVBcmd1bWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgc3dpdGNoKG1pbWVUeXBlKSB7XHJcbiAgICAgICAgY2FzZSAnYXVkaW8vd2F2JzpcclxuICAgICAgICAgICAgaWYgKFFCTWVkaWFSZWNvcmRlci5faXNBdWRpb0NvbnRleHQoKSkge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgY2FzZSAnYXVkaW8vbXAzJzpcclxuICAgICAgICAgICAgaWYgKFFCTWVkaWFSZWNvcmRlci5faXNBdWRpb0NvbnRleHQoKSAmJiBRQk1lZGlhUmVjb3JkZXIuX2lzTXAzRW5jb2RlcigpKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICByZXN1bHQgPSB3aW5kb3cuTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQobWltZVR5cGUpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBhbGwgc3VwcG9ydGVkIG1pbWUgdHlwZXMgYW5kIGNvbnRhaW5lciBmb3JtYXQuXHJcbiAqIEBwYXJhbSAge1N0cmluZ30gW3R5cGU9dmlkZW9dIFR5cGUgb2YgbWVkaWEuXHJcbiAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgICAgICAgICAgICBBcnJheSBvZiBzdXBwb3J0ZWQgbWltZXR5cGVzLlJlY29tbWVuZGVkIG1pbWV0eXBlIGhhcyAwIGluZGV4LlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgdHlwZSA9IFFCTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXMoJ2F1ZGlvJyk7XHJcbiAqIGNvbnNvbGUuaW5mbyhgQ2FsbCB3aWxsIHJlY29yZGluZyBpbiAke3R5cGVbMF19YCk7XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzID0gZnVuY3Rpb24odHlwZSkge1xyXG4gICAgdmFyIHR5cGVNZWRpYSA9IHR5cGUgfHwgJ3ZpZGVvJztcclxuXHJcbiAgICBpZighUUJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIFFCTWVkaWFSZWNvcmRlci5fbWltZVR5cGVzW3R5cGVNZWRpYV0uZmlsdGVyKGZ1bmN0aW9uKG1pbWVUeXBlKSB7XHJcbiAgICAgICAgcmV0dXJuIFFCTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQobWltZVR5cGUpO1xyXG4gICAgfSk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJuIHRoZSBjdXJyZW50IFtzdGF0ZSBvZiBRQk1lZGlhUmVjb3JkZXIgaW5zdGFuY2VdKGh0dHBzOi8vdzNjLmdpdGh1Yi5pby9tZWRpYWNhcHR1cmUtcmVjb3JkL01lZGlhUmVjb3JkZXIuaHRtbCNpZGwtZGVmLXJlY29yZGluZ3N0YXRlKS5cclxuICogUG9zc2libHkgc3RhdGVzOiAqKmluYWN0aXZlKiosICoqcmVjb3JkaW5nKiosICoqcGF1c2VkKiouXHJcbiAqIEByZXR1cm4ge1N0cmluZ30gTmFtZSBvZiBhIHN0YXRlLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgcmVjb3JkZXIgPSBuZXcgUUJNZWRpYVJlY29yZGVyKCk7XHJcbiAqIC8vIC4uLnNvbWUgY29kZVxyXG4gKlxyXG4gKiBpZihyZWNvcmRlci5nZXRTdGF0ZSgpID09ICdyZWNvcmRpbmcnKSB7XHJcbiAqICAgICBjb25zb2xlLmluZm8oJ1lvdSBhcmUgc3RpbGwgcmVjb3JkaW5nLicpO1xyXG4gKiB9XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLmdldFN0YXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5fbWVkaWFSZWNvcmRlciA/IHRoaXMuX21lZGlhUmVjb3JkZXIuc3RhdGUgOiBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1swXTtcclxufTtcclxuXHJcblxyXG4vKipcclxuICogU3RhcnQgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBGaXJlIHRoZSBtZXRob2QgYHN0b3BgIGlmIGFuIGluc3RhbmNlIGlucHJvZ3Jlc3MgKGhhcyBhIHN0YXRlIHJlY29yZGluZyBvciBwYXVzZWQpLlxyXG4gKiBGaXJlIG9uc3RhcnQgY2FsbGJhY2suXHJcbiAqIEBwYXJhbSB7TWVkaWFTdHJlYW19IHN0cmVhbSAtIFN0cmVhbSBvYmplY3QgcmVwcmVzZW50aW5nIGEgZmx1eCBvZiBhdWRpby0gb3IgdmlkZW8tcmVsYXRlZCBkYXRhLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICpcclxuICogQGV4YW1wbGVcclxuICogdmFyIG9wdGlvbnMgPSB7XHJcbiAqICAgICBvbnN0YXJ0OiBmdW5jdGlvbiBvblN0YXJ0KCkge1xyXG4gKiAgICAgICAgIHZhciB0aW1lID0gMCxcclxuICogICAgICAgICAgICAgc3RlcCA9IDEwMDA7XHJcbiAqICAgICAgICAgXHJcbiAqICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAqICAgICAgICAgICAgIHRpbWUgKz0gc3RlcDtcclxuICogICAgICAgICAgICAgY29uc29sZS5pbmZvKGBZb3UgYXJlIHJlY29yZGluZyAke3RpbWV9IHNlYy5gKTtcclxuICogICAgICAgICB9LCBzdGVwKTtcclxuICogICAgIH1cclxuICogfVxyXG4gKlxyXG4gKiB2YXIgcmVjID0gbmV3IHFiUmVjb3JkZXIob3B0aW9ucyk7XHJcbiAqIC8vIC4uLlxyXG4gKiByZWMuc3RhcnQoc3RyZWFtKTtcclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbihzdHJlYW0pIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZighc3RyZWFtKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy5yZXF1cmVBcmd1bWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IHRoaXMuZ2V0U3RhdGUoKTtcclxuXHJcbiAgICBpZihtZWRpYVJlY29yZGVyU3RhdGUgPT09IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzFdIHx8IG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMl0pIHtcclxuICAgICAgICB0aGlzLl9tZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuICAgIH1cclxuXHJcbiAgICBpZih0aGlzLl9zdHJlYW0pIHtcclxuICAgICAgICB0aGlzLl9zdHJlYW0gPSBudWxsO1xyXG4gICAgfVxyXG4gICAgLy8gVE9ETzogbmVlZCB0byBzdHJlYW0uY2xvbmVcclxuICAgIHNlbGYuX3N0cmVhbSA9IHN0cmVhbTtcclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG4gICAgc2VsZi5fcmVjb3JkZWRDaHVua3MubGVuZ3RoID0gMDtcclxuXHJcbiAgICBpZiAoc2VsZi5fY3VzdG9tTWltZVR5cGUpIHtcclxuICAgICAgICBzZWxmLl9zZXRDdXN0b21SZWNvcmRlcigpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBzZWxmLl9zZXRNZWRpYVJlY29yZGVyKCk7XHJcbiAgICB9XHJcbiAgICBzZWxmLl9zZXRFdmVudHMoKTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3NldE1lZGlhUmVjb3JkZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbmV3IHdpbmRvdy5NZWRpYVJlY29yZGVyKHNlbGYuX3N0cmVhbSwge1xyXG4gICAgICAgICAgICAnbWltZVR5cGUnOiBzZWxmLm1pbWVUeXBlLFxyXG4gICAgICAgICAgICAnaWdub3JlTXV0ZWRNZWRpYSc6IHNlbGYuaWdub3JlTXV0ZWRNZWRpYVxyXG4gICAgICAgIH0pO1xyXG4gICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy51bnN1cHBvcnRNZWRpYVJlY29yZGVyV2l0aE9wdGlvbnMsIGUpO1xyXG5cclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbmV3IHdpbmRvdy5NZWRpYVJlY29yZGVyKHNlbGYuX3N0cmVhbSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9zZXRDdXN0b21SZWNvcmRlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHNlbGYuX2Nsb3NlQXVkaW9Qcm9jZXNzKCk7XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IHtcclxuICAgICAgICBzdGFydDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ3JlY29yZGluZyc7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9zdGFydEF1ZGlvUHJvY2VzcygpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vbnN0YXJ0KCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMub25lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBzdG9wOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnc3RvcHBlZCc7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9zdG9wQXVkaW9Qcm9jZXNzKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uc3RvcCgpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgcGF1c2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdwYXVzZWQnO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vbnBhdXNlKCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMub25lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICByZXN1bWU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdyZWNvcmRpbmcnO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vbnJlc3VtZSgpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyogY2FsbGJhY2tzICovXHJcbiAgICAgICAgb25zdGFydDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnN0YXRlICE9PSAncmVjb3JkaW5nJykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdyZWNvcmRpbmcnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgb25zdG9wOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGUgIT09ICdzdG9wcGVkJykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdzdG9wcGVkJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIG9ucGF1c2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zdGF0ZSAhPT0gJ3BhdXNlZCcpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAncGF1c2VkJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIG9ucmVzdW1lOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGUgIT09ICdyZWNvcmRpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ3JlY29yZGluZyc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBvbmVycm9yOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHNlbGYuX2Nsb3NlQXVkaW9Qcm9jZXNzKCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBvbmRhdGFhdmFpbGFibGU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0aGlzLm9uZXJyb3IoIG5ldyBFcnJvcihFUlJPUlMub25kYXRhYXZhaWxhYmxlSXNPZmYpICk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3NldEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGZpcmVDYWxsYmFjayhuYW1lLCBhcmdzKSB7XHJcbiAgICAgICAgaWYoT2JqZWN0LmtleXMoc2VsZi5jYWxsYmFja3MpLmxlbmd0aCAhPT0gMCAmJiB0eXBlb2Ygc2VsZi5jYWxsYmFja3NbbmFtZV0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHNlbGYuY2FsbGJhY2tzW25hbWVdKGFyZ3MpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZvdW5kZWQgYW4gZXJyb3IgaW4gY2FsbGJhY2s6JyArIG5hbWUsIGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25kYXRhYXZhaWxhYmxlID0gZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmKGUuZGF0YSAmJiBlLmRhdGEuc2l6ZSA+IDApIHtcclxuICAgICAgICAgICAgc2VsZi5fcmVjb3JkZWRDaHVua3MucHVzaChlLmRhdGEpO1xyXG4gICAgICAgICAgICBmaXJlQ2FsbGJhY2soJ29uZGF0YWF2YWlsYWJsZScsIGUpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnBhdXNlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgZmlyZUNhbGxiYWNrKCdvbnBhdXNlJyk7XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25yZXN1bWUgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBmaXJlQ2FsbGJhY2soJ29ucmVzdW1lJyk7XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25lcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XHJcbiAgICAgICAgc3dpdGNoKGVycm9yLm5hbWUpIHtcclxuICAgICAgICAgICAgY2FzZSAnSW52YWxpZFN0YXRlJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnT3V0T2ZNZW1vcnknOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnT3RoZXJSZWNvcmRpbmdFcnJvcic6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ0dlbmVyaWNFcnJvcic6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdNZWRpYVJlY29yZGVyIEVycm9yJywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZihzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlICE9PSAnaW5hY3RpdmUnICYmIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgIT09ICdzdG9wcGVkJykge1xyXG4gICAgICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKHNlbGYuX3VzZXJDYWxsYmFja3MgJiYgdHlwZW9mIHNlbGYuX3VzZXJDYWxsYmFja3Mub25FcnJvclJlY29yZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBmaXJlQ2FsbGJhY2soJ29uZXJyb3InLCBlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9uc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBibG9iID0gbmV3IEJsb2Ioc2VsZi5fcmVjb3JkZWRDaHVua3MsIHtcclxuICAgICAgICAgICAgJ3R5cGUnIDogc2VsZi5taW1lVHlwZVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBzZWxmLnJlY29yZGVkQmxvYnMucHVzaChibG9iKTtcclxuXHJcbiAgICAgICAgaWYoIXNlbGYuX2tlZXBSZWNvcmRpbmcpIHtcclxuICAgICAgICAgICAgaWYoc2VsZi5yZWNvcmRlZEJsb2JzLmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgICAgIGZpcmVDYWxsYmFjaygnb25zdG9wJywgYmxvYik7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBmaXJlQ2FsbGJhY2soJ29uc3RvcCcsIHNlbGYucmVjb3JkZWRCbG9ic1swXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHNlbGYuX2tlZXBSZWNvcmRpbmcgPSBmYWxzZTtcclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGFydChzZWxmLnRpbWVzbGljZSk7XHJcblxyXG4gICAgZmlyZUNhbGxiYWNrKCdvbnN0YXJ0Jyk7XHJcbn07XHJcblxyXG4vKipcclxuICogU3RvcCB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm4ge0Jsb2J9IEJsb2Igb2YgcmVjb3JkZWQgY2h1bmNrcy5cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXIgPSB0aGlzLl9tZWRpYVJlY29yZGVyLFxyXG4gICAgICAgIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlci5zdGF0ZSA/IG1lZGlhUmVjb3JkZXIuc3RhdGUgOiAnaW5hY3RpdmUnO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXIgJiYgKG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gJ3JlY29yZGluZycgfHwgbWVkaWFSZWNvcmRlclN0YXRlID09PSAncGF1c2VkJykpe1xyXG4gICAgICAgIG1lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLmFjdGlvbkZhaWxlZCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogUGF1c2UgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZihzZWxmLl9tZWRpYVJlY29yZGVyICYmIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgPT09ICdyZWNvcmRpbmcnKSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5wYXVzZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLmFjdGlvbkZhaWxlZCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogUmVzdW1lIHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIgJiYgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSA9PT0gJ3BhdXNlZCcpIHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnJlc3VtZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLmFjdGlvbkZhaWxlZCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogQ2hhbmdlIGEgcmVjb3JkZWQgc3RyZWFtLlxyXG4gKiBAcGFyYW0ge01lZGlhU3RyZWFtfSBzdHJlYW0gLSBTdHJlYW0gb2JqZWN0IHJlcHJlc2VudGluZyBhIGZsdXggb2YgYXVkaW8tIG9yIHZpZGVvLXJlbGF0ZWQgZGF0YS5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLmNoYW5nZSA9IGZ1bmN0aW9uKHN0cmVhbSkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmKCFzdHJlYW0pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnJlcXVyZUFyZ3VtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICBzZWxmLl9rZWVwUmVjb3JkaW5nID0gdHJ1ZTsgLy8gZG9uJ3Qgc3RvcCBhIHJlY29yZFxyXG4gICAgc2VsZi5zdG9wKCk7XHJcblxyXG4gICAgc2VsZi5fc3RyZWFtID0gbnVsbDtcclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG5cclxuICAgIC8vIFRPRE8gc3RyZWFtLmNsb25lXHJcbiAgICBzZWxmLl9zdHJlYW0gPSBzdHJlYW07XHJcblxyXG4gICAgaWYgKHNlbGYuX2N1c3RvbU1pbWVUeXBlKSB7XHJcbiAgICAgICAgc2VsZi5fc2V0Q3VzdG9tUmVjb3JkZXIoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2VsZi5fc2V0TWVkaWFSZWNvcmRlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX3NldEV2ZW50cygpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIGZpbGUgZnJvbSBibG9iIGFuZCBkb3dubG9hZCBhcyB0aGUgZmlsZS4gSXRzIG1ldGhvZCB3aWxsIGZpcmUgJ3N0b3AnIGlmIHJlY29yZGluZyBpbiBwcm9ncmVzcy5cclxuICogQHBhcmFtIHtTdHJpbnR9IFtmaWxlTmFtZT1EYXRlLm5vdygpXSAtIE5hbWUgb2YgZmlsZS5cclxuICogQHBhcmFtIHtCbG9ifSAgIFtibG9iXSAtIFlvdSBjYW4gc2V0IGJsb2Igd2hpY2ggeW91IGdldCBmcm9tIHRoZSBtZXRob2QgYHN0b3BgIG9yIGRvbid0IHNldCBhbnl0aGluZyBhbmQgd2Ugd2lsbCBnZXQgcmVjb3JkZWQgY2h1bmNrcy5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciByZWMgPSBuZXcgcWJSZWNvcmRlcigpO1xyXG4gKiByZWMuc3RhcnQoc3RyZWFtKTtcclxuICogLy8gLi4uXHJcbiAqIHJlYy5kb3dubG9hZChmYWxzZSk7IC8vIFNldCBmYWxzZSwgbmFtZSB3aWxsIGJlIGdlbmVyYXRlZCBiYXNlZCBvbiBEYXRlLm5vdygpXHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLmRvd25sb2FkID0gZnVuY3Rpb24oZmlsZU5hbWUsIGJsb2IpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICB2YXIgbWVkaWFSZWNvcmRlclN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMV0gfHwgbWVkaWFSZWNvcmRlclN0YXRlID09PSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1syXSkge1xyXG4gICAgICAgIHRoaXMuX21lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IgfHwgc2VsZi5fZ2V0QmxvYlJlY29yZGVkKCkpLFxyXG4gICAgICAgIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcblxyXG4gICAgYS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgYS5ocmVmID0gdXJsO1xyXG4gICAgYS5kb3dubG9hZCA9IChmaWxlTmFtZSB8fCBEYXRlLm5vdygpKSArICcuJyArIHNlbGYuX2dldEV4dGVuc2lvbigpO1xyXG5cclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcblxyXG4gICAgLy8gU3RhcnQgZG93bG9hZGluZ1xyXG4gICAgYS5jbGljaygpO1xyXG5cclxuICAgIC8vIFJlbW92ZSBsaW5rXHJcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoYSk7XHJcbiAgICAgICAgd2luZG93LlVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcclxuICAgIH0sIDEwMCk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGEgQmxvYiBmcm9tIHJlY29yZGVkIGNodW5rcy5cclxuICogQGFjY2VzcyBwcml2YXRlXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBbZGF0YV0gLSBSZWNvcmRlZCBkYXRhLlxyXG4gKiBAcmV0dXJuIHtPYmplY3R9IC0gQmxvYiBvZiByZWNvcmRlZCBtZWRpYSBvciB3aGF0IHlvdSBzZXQgaW4gZGF0YVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0QmxvYlJlY29yZGVkID0gZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgIGNodW5rcyA9IGRhdGEgfHwgc2VsZi5fcmVjb3JkZWRDaHVua3M7XHJcblxyXG4gICAgaWYoIWNodW5rcy5sZW5ndGgpIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLm5vX3JlY29yZGVkX2NodW5rcyk7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBuZXcgQmxvYihjaHVua3MsIHsgJ3R5cGUnIDogc2VsZi5taW1lVHlwZSB9KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gYSBleHRlbnNpb24gb2YgYSBmaWxlLiBCYXNlZCBvbiBhdmFpbGFibGUgbWltZVR5cGUuXHJcbiAqIEBhY2Nlc3MgcHJpdmF0ZVxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IEZvciBleGFtcGxlLCAnd2VibScgLyAnbXA0JyAvICdvZ2cnXHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRFeHRlbnNpb24gPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICB2YXIgZW5kVHlwZU1lZGlhID0gc2VsZi5taW1lVHlwZS5pbmRleE9mKCcvJyksXHJcbiAgICAgICAgZXh0ZW5zaW9uID0gc2VsZi5taW1lVHlwZS5zdWJzdHJpbmcoZW5kVHlwZU1lZGlhICsgMSksXHJcbiAgICAgICAgc3RhcnRDb2RlY3NJbmZvID0gZXh0ZW5zaW9uLmluZGV4T2YoJzsnKTtcclxuXHJcbiAgICBpZihzdGFydENvZGVjc0luZm8gIT09IC0xKSB7XHJcbiAgICAgICAgZXh0ZW5zaW9uID0gZXh0ZW5zaW9uLnN1YnN0cmluZygwLCBzdGFydENvZGVjc0luZm8pO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBleHRlbnNpb247XHJcbn07XHJcblxyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fc3RhcnRBdWRpb1Byb2Nlc3MgPSBmdW5jdGlvbigpIHtcclxuICAgIGlmKCFRQk1lZGlhUmVjb3JkZXIuX2lzQXVkaW9Db250ZXh0KCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgIGF1ZGlvQ29udGV4dCxcclxuICAgICAgICBhdWRpb0lucHV0LFxyXG4gICAgICAgIHJlY29yZGVyLFxyXG4gICAgICAgIHZvbHVtZTtcclxuXHJcbiAgICBzZWxmLl9jbG9zZUF1ZGlvUHJvY2VzcygpO1xyXG5cclxuICAgIGF1ZGlvQ29udGV4dCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtcclxuICAgIHNlbGYuX2F1ZGlvQ29udGV4dCA9IG5ldyBhdWRpb0NvbnRleHQ7XHJcbiAgICB2b2x1bWUgPSBzZWxmLl9hdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xyXG4gICAgYXVkaW9JbnB1dCA9IHNlbGYuX2F1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzZWxmLl9zdHJlYW0pO1xyXG4gICAgcmVjb3JkZXIgPSBzZWxmLl9hdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKDEwMjQsIDEsIDEpO1xyXG4gICAgYXVkaW9JbnB1dC5jb25uZWN0KHZvbHVtZSk7XHJcblxyXG4gICAgcmVjb3JkZXIub25hdWRpb3Byb2Nlc3MgPSBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgPT09IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzFdKSB7XHJcbiAgICAgICAgICAgIHNlbGYuX2J1ZmZlci5wdXNoKG5ldyBGbG9hdDMyQXJyYXkoZS5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKSkpO1xyXG4gICAgICAgICAgICBzZWxmLl9yZWNvcmRpbmdMZW5ndGggKz0gMTAyNDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHZvbHVtZS5jb25uZWN0KHJlY29yZGVyKTtcclxuICAgIHJlY29yZGVyLmNvbm5lY3Qoc2VsZi5fYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2Nsb3NlQXVkaW9Qcm9jZXNzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYgKCEhc2VsZi5fYXVkaW9Db250ZXh0KSB7XHJcbiAgICAgICAgc2VsZi5fYXVkaW9Db250ZXh0LmNsb3NlKClcclxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9hdWRpb0NvbnRleHQgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fcmVjb3JkaW5nTGVuZ3RoID0gMDtcclxuICAgICAgICAgICAgICAgIHNlbGYuX2J1ZmZlciA9IFtdO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH1cclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3N0b3BBdWRpb1Byb2Nlc3MgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBzZWxmLl9yZWNvcmRlZENodW5rcyA9IHNlbGYuX2dldEJsb2JEYXRhKCk7XHJcbiAgICBzZWxmLl9jbG9zZUF1ZGlvUHJvY2VzcygpO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZW5jb2RlTVAzID0gZnVuY3Rpb24oYnVmZmVyKSB7XHJcbiAgICB2YXIgZGF0YSA9IG5ldyBJbnQxNkFycmF5KGJ1ZmZlciksXHJcbiAgICAgICAgbXAzZW5jb2RlciA9IG5ldyBsYW1lanMuTXAzRW5jb2RlcigxLCA0ODAwMCwgMTI4KSxcclxuICAgICAgICBlbmNvZGVkQnVmZmVyID0gbXAzZW5jb2Rlci5lbmNvZGVCdWZmZXIoZGF0YSksXHJcbiAgICAgICAgZmx1c2hlZEJ1ZmZlciA9IG1wM2VuY29kZXIuZmx1c2goKSxcclxuICAgICAgICBtcDNEYXRhID0gW107XHJcblxyXG4gICAgbXAzRGF0YS5wdXNoKGVuY29kZWRCdWZmZXIpO1xyXG4gICAgbXAzRGF0YS5wdXNoKG5ldyBJbnQ4QXJyYXkoZmx1c2hlZEJ1ZmZlcikpO1xyXG5cclxuICAgIHJldHVybiBtcDNEYXRhO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZW5jb2RlV0FWID0gZnVuY3Rpb24oc2FtcGxlcykge1xyXG4gICAgdmFyIGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig0NCArIHNhbXBsZXMubGVuZ3RoICogMiksXHJcbiAgICAgICAgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xyXG5cclxuICAgIF93cml0ZVN0cmluZyh2aWV3LCAwLCAnUklGRicpO1xyXG4gICAgdmlldy5zZXRVaW50MzIoNCwgMzIgKyBzYW1wbGVzLmxlbmd0aCAqIDIsIHRydWUpO1xyXG4gICAgX3dyaXRlU3RyaW5nKHZpZXcsIDgsICdXQVZFJyk7XHJcbiAgICBfd3JpdGVTdHJpbmcodmlldywgMTIsICdmbXQgJyk7XHJcbiAgICB2aWV3LnNldFVpbnQzMigxNiwgMTYsIHRydWUpO1xyXG4gICAgdmlldy5zZXRVaW50MTYoMjAsIDEsIHRydWUpO1xyXG4gICAgdmlldy5zZXRVaW50MTYoMjIsIDEsIHRydWUpO1xyXG4gICAgdmlldy5zZXRVaW50MzIoMjQsIHRoaXMuc2FtcGxlUmF0ZSwgdHJ1ZSk7XHJcbiAgICB2aWV3LnNldFVpbnQzMigyOCwgdGhpcy5zYW1wbGVSYXRlICogMiwgdHJ1ZSk7XHJcbiAgICB2aWV3LnNldFVpbnQxNigzMiwgMiwgdHJ1ZSk7XHJcbiAgICB2aWV3LnNldFVpbnQxNigzNCwgMTYsIHRydWUpO1xyXG4gICAgX3dyaXRlU3RyaW5nKHZpZXcsIDM2LCAnZGF0YScpO1xyXG4gICAgdmlldy5zZXRVaW50MzIoNDAsIHNhbXBsZXMubGVuZ3RoICogMiwgdHJ1ZSk7XHJcblxyXG4gICAgX2Zsb2F0VG8xNkJpdFBDTSh2aWV3LCA0NCwgc2FtcGxlcyk7XHJcblxyXG4gICAgZnVuY3Rpb24gX2Zsb2F0VG8xNkJpdFBDTShvdXRwdXQsIG9mZnNldCwgaW5wdXQpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aDsgaSsrLCBvZmZzZXQgKz0gMikge1xyXG4gICAgICAgICAgICB2YXIgcyA9IE1hdGgubWF4KC0xLCBNYXRoLm1pbigxLCBpbnB1dFtpXSkpO1xyXG4gICAgICAgICAgICBvdXRwdXQuc2V0SW50MTYob2Zmc2V0LCBzIDwgMCA/IHMgKiAweDgwMDAgOiBzICogMHg3RkZGLCB0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX3dyaXRlU3RyaW5nKHZpZXcsIG9mZnNldCwgc3RyaW5nKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHJpbmcubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdmlldy5zZXRVaW50OChvZmZzZXQgKyBpLCBzdHJpbmcuY2hhckNvZGVBdChpKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB2aWV3O1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0QmxvYkRhdGEgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KHNlbGYuX3JlY29yZGluZ0xlbmd0aCksXHJcbiAgICAgICAgYnVmZmVyTGVuZ3RoID0gc2VsZi5fYnVmZmVyLmxlbmd0aCxcclxuICAgICAgICBvZmZzZXQgPSAwLFxyXG4gICAgICAgIGJ1ZmZlcixcclxuICAgICAgICB2aWV3LFxyXG4gICAgICAgIGRhdGE7XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXJMZW5ndGg7IGkrKyl7XHJcbiAgICAgICAgYnVmZmVyID0gc2VsZi5fYnVmZmVyW2ldO1xyXG4gICAgICAgIHJlc3VsdC5zZXQoYnVmZmVyLCBvZmZzZXQpO1xyXG4gICAgICAgIG9mZnNldCArPSBidWZmZXIubGVuZ3RoO1xyXG4gICAgfVxyXG5cclxuICAgIHZpZXcgPSBzZWxmLl9lbmNvZGVXQVYocmVzdWx0KTtcclxuXHJcbiAgICBzd2l0Y2goc2VsZi5fY3VzdG9tTWltZVR5cGUpIHtcclxuICAgICAgICBjYXNlICdhdWRpby93YXYnOlxyXG4gICAgICAgICAgICBkYXRhID0gW3ZpZXddO1xyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgY2FzZSAnYXVkaW8vbXAzJzpcclxuICAgICAgICAgICAgZGF0YSA9IHNlbGYuX2VuY29kZU1QMyh2aWV3LmJ1ZmZlcik7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydE1lZGlhUmVjb3JkZXJXaXRoT3B0aW9ucyk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBkYXRhO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBRQk1lZGlhUmVjb3JkZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICAnYXVkaW8nOiBbXHJcbiAgICAgICAgJ2F1ZGlvL3dlYm07Y29kZWNzPW9wdXMnLFxyXG4gICAgICAgICdhdWRpby93ZWJtJyxcclxuICAgICAgICAnYXVkaW8vb2dnJyxcclxuICAgICAgICAnYXVkaW8vd2F2JyxcclxuICAgICAgICAnYXVkaW8vbXAzJ1xyXG4gICAgXSxcclxuICAgICd2aWRlbyc6IFtcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9aDI2NCcsXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm07Y29kZWNzPXZwOScsXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm07Y29kZWNzPXZwOCcsXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm07Y29kZWNzPWRhYWxhJyxcclxuICAgICAgICAndmlkZW8vd2VibScsXHJcbiAgICAgICAgJ3ZpZGVvL21wNCcsXHJcbiAgICAgICAgJ3ZpZGVvL21wZWcnXHJcbiAgICBdXHJcbn07Il19
