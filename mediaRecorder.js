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
    'GenericError': 'The UA cannot provide the codec or recording option that has been requested'
};
},{}],2:[function(require,module,exports){
'use strict';

var ERRORS = require('./errors');

/**
 * @constructor QBMediaRecorder
 * @param {Object}   [opts] - Object of parameters.
 * @param {String}   opts[].mimeType=video - Specifies the media type and container format for the recording. You can set simply: 'video' or 'audio' or 'audio/webm' ('audio/wav' or 'audio/mp3' mimeTypes uses AudioContext API instead of MediaRecorder API);
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

    if (typeof self._mediaRecorder.ondataavailable === 'function') {
        self._mediaRecorder.ondataavailable = function(e) {
            if(e.data && e.data.size > 0) {
                self._recordedChunks.push(e.data);
                fireCallback('ondataavailable', e);
            }
        };
    }

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

        if(self._mediaRecorder.state !== 'inactive') {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL21pbWVUeXBlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgJ3Vuc3VwcG9ydCc6ICdRQk1lZGlhUmVjb3JkZXIgaXMgbm90IHN1cHBvcnRlZCB0aGlzIGVudmlyb25tZW50LicsXHJcbiAgICAndW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zJzogJ0dvdCBhIHdhcm5pbmcgd2hlbiBjcmVhdGluZyBhIE1lZGlhUmVjb3JkZXIsIHRyeWluZyB0byBjcmVhdGUgTWVkaWFSZWNvcmRlciB3aXRob3V0IG9wdGlvbnMuJyxcclxuICAgICdyZXF1cmVBcmd1bWVudCc6ICcxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAwIHByZXNlbnQuJyxcclxuICAgICdjYWxsYmFja0Vycm9yJzogJ0ZvdW5kZWQgYW4gZXJyb3IgaW4gY2FsbGJhY2s6JyxcclxuICAgICdhY3Rpb25GYWlsZWQnOiAnUUJNZWRpYVJlY29yZGVyIGlzIG5vdCBjcmVhdGVkIG9yIGhhcyBhbiBpbnZhbGlkIHN0YXRlLicsXHJcbiAgICAnbm9fcmVjb3JkZWRfY2h1bmtzJzogJ0RvZXMgbm90IGhhdmUgYW55IHJlY29yZGluZyBkYXRhLicsXHJcbiAgICAnc3RyZWFtUmVxdWlyZWQnOiAnTWVkaWFTdHJlYW0gaXMgcmVxdWlyZWQuJyxcclxuICAgICdJbnZhbGlkU3RhdGUnOiAnUUJNZWRpYVJlY29yZGVyIGlzIG5vdCBpbiBhIHN0YXRlIGluIHdoaWNoIHRoZSBwcm9wb3NlZCBvcGVyYXRpb24gaXMgYWxsb3dlZCB0byBiZSBleGVjdXRlZC4nLFxyXG4gICAgJ091dE9mTWVtb3J5JzogJ1RoZSBVQSBoYXMgZXhoYXVzZWQgdGhlIGF2YWlsYWJsZSBtZW1vcnkuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJzogJ0EgbW9kaWZpY2F0aW9uIHRvIHRoZSBzdHJlYW0gaGFzIG9jY3VycmVkIHRoYXQgbWFrZXMgaXQgaW1wb3NzaWJsZSB0byBjb250aW51ZSByZWNvcmRpbmcuIEFuIGV4YW1wbGUgd291bGQgYmUgdGhlIGFkZGl0aW9uIG9mIGEgVHJhY2sgd2hpbGUgcmVjb3JkaW5nIGlzIG9jY3VycmluZy4gVXNlciBhZ2VudHMgU0hPVUxEIHByb3ZpZGUgYXMgbXVjaCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlIGluIHRoZSBtZXNzYWdlIGF0dHJpYnV0ZS4nLFxyXG4gICAgJ090aGVyUmVjb3JkaW5nRXJyb3InOiAnVXNlZCBmb3IgYW4gZmF0YWwgZXJyb3Igb3RoZXIgdGhhbiB0aG9zZSBsaXN0ZWQgYWJvdmUuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdHZW5lcmljRXJyb3InOiAnVGhlIFVBIGNhbm5vdCBwcm92aWRlIHRoZSBjb2RlYyBvciByZWNvcmRpbmcgb3B0aW9uIHRoYXQgaGFzIGJlZW4gcmVxdWVzdGVkJ1xyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBFUlJPUlMgPSByZXF1aXJlKCcuL2Vycm9ycycpO1xyXG5cclxuLyoqXHJcbiAqIEBjb25zdHJ1Y3RvciBRQk1lZGlhUmVjb3JkZXJcclxuICogQHBhcmFtIHtPYmplY3R9ICAgW29wdHNdIC0gT2JqZWN0IG9mIHBhcmFtZXRlcnMuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSAgIG9wdHNbXS5taW1lVHlwZT12aWRlbyAtIFNwZWNpZmllcyB0aGUgbWVkaWEgdHlwZSBhbmQgY29udGFpbmVyIGZvcm1hdCBmb3IgdGhlIHJlY29yZGluZy4gWW91IGNhbiBzZXQgc2ltcGx5OiAndmlkZW8nIG9yICdhdWRpbycgb3IgJ2F1ZGlvL3dlYm0nICgnYXVkaW8vd2F2JyBvciAnYXVkaW8vbXAzJyBtaW1lVHlwZXMgdXNlcyBBdWRpb0NvbnRleHQgQVBJIGluc3RlYWQgb2YgTWVkaWFSZWNvcmRlciBBUEkpO1xyXG4gKiBAcGFyYW0ge051bWJlcn0gICBvcHRzW10udGltZXNsaWNlPTEwMDAgLSBUaGUgbWluaW11bSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIG9mIGRhdGEgdG8gcmV0dXJuIGluIGEgc2luZ2xlIEJsb2IsIGZpcmUgJ29uZGF0YWF2YWlibGUnIGNhbGxiYWNrIChpc24ndCBuZWVkIHRvIHVzZSB3aXRoICdhdWRpby93YXYnIG9mICdhdWRpby9tcDMnKS5cclxuICogQHBhcmFtIHtCb29sZWFufSAgb3B0c1tdLmlnbm9yZU11dGVkTWVkaWE9dHJ1ZSAtIFdoYXQgdG8gZG8gd2l0aCBhIG11dGVkIGlucHV0IE1lZGlhU3RyZWFtVHJhY2ssIGUuZy4gaW5zZXJ0IGJsYWNrIGZyYW1lcy96ZXJvIGF1ZGlvIHZvbHVtZSBpbiB0aGUgcmVjb3JkaW5nIG9yIGlnbm9yZSBhbHRvZ2V0aGVyLlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25zdGFydCAtIENhbGxlZCB0byBoYW5kbGUgdGhlIHN0YXJ0IGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25zdG9wIC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgc3RvcCBldmVudC5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0c1tdLm9ucGF1c2UgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBwYXVzZSBldmVudC5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0c1tdLm9ucmVzdW1lIC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgcmVzdW1lIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25lcnJvciAtIENhbGxlZCB0byBoYW5kbGUgYW4gRXJyb3JFdmVudC5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0c1tdLm9uY2hhbmdlIC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgY2hhbmdlIGEgc3RyZWFtIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25kYXRhYXZhaWxhYmxlIC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgZGF0YWF2YWlsYWJsZSBldmVudC4gVGhlIEJsb2Igb2YgcmVjb3JkZWQgZGF0YSBpcyBjb250YWluZWQgaW4gdGhpcyBldmVudCAoQ2FsbGJhY2sgaXNuJ3Qgc3VwcG9ydGVkIGlmIHVzZSAnYXVkaW8vd2F2JyBvZiAnYXVkaW8vbXAzJyBmb3IgcmVjb3JkaW5nKS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogdmFyIG9wdHMgPSB7XHJcbiAqICAgICBvbnN0YXJ0OiBmdW5jdGlvbiBvblN0YXJ0KCkgeyAvLyBVc2UgbmFtZWQgZnVuY3Rpb24uXHJcbiAqICAgICAgICAgY29uc29sZS5sb2coJ1JlY29yZGVyIGlzIHN0YXJ0ZWQnKTtcclxuICogICAgIH0sXHJcbiAqICAgICBvbnN0b3A6IGZ1bmN0aW9uIG9uU3RvcChCbG9iKSB7XHJcbiAqICAgICAgICAgdmlkZW9FbGVtZW50LnNyYyA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcbiAqICAgICB9LFxyXG4gKiAgICAgbWltZVR5cGU6ICd2aWRlby9tcDQnIC8vIFN1cHBvcnRlZCAnYXVkaW8vbXAzJyBpbiBRQk1lZGlhUmVjb3JkZXIgdmVyc2lvbiAwLjMuMC5cclxuICogfTtcclxuICpcclxuICogLy8gdXNlcyBhcyBnbG9iYWwgdmFyaWFibGUsIFFCTWVkaWFSZWNvcmRlciBpcyBidWlsdCBhcyBhIFVNRCBtb2R1bGUuXHJcbiAqIHZhciByZWNvcmRlciA9IG5ldyBRQk1lZGlhUmVjb3JkZXIob3B0cyk7XHJcbiAqXHJcbiAqIEBzZWUgRm9yIHJlY29yZCAnYXVkaW8vbXAzJyBuZWVkIHRvIGNvbm5lY3QgZW5jb2Rlck1QMyAoanVzdCBjb25uZWN0IHtAbGluayBodHRwczovL3d3dy5ucG1qcy5jb20vcGFja2FnZS9sYW1lanN8J2xhbWUuYWxsLmpzJ30gb3Ige0BsaW5rIGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL2xhbWVqc3wnbGFtZS5taW4uanMnfSBmaWxlIHRvIGdsb2JhbCBlbnZpcm9ubWVudCkgYmVmb3JlIGluaXQgUUJNZWRpYVJlY29yZGVyLlxyXG4gKi9cclxuZnVuY3Rpb24gUUJNZWRpYVJlY29yZGVyKG9wdHMpIHtcclxuICAgIHZhciBwcmVmZmVyZWRNaW1lVHlwZSA9IG9wdHMgJiYgb3B0cy5taW1lVHlwZSA/IG9wdHMubWltZVR5cGUgOiBmYWxzZTtcclxuICAgIHRoaXMuX2N1c3RvbU1pbWVUeXBlID0gKHByZWZmZXJlZE1pbWVUeXBlID09PSAnYXVkaW8vd2F2JykgPyAnYXVkaW8vd2F2JyA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIChwcmVmZmVyZWRNaW1lVHlwZSA9PT0gJ2F1ZGlvL21wMycpID8gJ2F1ZGlvL21wMycgOiBmYWxzZTtcclxuXHJcbiAgICBpZighUUJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkgJiYgIXRoaXMuX2N1c3RvbU1pbWVUeXBlKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMubWltZVR5cGUgPSB0aGlzLl9nZXRNaW1lVHlwZShwcmVmZmVyZWRNaW1lVHlwZSk7XHJcbiAgICB0aGlzLnRpbWVzbGljZSA9IG9wdHMgJiYgb3B0cy50aW1lc2xpY2UgJiYgaXNOYU4oK29wdHMudGltZXNsaWNlKSA/IG9wdHMudGltZXNsaWNlIDogMTAwMDtcclxuICAgIHRoaXMuY2FsbGJhY2tzID0gb3B0cyA/IHRoaXMuX2dldENhbGxiYWNrcyhvcHRzKSA6IHt9O1xyXG4gICAgdGhpcy5yZWNvcmRlZEJsb2JzID0gW107XHJcbiAgICB0aGlzLmlnbm9yZU11dGVkTWVkaWEgPSBvcHRzICYmIHR5cGVvZihvcHRzLmlnbm9yZU11dGVkTWVkaWEpID09PSAnYm9vbGVhbicgPyBvcHRzLmlnbm9yZU11dGVkTWVkaWEgOiB0cnVlO1xyXG5cclxuICAgIHRoaXMuX3N0cmVhbSA9IG51bGw7XHJcbiAgICB0aGlzLl9tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuICAgIHRoaXMuX3JlY29yZGVkQ2h1bmtzID0gW107XHJcbiAgICB0aGlzLl9rZWVwUmVjb3JkaW5nID0gZmFsc2U7XHJcblxyXG4gICAgaWYgKHRoaXMuX2N1c3RvbU1pbWVUeXBlKSB7XHJcbiAgICAgICAgdGhpcy5fc2V0Q3VzdG9tUmVjb3JkZXJUb29scygpO1xyXG4gICAgfVxyXG59XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9zZXRDdXN0b21SZWNvcmRlclRvb2xzID0gZnVuY3Rpb24gKCkge1xyXG4gICAgaWYoIVFCTWVkaWFSZWNvcmRlci5faXNBdWRpb0NvbnRleHQoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgc2VsZi5taW1lVHlwZSA9IHNlbGYuX2N1c3RvbU1pbWVUeXBlO1xyXG4gICAgc2VsZi5fYXVkaW9Db250ZXh0ID0gbnVsbDtcclxuICAgIHNlbGYuX2J1ZmZlciA9IFtdO1xyXG4gICAgc2VsZi5fcmVjb3JkaW5nTGVuZ3RoID0gMDtcclxuXHJcbiAgICBpZiAoUUJNZWRpYVJlY29yZGVyLl9pc01wM0VuY29kZXIoKSAmJiB0aGlzLl9jdXN0b21NaW1lVHlwZSA9PT0gJ2F1ZGlvL21wMycpIHtcclxuICAgICAgICBzZWxmLl9tcDNlbmNvZGVyID0gbmV3IGxhbWVqcy5NcDNFbmNvZGVyKDEsIDQ4MDAwLCAxMjgpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0TWltZVR5cGUgPSBmdW5jdGlvbiAocHJlZmZlcmVkKSB7XHJcbiAgICB2YXIgbWltZVR5cGUsXHJcbiAgICAgICAgdHlwZSA9ICd2aWRlbyc7XHJcblxyXG4gICAgaWYocHJlZmZlcmVkICYmIFFCTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQocHJlZmZlcmVkKSkge1xyXG4gICAgICAgIG1pbWVUeXBlID0gcHJlZmZlcmVkO1xyXG4gICAgfSBlbHNlIGlmKHByZWZmZXJlZCkge1xyXG4gICAgICAgIHR5cGUgPSBwcmVmZmVyZWQudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2F1ZGlvJykgPT09IC0xID8gJ3ZpZGVvJyA6ICdhdWRpbyc7XHJcbiAgICAgICAgbWltZVR5cGUgPSBRQk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzKHR5cGUpWzBdO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBtaW1lVHlwZSA9IFFCTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXModHlwZSlbMF07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG1pbWVUeXBlO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0Q2FsbGJhY2tzID0gZnVuY3Rpb24ob3B0cykge1xyXG4gICAgdmFyIGNhbGxiYWNrcyA9IHt9LFxyXG4gICAgICAgIGNhbGxiYWNrTmFtZXMgPSBbJ29uc3RhcnQnLCAnb25zdG9wJywgJ29ucGF1c2UnLCAnb25yZXN1bWUnLCAnb25lcnJvcicsICdvbmNoYW5nZScsICdvbmRhdGFhdmFpbGFibGUnXTtcclxuXHJcbiAgICBjYWxsYmFja05hbWVzLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xyXG4gICAgICAgIGlmIChuYW1lIGluIG9wdHMpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2tzW25hbWVdID0gb3B0c1tuYW1lXTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gY2FsbGJhY2tzO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLl9taW1lVHlwZXMgPSByZXF1aXJlKCcuL21pbWVUeXBlcycpO1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLl9TVEFURVMgPSBbJ2luYWN0aXZlJywgJ3JlY29yZGluZycsICdwYXVzZWQnXTtcclxuXHJcbi8qKlxyXG4gKiBJdCBjaGVja3MgY2FwYWJpbGl0eSBvZiByZWNvcmRpbmcgaW4gdGhlIGVudmlyb25tZW50LlxyXG4gKiBDaGVja3MgTWVkaWFSZWNvcmRlciwgTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQgYW5kIEJsb2IuXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgUUJNZWRpYVJlY29yZGVyIGlzIGF2YWlsYWJsZSBhbmQgY2FuIHJ1biwgb3IgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBpZihRQk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSkge1xyXG4gKiAgICAgLy8gLi4uIHNob3cgVUkgZm9yIHJlY29yZGluZ1xyXG4gKiB9XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiAhISh3aW5kb3cgJiYgd2luZG93Lk1lZGlhUmVjb3JkZXIgJiYgdHlwZW9mIHdpbmRvdy5NZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCA9PT0gJ2Z1bmN0aW9uJyAmJiB3aW5kb3cuQmxvYik7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIuX2lzQXVkaW9Db250ZXh0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuICEhKHdpbmRvdyAmJiAod2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0KSk7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIuX2lzTXAzRW5jb2RlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiAhISh3aW5kb3cgJiYgKHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCkgJiYgd2luZG93LmxhbWVqcyk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJucyBhIEJvb2xlYW4gd2hpY2ggaXMgdHJ1ZSBpZiB0aGUgTUlNRSB0eXBlIHNwZWNpZmllZCBpcyBvbmUgdGhlIHVzZXIgYWdlbnQgY2FuIHJlY29yZC5cclxuICogQHBhcmFtICB7U3RyaW5nfSBtaW1lVHlwZSAtIFRoZSBtaW1lVHlwZSB0byBjaGVjay5cclxuICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgICAtIFRydWUgaWYgdGhlIE1lZGlhUmVjb3JkZXIgaW1wbGVtZW50YXRpb24gaXMgY2FwYWJsZSBvZiByZWNvcmRpbmcgQmxvYiBvYmplY3RzIGZvciB0aGUgc3BlY2lmaWVkIE1JTUUgdHlwZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogaWYoIFFCTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNCcpICkge1xyXG4gKiAgICAgZWwudGV4dENvbnRlbnQgPSAnV2lsbCBiZSByZWNvcmQgaW4gdmlkZW8vbXA0JztcclxuICogfVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCA9IGZ1bmN0aW9uKG1pbWVUeXBlKSB7XHJcbiAgICB2YXIgcmVzdWx0ID0gZmFsc2U7XHJcblxyXG4gICAgaWYoIVFCTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKCFtaW1lVHlwZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMucmVxdXJlQXJndW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaChtaW1lVHlwZSkge1xyXG4gICAgICAgIGNhc2UgJ2F1ZGlvL3dhdic6XHJcbiAgICAgICAgICAgIGlmIChRQk1lZGlhUmVjb3JkZXIuX2lzQXVkaW9Db250ZXh0KCkpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgIGNhc2UgJ2F1ZGlvL21wMyc6XHJcbiAgICAgICAgICAgIGlmIChRQk1lZGlhUmVjb3JkZXIuX2lzQXVkaW9Db250ZXh0KCkgJiYgUUJNZWRpYVJlY29yZGVyLl9pc01wM0VuY29kZXIoKSkge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgcmVzdWx0ID0gd2luZG93Lk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKG1pbWVUeXBlKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gYWxsIHN1cHBvcnRlZCBtaW1lIHR5cGVzIGFuZCBjb250YWluZXIgZm9ybWF0LlxyXG4gKiBAcGFyYW0gIHtTdHJpbmd9IFt0eXBlPXZpZGVvXSBUeXBlIG9mIG1lZGlhLlxyXG4gKiBAcmV0dXJuIHtBcnJheX0gICAgICAgICAgICAgICAgICAgQXJyYXkgb2Ygc3VwcG9ydGVkIG1pbWV0eXBlcy5SZWNvbW1lbmRlZCBtaW1ldHlwZSBoYXMgMCBpbmRleC5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogdmFyIHR5cGUgPSBRQk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzKCdhdWRpbycpO1xyXG4gKiBjb25zb2xlLmluZm8oYENhbGwgd2lsbCByZWNvcmRpbmcgaW4gJHt0eXBlWzBdfWApO1xyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLmdldFN1cHBvcnRlZE1pbWVUeXBlcyA9IGZ1bmN0aW9uKHR5cGUpIHtcclxuICAgIHZhciB0eXBlTWVkaWEgPSB0eXBlIHx8ICd2aWRlbyc7XHJcblxyXG4gICAgaWYoIVFCTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBRQk1lZGlhUmVjb3JkZXIuX21pbWVUeXBlc1t0eXBlTWVkaWFdLmZpbHRlcihmdW5jdGlvbihtaW1lVHlwZSkge1xyXG4gICAgICAgIHJldHVybiBRQk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKG1pbWVUeXBlKTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiB0aGUgY3VycmVudCBbc3RhdGUgb2YgUUJNZWRpYVJlY29yZGVyIGluc3RhbmNlXShodHRwczovL3czYy5naXRodWIuaW8vbWVkaWFjYXB0dXJlLXJlY29yZC9NZWRpYVJlY29yZGVyLmh0bWwjaWRsLWRlZi1yZWNvcmRpbmdzdGF0ZSkuXHJcbiAqIFBvc3NpYmx5IHN0YXRlczogKippbmFjdGl2ZSoqLCAqKnJlY29yZGluZyoqLCAqKnBhdXNlZCoqLlxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IE5hbWUgb2YgYSBzdGF0ZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogdmFyIHJlY29yZGVyID0gbmV3IFFCTWVkaWFSZWNvcmRlcigpO1xyXG4gKiAvLyAuLi5zb21lIGNvZGVcclxuICpcclxuICogaWYocmVjb3JkZXIuZ2V0U3RhdGUoKSA9PSAncmVjb3JkaW5nJykge1xyXG4gKiAgICAgY29uc29sZS5pbmZvKCdZb3UgYXJlIHN0aWxsIHJlY29yZGluZy4nKTtcclxuICogfVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5nZXRTdGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuX21lZGlhUmVjb3JkZXIgPyB0aGlzLl9tZWRpYVJlY29yZGVyLnN0YXRlIDogUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMF07XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIFN0YXJ0IHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogRmlyZSB0aGUgbWV0aG9kIGBzdG9wYCBpZiBhbiBpbnN0YW5jZSBpbnByb2dyZXNzIChoYXMgYSBzdGF0ZSByZWNvcmRpbmcgb3IgcGF1c2VkKS5cclxuICogRmlyZSBvbnN0YXJ0IGNhbGxiYWNrLlxyXG4gKiBAcGFyYW0ge01lZGlhU3RyZWFtfSBzdHJlYW0gLSBTdHJlYW0gb2JqZWN0IHJlcHJlc2VudGluZyBhIGZsdXggb2YgYXVkaW8tIG9yIHZpZGVvLXJlbGF0ZWQgZGF0YS5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciBvcHRpb25zID0ge1xyXG4gKiAgICAgb25zdGFydDogZnVuY3Rpb24gb25TdGFydCgpIHtcclxuICogICAgICAgICB2YXIgdGltZSA9IDAsXHJcbiAqICAgICAgICAgICAgIHN0ZXAgPSAxMDAwO1xyXG4gKiAgICAgICAgIFxyXG4gKiAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gKiAgICAgICAgICAgICB0aW1lICs9IHN0ZXA7XHJcbiAqICAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhgWW91IGFyZSByZWNvcmRpbmcgJHt0aW1lfSBzZWMuYCk7XHJcbiAqICAgICAgICAgfSwgc3RlcCk7XHJcbiAqICAgICB9XHJcbiAqIH1cclxuICpcclxuICogdmFyIHJlYyA9IG5ldyBxYlJlY29yZGVyKG9wdGlvbnMpO1xyXG4gKiAvLyAuLi5cclxuICogcmVjLnN0YXJ0KHN0cmVhbSk7XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oc3RyZWFtKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoIXN0cmVhbSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMucmVxdXJlQXJndW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBtZWRpYVJlY29yZGVyU3RhdGUgPSB0aGlzLmdldFN0YXRlKCk7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlclN0YXRlID09PSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXSB8fCBtZWRpYVJlY29yZGVyU3RhdGUgPT09IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzJdKSB7XHJcbiAgICAgICAgdGhpcy5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYodGhpcy5fc3RyZWFtKSB7XHJcbiAgICAgICAgdGhpcy5fc3RyZWFtID0gbnVsbDtcclxuICAgIH1cclxuICAgIC8vIFRPRE86IG5lZWQgdG8gc3RyZWFtLmNsb25lXHJcbiAgICBzZWxmLl9zdHJlYW0gPSBzdHJlYW07XHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuICAgIHNlbGYuX3JlY29yZGVkQ2h1bmtzLmxlbmd0aCA9IDA7XHJcblxyXG4gICAgaWYgKHNlbGYuX2N1c3RvbU1pbWVUeXBlKSB7XHJcbiAgICAgICAgc2VsZi5fc2V0Q3VzdG9tUmVjb3JkZXIoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2VsZi5fc2V0TWVkaWFSZWNvcmRlcigpO1xyXG4gICAgfVxyXG4gICAgc2VsZi5fc2V0RXZlbnRzKCk7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9zZXRNZWRpYVJlY29yZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyB3aW5kb3cuTWVkaWFSZWNvcmRlcihzZWxmLl9zdHJlYW0sIHtcclxuICAgICAgICAgICAgJ21pbWVUeXBlJzogc2VsZi5taW1lVHlwZSxcclxuICAgICAgICAgICAgJ2lnbm9yZU11dGVkTWVkaWEnOiBzZWxmLmlnbm9yZU11dGVkTWVkaWFcclxuICAgICAgICB9KTtcclxuICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMudW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zLCBlKTtcclxuXHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyB3aW5kb3cuTWVkaWFSZWNvcmRlcihzZWxmLl9zdHJlYW0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fc2V0Q3VzdG9tUmVjb3JkZXIgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBzZWxmLl9jbG9zZUF1ZGlvUHJvY2VzcygpO1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSB7XHJcbiAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzFdO1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fc3RhcnRBdWRpb1Byb2Nlc3MoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMub25zdGFydCgpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgc3RvcDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMF07XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9zdG9wQXVkaW9Qcm9jZXNzKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uc3RvcCgpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgcGF1c2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzJdO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vbnBhdXNlKCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMub25lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICByZXN1bWU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzFdO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vbnJlc3VtZSgpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyogY2FsbGJhY2tzICovXHJcbiAgICAgICAgb25zdGFydDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnN0YXRlICE9PSAncmVjb3JkaW5nJykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzFdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgb25zdG9wOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGUgIT09ICdpbmFjdGl2ZScpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1swXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIG9ucGF1c2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zdGF0ZSAhPT0gJ3BhdXNlZCcpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1syXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIG9ucmVzdW1lOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGUgIT09ICdyZWNvcmRpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBvbmVycm9yOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHNlbGYuX2Nsb3NlQXVkaW9Qcm9jZXNzKCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fc2V0RXZlbnRzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgZnVuY3Rpb24gZmlyZUNhbGxiYWNrKG5hbWUsIGFyZ3MpIHtcclxuICAgICAgICBpZihPYmplY3Qua2V5cyhzZWxmLmNhbGxiYWNrcykubGVuZ3RoICE9PSAwICYmIHR5cGVvZiBzZWxmLmNhbGxiYWNrc1tuYW1lXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5jYWxsYmFja3NbbmFtZV0oYXJncyk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRm91bmRlZCBhbiBlcnJvciBpbiBjYWxsYmFjazonICsgbmFtZSwgZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHR5cGVvZiBzZWxmLl9tZWRpYVJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25kYXRhYXZhaWxhYmxlID0gZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBpZihlLmRhdGEgJiYgZS5kYXRhLnNpemUgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9yZWNvcmRlZENodW5rcy5wdXNoKGUuZGF0YSk7XHJcbiAgICAgICAgICAgICAgICBmaXJlQ2FsbGJhY2soJ29uZGF0YWF2YWlsYWJsZScsIGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9ucGF1c2UgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBmaXJlQ2FsbGJhY2soJ29ucGF1c2UnKTtcclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnJlc3VtZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGZpcmVDYWxsYmFjaygnb25yZXN1bWUnKTtcclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbmVycm9yID0gZnVuY3Rpb24oZXJyb3IpIHtcclxuICAgICAgICBzd2l0Y2goZXJyb3IubmFtZSkge1xyXG4gICAgICAgICAgICBjYXNlICdJbnZhbGlkU3RhdGUnOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdPdXRPZk1lbW9yeSc6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ0lsbGVnYWxTdHJlYW1Nb2RpZmljYXRpb24nOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdPdGhlclJlY29yZGluZ0Vycm9yJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnR2VuZXJpY0Vycm9yJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ01lZGlhUmVjb3JkZXIgRXJyb3InLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgIT09ICdpbmFjdGl2ZScpIHtcclxuICAgICAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZihzZWxmLl91c2VyQ2FsbGJhY2tzICYmIHR5cGVvZiBzZWxmLl91c2VyQ2FsbGJhY2tzLm9uRXJyb3JSZWNvcmRpbmcgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvbmVycm9yJywgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgYmxvYiA9IG5ldyBCbG9iKHNlbGYuX3JlY29yZGVkQ2h1bmtzLCB7XHJcbiAgICAgICAgICAgICd0eXBlJyA6IHNlbGYubWltZVR5cGVcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgc2VsZi5yZWNvcmRlZEJsb2JzLnB1c2goYmxvYik7XHJcblxyXG4gICAgICAgIGlmKCFzZWxmLl9rZWVwUmVjb3JkaW5nKSB7XHJcbiAgICAgICAgICAgIGlmKHNlbGYucmVjb3JkZWRCbG9icy5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgICAgICBmaXJlQ2FsbGJhY2soJ29uc3RvcCcsIGJsb2IpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvbnN0b3AnLCBzZWxmLnJlY29yZGVkQmxvYnNbMF0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBzZWxmLl9rZWVwUmVjb3JkaW5nID0gZmFsc2U7XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhcnQoc2VsZi50aW1lc2xpY2UpO1xyXG5cclxuICAgIGZpcmVDYWxsYmFjaygnb25zdGFydCcpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFN0b3AgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBAcmV0dXJuIHtCbG9ifSBCbG9iIG9mIHJlY29yZGVkIGNodW5ja3MuXHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBtZWRpYVJlY29yZGVyID0gdGhpcy5fbWVkaWFSZWNvcmRlcixcclxuICAgICAgICBtZWRpYVJlY29yZGVyU3RhdGUgPSBtZWRpYVJlY29yZGVyICYmIG1lZGlhUmVjb3JkZXIuc3RhdGUgPyBtZWRpYVJlY29yZGVyLnN0YXRlIDogJ2luYWN0aXZlJztcclxuXHJcbiAgICBpZihtZWRpYVJlY29yZGVyICYmIChtZWRpYVJlY29yZGVyU3RhdGUgPT09ICdyZWNvcmRpbmcnIHx8IG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gJ3BhdXNlZCcpKXtcclxuICAgICAgICBtZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5hY3Rpb25GYWlsZWQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFBhdXNlIHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlciAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSAncmVjb3JkaW5nJykge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIucGF1c2UoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5hY3Rpb25GYWlsZWQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlc3VtZSB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZihzZWxmLl9tZWRpYVJlY29yZGVyICYmIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgPT09ICdwYXVzZWQnKSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5yZXN1bWUoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5hY3Rpb25GYWlsZWQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIENoYW5nZSBhIHJlY29yZGVkIHN0cmVhbS5cclxuICogQHBhcmFtIHtNZWRpYVN0cmVhbX0gc3RyZWFtIC0gU3RyZWFtIG9iamVjdCByZXByZXNlbnRpbmcgYSBmbHV4IG9mIGF1ZGlvLSBvciB2aWRlby1yZWxhdGVkIGRhdGEuXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5jaGFuZ2UgPSBmdW5jdGlvbihzdHJlYW0pIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZighc3RyZWFtKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy5yZXF1cmVBcmd1bWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fa2VlcFJlY29yZGluZyA9IHRydWU7IC8vIGRvbid0IHN0b3AgYSByZWNvcmRcclxuICAgIHNlbGYuc3RvcCgpO1xyXG5cclxuICAgIHNlbGYuX3N0cmVhbSA9IG51bGw7XHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuXHJcbiAgICAvLyBUT0RPIHN0cmVhbS5jbG9uZVxyXG4gICAgc2VsZi5fc3RyZWFtID0gc3RyZWFtO1xyXG5cclxuICAgIGlmIChzZWxmLl9jdXN0b21NaW1lVHlwZSkge1xyXG4gICAgICAgIHNlbGYuX3NldEN1c3RvbVJlY29yZGVyKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHNlbGYuX3NldE1lZGlhUmVjb3JkZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBzZWxmLl9zZXRFdmVudHMoKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYSBmaWxlIGZyb20gYmxvYiBhbmQgZG93bmxvYWQgYXMgdGhlIGZpbGUuIEl0cyBtZXRob2Qgd2lsbCBmaXJlICdzdG9wJyBpZiByZWNvcmRpbmcgaW4gcHJvZ3Jlc3MuXHJcbiAqIEBwYXJhbSB7U3RyaW50fSBbZmlsZU5hbWU9RGF0ZS5ub3coKV0gLSBOYW1lIG9mIGZpbGUuXHJcbiAqIEBwYXJhbSB7QmxvYn0gICBbYmxvYl0gLSBZb3UgY2FuIHNldCBibG9iIHdoaWNoIHlvdSBnZXQgZnJvbSB0aGUgbWV0aG9kIGBzdG9wYCBvciBkb24ndCBzZXQgYW55dGhpbmcgYW5kIHdlIHdpbGwgZ2V0IHJlY29yZGVkIGNodW5ja3MuXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgcmVjID0gbmV3IHFiUmVjb3JkZXIoKTtcclxuICogcmVjLnN0YXJ0KHN0cmVhbSk7XHJcbiAqIC8vIC4uLlxyXG4gKiByZWMuZG93bmxvYWQoZmFsc2UpOyAvLyBTZXQgZmFsc2UsIG5hbWUgd2lsbCBiZSBnZW5lcmF0ZWQgYmFzZWQgb24gRGF0ZS5ub3coKVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5kb3dubG9hZCA9IGZ1bmN0aW9uKGZpbGVOYW1lLCBibG9iKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IHRoaXMuZ2V0U3RhdGUoKTtcclxuXHJcbiAgICBpZihtZWRpYVJlY29yZGVyU3RhdGUgPT09IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzFdIHx8IG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMl0pIHtcclxuICAgICAgICB0aGlzLl9tZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgdXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iIHx8IHNlbGYuX2dldEJsb2JSZWNvcmRlZCgpKSxcclxuICAgICAgICBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG5cclxuICAgIGEuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgIGEuaHJlZiA9IHVybDtcclxuICAgIGEuZG93bmxvYWQgPSAoZmlsZU5hbWUgfHwgRGF0ZS5ub3coKSkgKyAnLicgKyBzZWxmLl9nZXRFeHRlbnNpb24oKTtcclxuXHJcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGEpO1xyXG5cclxuICAgIC8vIFN0YXJ0IGRvd2xvYWRpbmdcclxuICAgIGEuY2xpY2soKTtcclxuXHJcbiAgICAvLyBSZW1vdmUgbGlua1xyXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xyXG4gICAgICAgIHdpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XHJcbiAgICB9LCAxMDApO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIEJsb2IgZnJvbSByZWNvcmRlZCBjaHVua3MuXHJcbiAqIEBhY2Nlc3MgcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge09iamVjdH0gW2RhdGFdIC0gUmVjb3JkZWQgZGF0YS5cclxuICogQHJldHVybiB7T2JqZWN0fSAtIEJsb2Igb2YgcmVjb3JkZWQgbWVkaWEgb3Igd2hhdCB5b3Ugc2V0IGluIGRhdGFcclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldEJsb2JSZWNvcmRlZCA9IGZ1bmN0aW9uKGRhdGEpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICBjaHVua3MgPSBkYXRhIHx8IHNlbGYuX3JlY29yZGVkQ2h1bmtzO1xyXG5cclxuICAgIGlmKCFjaHVua3MubGVuZ3RoKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5ub19yZWNvcmRlZF9jaHVua3MpO1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbmV3IEJsb2IoY2h1bmtzLCB7ICd0eXBlJyA6IHNlbGYubWltZVR5cGUgfSk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJuIGEgZXh0ZW5zaW9uIG9mIGEgZmlsZS4gQmFzZWQgb24gYXZhaWxhYmxlIG1pbWVUeXBlLlxyXG4gKiBAYWNjZXNzIHByaXZhdGVcclxuICogQHJldHVybiB7U3RyaW5nfSBGb3IgZXhhbXBsZSwgJ3dlYm0nIC8gJ21wNCcgLyAnb2dnJ1xyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0RXh0ZW5zaW9uID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIGVuZFR5cGVNZWRpYSA9IHNlbGYubWltZVR5cGUuaW5kZXhPZignLycpLFxyXG4gICAgICAgIGV4dGVuc2lvbiA9IHNlbGYubWltZVR5cGUuc3Vic3RyaW5nKGVuZFR5cGVNZWRpYSArIDEpLFxyXG4gICAgICAgIHN0YXJ0Q29kZWNzSW5mbyA9IGV4dGVuc2lvbi5pbmRleE9mKCc7Jyk7XHJcblxyXG4gICAgaWYoc3RhcnRDb2RlY3NJbmZvICE9PSAtMSkge1xyXG4gICAgICAgIGV4dGVuc2lvbiA9IGV4dGVuc2lvbi5zdWJzdHJpbmcoMCwgc3RhcnRDb2RlY3NJbmZvKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZXh0ZW5zaW9uO1xyXG59O1xyXG5cclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3N0YXJ0QXVkaW9Qcm9jZXNzID0gZnVuY3Rpb24oKSB7XHJcbiAgICBpZighUUJNZWRpYVJlY29yZGVyLl9pc0F1ZGlvQ29udGV4dCgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICBhdWRpb0NvbnRleHQsXHJcbiAgICAgICAgYXVkaW9JbnB1dCxcclxuICAgICAgICByZWNvcmRlcixcclxuICAgICAgICB2b2x1bWU7XHJcblxyXG4gICAgc2VsZi5fY2xvc2VBdWRpb1Byb2Nlc3MoKTtcclxuXHJcbiAgICBhdWRpb0NvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQ7XHJcbiAgICBzZWxmLl9hdWRpb0NvbnRleHQgPSBuZXcgYXVkaW9Db250ZXh0O1xyXG4gICAgdm9sdW1lID0gc2VsZi5fYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcclxuICAgIGF1ZGlvSW5wdXQgPSBzZWxmLl9hdWRpb0NvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc2VsZi5fc3RyZWFtKTtcclxuICAgIHJlY29yZGVyID0gc2VsZi5fYXVkaW9Db250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3NvcigxMDI0LCAxLCAxKTtcclxuICAgIGF1ZGlvSW5wdXQuY29ubmVjdCh2b2x1bWUpO1xyXG5cclxuICAgIHJlY29yZGVyLm9uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmIChzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXSkge1xyXG4gICAgICAgICAgICBzZWxmLl9idWZmZXIucHVzaChuZXcgRmxvYXQzMkFycmF5KGUuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCkpKTtcclxuICAgICAgICAgICAgc2VsZi5fcmVjb3JkaW5nTGVuZ3RoICs9IDEwMjQ7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB2b2x1bWUuY29ubmVjdChyZWNvcmRlcik7XHJcbiAgICByZWNvcmRlci5jb25uZWN0KHNlbGYuX2F1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9jbG9zZUF1ZGlvUHJvY2VzcyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmICghIXNlbGYuX2F1ZGlvQ29udGV4dCkge1xyXG4gICAgICAgIHNlbGYuX2F1ZGlvQ29udGV4dC5jbG9zZSgpXHJcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fYXVkaW9Db250ZXh0ID0gbnVsbDtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3JlY29yZGluZ0xlbmd0aCA9IDA7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9idWZmZXIgPSBbXTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9zdG9wQXVkaW9Qcm9jZXNzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgc2VsZi5fcmVjb3JkZWRDaHVua3MgPSBzZWxmLl9nZXRCbG9iRGF0YSgpO1xyXG4gICAgc2VsZi5fY2xvc2VBdWRpb1Byb2Nlc3MoKTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2VuY29kZU1QMyA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xyXG4gICAgdmFyIGRhdGEgPSBuZXcgSW50MTZBcnJheShidWZmZXIpLFxyXG4gICAgICAgIG1wM2VuY29kZXIgPSBuZXcgbGFtZWpzLk1wM0VuY29kZXIoMSwgNDgwMDAsIDEyOCksXHJcbiAgICAgICAgZW5jb2RlZEJ1ZmZlciA9IG1wM2VuY29kZXIuZW5jb2RlQnVmZmVyKGRhdGEpLFxyXG4gICAgICAgIGZsdXNoZWRCdWZmZXIgPSBtcDNlbmNvZGVyLmZsdXNoKCksXHJcbiAgICAgICAgbXAzRGF0YSA9IFtdO1xyXG5cclxuICAgIG1wM0RhdGEucHVzaChlbmNvZGVkQnVmZmVyKTtcclxuICAgIG1wM0RhdGEucHVzaChuZXcgSW50OEFycmF5KGZsdXNoZWRCdWZmZXIpKTtcclxuXHJcbiAgICByZXR1cm4gbXAzRGF0YTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2VuY29kZVdBViA9IGZ1bmN0aW9uKHNhbXBsZXMpIHtcclxuICAgIHZhciBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoNDQgKyBzYW1wbGVzLmxlbmd0aCAqIDIpLFxyXG4gICAgICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKTtcclxuXHJcbiAgICBfd3JpdGVTdHJpbmcodmlldywgMCwgJ1JJRkYnKTtcclxuICAgIHZpZXcuc2V0VWludDMyKDQsIDMyICsgc2FtcGxlcy5sZW5ndGggKiAyLCB0cnVlKTtcclxuICAgIF93cml0ZVN0cmluZyh2aWV3LCA4LCAnV0FWRScpO1xyXG4gICAgX3dyaXRlU3RyaW5nKHZpZXcsIDEyLCAnZm10ICcpO1xyXG4gICAgdmlldy5zZXRVaW50MzIoMTYsIDE2LCB0cnVlKTtcclxuICAgIHZpZXcuc2V0VWludDE2KDIwLCAxLCB0cnVlKTtcclxuICAgIHZpZXcuc2V0VWludDE2KDIyLCAxLCB0cnVlKTtcclxuICAgIHZpZXcuc2V0VWludDMyKDI0LCB0aGlzLnNhbXBsZVJhdGUsIHRydWUpO1xyXG4gICAgdmlldy5zZXRVaW50MzIoMjgsIHRoaXMuc2FtcGxlUmF0ZSAqIDIsIHRydWUpO1xyXG4gICAgdmlldy5zZXRVaW50MTYoMzIsIDIsIHRydWUpO1xyXG4gICAgdmlldy5zZXRVaW50MTYoMzQsIDE2LCB0cnVlKTtcclxuICAgIF93cml0ZVN0cmluZyh2aWV3LCAzNiwgJ2RhdGEnKTtcclxuICAgIHZpZXcuc2V0VWludDMyKDQwLCBzYW1wbGVzLmxlbmd0aCAqIDIsIHRydWUpO1xyXG5cclxuICAgIF9mbG9hdFRvMTZCaXRQQ00odmlldywgNDQsIHNhbXBsZXMpO1xyXG5cclxuICAgIGZ1bmN0aW9uIF9mbG9hdFRvMTZCaXRQQ00ob3V0cHV0LCBvZmZzZXQsIGlucHV0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGg7IGkrKywgb2Zmc2V0ICs9IDIpIHtcclxuICAgICAgICAgICAgdmFyIHMgPSBNYXRoLm1heCgtMSwgTWF0aC5taW4oMSwgaW5wdXRbaV0pKTtcclxuICAgICAgICAgICAgb3V0cHV0LnNldEludDE2KG9mZnNldCwgcyA8IDAgPyBzICogMHg4MDAwIDogcyAqIDB4N0ZGRiwgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF93cml0ZVN0cmluZyh2aWV3LCBvZmZzZXQsIHN0cmluZykge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyaW5nLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZpZXcuc2V0VWludDgob2Zmc2V0ICsgaSwgc3RyaW5nLmNoYXJDb2RlQXQoaSkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdmlldztcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldEJsb2JEYXRhID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgcmVzdWx0ID0gbmV3IEZsb2F0MzJBcnJheShzZWxmLl9yZWNvcmRpbmdMZW5ndGgpLFxyXG4gICAgICAgIGJ1ZmZlckxlbmd0aCA9IHNlbGYuX2J1ZmZlci5sZW5ndGgsXHJcbiAgICAgICAgb2Zmc2V0ID0gMCxcclxuICAgICAgICBidWZmZXIsXHJcbiAgICAgICAgdmlldyxcclxuICAgICAgICBkYXRhO1xyXG5cclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyTGVuZ3RoOyBpKyspe1xyXG4gICAgICAgIGJ1ZmZlciA9IHNlbGYuX2J1ZmZlcltpXTtcclxuICAgICAgICByZXN1bHQuc2V0KGJ1ZmZlciwgb2Zmc2V0KTtcclxuICAgICAgICBvZmZzZXQgKz0gYnVmZmVyLmxlbmd0aDtcclxuICAgIH1cclxuXHJcbiAgICB2aWV3ID0gc2VsZi5fZW5jb2RlV0FWKHJlc3VsdCk7XHJcblxyXG4gICAgc3dpdGNoKHNlbGYuX2N1c3RvbU1pbWVUeXBlKSB7XHJcbiAgICAgICAgY2FzZSAnYXVkaW8vd2F2JzpcclxuICAgICAgICAgICAgZGF0YSA9IFt2aWV3XTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgIGNhc2UgJ2F1ZGlvL21wMyc6XHJcbiAgICAgICAgICAgIGRhdGEgPSBzZWxmLl9lbmNvZGVNUDModmlldy5idWZmZXIpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnRNZWRpYVJlY29yZGVyV2l0aE9wdGlvbnMpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZGF0YTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUUJNZWRpYVJlY29yZGVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgJ2F1ZGlvJzogW1xyXG4gICAgICAgICdhdWRpby93ZWJtO2NvZGVjcz1vcHVzJyxcclxuICAgICAgICAnYXVkaW8vd2VibScsXHJcbiAgICAgICAgJ2F1ZGlvL29nZycsXHJcbiAgICAgICAgJ2F1ZGlvL3dhdicsXHJcbiAgICAgICAgJ2F1ZGlvL21wMydcclxuICAgIF0sXHJcbiAgICAndmlkZW8nOiBbXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm07Y29kZWNzPWgyNjQnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDknLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDgnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1kYWFsYScsXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm0nLFxyXG4gICAgICAgICd2aWRlby9tcDQnLFxyXG4gICAgICAgICd2aWRlby9tcGVnJ1xyXG4gICAgXVxyXG59OyJdfQ==
