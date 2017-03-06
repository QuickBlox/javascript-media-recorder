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

    self._buffer = [];
    self._recordingLength = 0;

    if (QBMediaRecorder._isMp3Encoder() && this._customMimeType === 'audio/mp3') {
        self._mp3encoder = new lamejs.Mp3Encoder(1, 48000, 256);
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
    recorder = self._audioContext.createScriptProcessor(self.BUFFER_SIZE, self.INPUT_CHANNELS, self.OUTPUT_CHANNELS);
    audioInput.connect(volume);

    recorder.onaudioprocess = function(e) {
        if (self._mediaRecorder.state === QBMediaRecorder._STATES[1]) {
            self._buffer.push(new Float32Array(e.inputBuffer.getChannelData(0)));
            self._recordingLength += self.BUFFER_SIZE;
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
    var self = this,
        data = new Int16Array(buffer),
        encodedBuffer = self._mp3encoder.encodeBuffer(data),
        flushedBuffer = self._mp3encoder.flush(),
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL21pbWVUeXBlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3h1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgICd1bnN1cHBvcnQnOiAnUUJNZWRpYVJlY29yZGVyIGlzIG5vdCBzdXBwb3J0ZWQgdGhpcyBlbnZpcm9ubWVudC4nLFxyXG4gICAgJ3Vuc3VwcG9ydE1lZGlhUmVjb3JkZXJXaXRoT3B0aW9ucyc6ICdHb3QgYSB3YXJuaW5nIHdoZW4gY3JlYXRpbmcgYSBNZWRpYVJlY29yZGVyLCB0cnlpbmcgdG8gY3JlYXRlIE1lZGlhUmVjb3JkZXIgd2l0aG91dCBvcHRpb25zLicsXHJcbiAgICAncmVxdXJlQXJndW1lbnQnOiAnMSBhcmd1bWVudCByZXF1aXJlZCwgYnV0IG9ubHkgMCBwcmVzZW50LicsXHJcbiAgICAnY2FsbGJhY2tFcnJvcic6ICdGb3VuZGVkIGFuIGVycm9yIGluIGNhbGxiYWNrOicsXHJcbiAgICAnYWN0aW9uRmFpbGVkJzogJ1FCTWVkaWFSZWNvcmRlciBpcyBub3QgY3JlYXRlZCBvciBoYXMgYW4gaW52YWxpZCBzdGF0ZS4nLFxyXG4gICAgJ25vX3JlY29yZGVkX2NodW5rcyc6ICdEb2VzIG5vdCBoYXZlIGFueSByZWNvcmRpbmcgZGF0YS4nLFxyXG4gICAgJ3N0cmVhbVJlcXVpcmVkJzogJ01lZGlhU3RyZWFtIGlzIHJlcXVpcmVkLicsXHJcbiAgICAnSW52YWxpZFN0YXRlJzogJ1FCTWVkaWFSZWNvcmRlciBpcyBub3QgaW4gYSBzdGF0ZSBpbiB3aGljaCB0aGUgcHJvcG9zZWQgb3BlcmF0aW9uIGlzIGFsbG93ZWQgdG8gYmUgZXhlY3V0ZWQuJyxcclxuICAgICdPdXRPZk1lbW9yeSc6ICdUaGUgVUEgaGFzIGV4aGF1c2VkIHRoZSBhdmFpbGFibGUgbWVtb3J5LiBVc2VyIGFnZW50cyBTSE9VTEQgcHJvdmlkZSBhcyBtdWNoIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYXMgcG9zc2libGUgaW4gdGhlIG1lc3NhZ2UgYXR0cmlidXRlLicsXHJcbiAgICAnSWxsZWdhbFN0cmVhbU1vZGlmaWNhdGlvbic6ICdBIG1vZGlmaWNhdGlvbiB0byB0aGUgc3RyZWFtIGhhcyBvY2N1cnJlZCB0aGF0IG1ha2VzIGl0IGltcG9zc2libGUgdG8gY29udGludWUgcmVjb3JkaW5nLiBBbiBleGFtcGxlIHdvdWxkIGJlIHRoZSBhZGRpdGlvbiBvZiBhIFRyYWNrIHdoaWxlIHJlY29yZGluZyBpcyBvY2N1cnJpbmcuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdPdGhlclJlY29yZGluZ0Vycm9yJzogJ1VzZWQgZm9yIGFuIGZhdGFsIGVycm9yIG90aGVyIHRoYW4gdGhvc2UgbGlzdGVkIGFib3ZlLiBVc2VyIGFnZW50cyBTSE9VTEQgcHJvdmlkZSBhcyBtdWNoIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYXMgcG9zc2libGUgaW4gdGhlIG1lc3NhZ2UgYXR0cmlidXRlLicsXHJcbiAgICAnR2VuZXJpY0Vycm9yJzogJ1RoZSBVQSBjYW5ub3QgcHJvdmlkZSB0aGUgY29kZWMgb3IgcmVjb3JkaW5nIG9wdGlvbiB0aGF0IGhhcyBiZWVuIHJlcXVlc3RlZCdcclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRVJST1JTID0gcmVxdWlyZSgnLi9lcnJvcnMnKTtcclxuXHJcbi8qKlxyXG4gKiBAY29uc3RydWN0b3IgUUJNZWRpYVJlY29yZGVyXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSAgIFtvcHRzXSAtIE9iamVjdCBvZiBwYXJhbWV0ZXJzLlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gICBvcHRzW10ubWltZVR5cGU9dmlkZW8gLSBTcGVjaWZpZXMgdGhlIG1lZGlhIHR5cGUgYW5kIGNvbnRhaW5lciBmb3JtYXQgZm9yIHRoZSByZWNvcmRpbmcuIFlvdSBjYW4gc2V0IHNpbXBseTogJ3ZpZGVvJyBvciAnYXVkaW8nIG9yICdhdWRpby93ZWJtJyAoJ2F1ZGlvL3dhdicgb3IgJ2F1ZGlvL21wMycgbWltZVR5cGVzIHVzZXMgQXVkaW9Db250ZXh0IEFQSSBpbnN0ZWFkIG9mIE1lZGlhUmVjb3JkZXIgQVBJKTtcclxuICogQHBhcmFtIHtOdW1iZXJ9ICAgb3B0c1tdLnRpbWVzbGljZT0xMDAwIC0gVGhlIG1pbmltdW0gbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyBvZiBkYXRhIHRvIHJldHVybiBpbiBhIHNpbmdsZSBCbG9iLCBmaXJlICdvbmRhdGFhdmFpYmxlJyBjYWxsYmFjayAoaXNuJ3QgbmVlZCB0byB1c2Ugd2l0aCAnYXVkaW8vd2F2JyBvZiAnYXVkaW8vbXAzJykuXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gIG9wdHNbXS5pZ25vcmVNdXRlZE1lZGlhPXRydWUgLSBXaGF0IHRvIGRvIHdpdGggYSBtdXRlZCBpbnB1dCBNZWRpYVN0cmVhbVRyYWNrLCBlLmcuIGluc2VydCBibGFjayBmcmFtZXMvemVybyBhdWRpbyB2b2x1bWUgaW4gdGhlIHJlY29yZGluZyBvciBpZ25vcmUgYWx0b2dldGhlci5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0c1tdLm9uc3RhcnQgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBzdGFydCBldmVudC5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0c1tdLm9uc3RvcCAtIENhbGxlZCB0byBoYW5kbGUgdGhlIHN0b3AgZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbnBhdXNlIC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgcGF1c2UgZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbnJlc3VtZSAtIENhbGxlZCB0byBoYW5kbGUgdGhlIHJlc3VtZSBldmVudC5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0c1tdLm9uZXJyb3IgLSBDYWxsZWQgdG8gaGFuZGxlIGFuIEVycm9yRXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbmNoYW5nZSAtIENhbGxlZCB0byBoYW5kbGUgdGhlIGNoYW5nZSBhIHN0cmVhbSBldmVudC5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0c1tdLm9uZGF0YWF2YWlsYWJsZSAtIENhbGxlZCB0byBoYW5kbGUgdGhlIGRhdGFhdmFpbGFibGUgZXZlbnQuIFRoZSBCbG9iIG9mIHJlY29yZGVkIGRhdGEgaXMgY29udGFpbmVkIGluIHRoaXMgZXZlbnQgKENhbGxiYWNrIGlzbid0IHN1cHBvcnRlZCBpZiB1c2UgJ2F1ZGlvL3dhdicgb2YgJ2F1ZGlvL21wMycgZm9yIHJlY29yZGluZykuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciBvcHRzID0ge1xyXG4gKiAgICAgb25zdGFydDogZnVuY3Rpb24gb25TdGFydCgpIHsgLy8gVXNlIG5hbWVkIGZ1bmN0aW9uLlxyXG4gKiAgICAgICAgIGNvbnNvbGUubG9nKCdSZWNvcmRlciBpcyBzdGFydGVkJyk7XHJcbiAqICAgICB9LFxyXG4gKiAgICAgb25zdG9wOiBmdW5jdGlvbiBvblN0b3AoQmxvYikge1xyXG4gKiAgICAgICAgIHZpZGVvRWxlbWVudC5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xyXG4gKiAgICAgfSxcclxuICogICAgIG1pbWVUeXBlOiAndmlkZW8vbXA0JyAvLyBTdXBwb3J0ZWQgJ2F1ZGlvL21wMycgaW4gUUJNZWRpYVJlY29yZGVyIHZlcnNpb24gMC4zLjAuXHJcbiAqIH07XHJcbiAqXHJcbiAqIC8vIHVzZXMgYXMgZ2xvYmFsIHZhcmlhYmxlLCBRQk1lZGlhUmVjb3JkZXIgaXMgYnVpbHQgYXMgYSBVTUQgbW9kdWxlLlxyXG4gKiB2YXIgcmVjb3JkZXIgPSBuZXcgUUJNZWRpYVJlY29yZGVyKG9wdHMpO1xyXG4gKlxyXG4gKiBAc2VlIEZvciByZWNvcmQgJ2F1ZGlvL21wMycgbmVlZCB0byBjb25uZWN0IGVuY29kZXJNUDMgKGp1c3QgY29ubmVjdCB7QGxpbmsgaHR0cHM6Ly93d3cubnBtanMuY29tL3BhY2thZ2UvbGFtZWpzfCdsYW1lLmFsbC5qcyd9IG9yIHtAbGluayBodHRwczovL3d3dy5ucG1qcy5jb20vcGFja2FnZS9sYW1lanN8J2xhbWUubWluLmpzJ30gZmlsZSB0byBnbG9iYWwgZW52aXJvbm1lbnQpIGJlZm9yZSBpbml0IFFCTWVkaWFSZWNvcmRlci5cclxuICovXHJcbmZ1bmN0aW9uIFFCTWVkaWFSZWNvcmRlcihvcHRzKSB7XHJcbiAgICB2YXIgcHJlZmZlcmVkTWltZVR5cGUgPSBvcHRzICYmIG9wdHMubWltZVR5cGUgPyBvcHRzLm1pbWVUeXBlIDogZmFsc2U7XHJcbiAgICB0aGlzLl9jdXN0b21NaW1lVHlwZSA9IChwcmVmZmVyZWRNaW1lVHlwZSA9PT0gJ2F1ZGlvL3dhdicpID8gJ2F1ZGlvL3dhdicgOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAocHJlZmZlcmVkTWltZVR5cGUgPT09ICdhdWRpby9tcDMnKSA/ICdhdWRpby9tcDMnIDogZmFsc2U7XHJcblxyXG4gICAgaWYoIVFCTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpICYmICF0aGlzLl9jdXN0b21NaW1lVHlwZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLm1pbWVUeXBlID0gdGhpcy5fZ2V0TWltZVR5cGUocHJlZmZlcmVkTWltZVR5cGUpO1xyXG4gICAgdGhpcy50aW1lc2xpY2UgPSBvcHRzICYmIG9wdHMudGltZXNsaWNlICYmIGlzTmFOKCtvcHRzLnRpbWVzbGljZSkgPyBvcHRzLnRpbWVzbGljZSA6IDEwMDA7XHJcbiAgICB0aGlzLmNhbGxiYWNrcyA9IG9wdHMgPyB0aGlzLl9nZXRDYWxsYmFja3Mob3B0cykgOiB7fTtcclxuICAgIHRoaXMucmVjb3JkZWRCbG9icyA9IFtdO1xyXG4gICAgdGhpcy5pZ25vcmVNdXRlZE1lZGlhID0gb3B0cyAmJiB0eXBlb2Yob3B0cy5pZ25vcmVNdXRlZE1lZGlhKSA9PT0gJ2Jvb2xlYW4nID8gb3B0cy5pZ25vcmVNdXRlZE1lZGlhIDogdHJ1ZTtcclxuXHJcbiAgICB0aGlzLl9zdHJlYW0gPSBudWxsO1xyXG4gICAgdGhpcy5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcbiAgICB0aGlzLl9yZWNvcmRlZENodW5rcyA9IFtdO1xyXG4gICAgdGhpcy5fa2VlcFJlY29yZGluZyA9IGZhbHNlO1xyXG5cclxuICAgIGlmICh0aGlzLl9jdXN0b21NaW1lVHlwZSkge1xyXG4gICAgICAgIHRoaXMuX3NldEN1c3RvbVJlY29yZGVyVG9vbHMoKTtcclxuICAgIH1cclxufVxyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fc2V0Q3VzdG9tUmVjb3JkZXJUb29scyA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmKCFRQk1lZGlhUmVjb3JkZXIuX2lzQXVkaW9Db250ZXh0KCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHNlbGYubWltZVR5cGUgPSBzZWxmLl9jdXN0b21NaW1lVHlwZTtcclxuICAgIC8qXHJcbiAgICAqIGNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XHJcbiAgICAqIGNvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKGJ1ZmZlclNpemUsIG51bWJlck9mSW5wdXRDaGFubmVscywgbnVtYmVyT2ZPdXRwdXRDaGFubmVscyk7XHJcbiAgICAqXHJcbiAgICAqIGxpbms6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL3J1L2RvY3MvV2ViL0FQSS9BdWRpb0NvbnRleHQvY3JlYXRlU2NyaXB0UHJvY2Vzc29yXHJcbiAgICAqL1xyXG4gICAgc2VsZi5CVUZGRVJfU0laRSA9IDIwNDg7IC8vIHRoZSBidWZmZXIgc2l6ZSBpbiB1bml0cyBvZiBzYW1wbGUtZnJhbWVzLlxyXG4gICAgc2VsZi5JTlBVVF9DSEFOTkVMUyA9IDE7IC8vIHRoZSBudW1iZXIgb2YgY2hhbm5lbHMgZm9yIHRoaXMgbm9kZSdzIGlucHV0LCBkZWZhdWx0cyB0byAyXHJcbiAgICBzZWxmLk9VVFBVVF9DSEFOTkVMUyA9IDE7IC8vIHRoZSBudW1iZXIgb2YgY2hhbm5lbHMgZm9yIHRoaXMgbm9kZSdzIG91dHB1dCwgZGVmYXVsdHMgdG8gMlxyXG4gICAgc2VsZi5fYXVkaW9Db250ZXh0ID0gbnVsbDtcclxuXHJcbiAgICBzZWxmLl9idWZmZXIgPSBbXTtcclxuICAgIHNlbGYuX3JlY29yZGluZ0xlbmd0aCA9IDA7XHJcblxyXG4gICAgaWYgKFFCTWVkaWFSZWNvcmRlci5faXNNcDNFbmNvZGVyKCkgJiYgdGhpcy5fY3VzdG9tTWltZVR5cGUgPT09ICdhdWRpby9tcDMnKSB7XHJcbiAgICAgICAgc2VsZi5fbXAzZW5jb2RlciA9IG5ldyBsYW1lanMuTXAzRW5jb2RlcigxLCA0ODAwMCwgMjU2KTtcclxuICAgIH1cclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldE1pbWVUeXBlID0gZnVuY3Rpb24gKHByZWZmZXJlZCkge1xyXG4gICAgdmFyIG1pbWVUeXBlLFxyXG4gICAgICAgIHR5cGUgPSAndmlkZW8nO1xyXG5cclxuICAgIGlmKHByZWZmZXJlZCAmJiBRQk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKHByZWZmZXJlZCkpIHtcclxuICAgICAgICBtaW1lVHlwZSA9IHByZWZmZXJlZDtcclxuICAgIH0gZWxzZSBpZihwcmVmZmVyZWQpIHtcclxuICAgICAgICB0eXBlID0gcHJlZmZlcmVkLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhdWRpbycpID09PSAtMSA/ICd2aWRlbycgOiAnYXVkaW8nO1xyXG4gICAgICAgIG1pbWVUeXBlID0gUUJNZWRpYVJlY29yZGVyLmdldFN1cHBvcnRlZE1pbWVUeXBlcyh0eXBlKVswXTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbWltZVR5cGUgPSBRQk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzKHR5cGUpWzBdO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBtaW1lVHlwZTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldENhbGxiYWNrcyA9IGZ1bmN0aW9uKG9wdHMpIHtcclxuICAgIHZhciBjYWxsYmFja3MgPSB7fSxcclxuICAgICAgICBjYWxsYmFja05hbWVzID0gWydvbnN0YXJ0JywgJ29uc3RvcCcsICdvbnBhdXNlJywgJ29ucmVzdW1lJywgJ29uZXJyb3InLCAnb25jaGFuZ2UnLCAnb25kYXRhYXZhaWxhYmxlJ107XHJcblxyXG4gICAgY2FsbGJhY2tOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcclxuICAgICAgICBpZiAobmFtZSBpbiBvcHRzKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrc1tuYW1lXSA9IG9wdHNbbmFtZV07XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIGNhbGxiYWNrcztcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5fbWltZVR5cGVzID0gcmVxdWlyZSgnLi9taW1lVHlwZXMnKTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5fU1RBVEVTID0gWydpbmFjdGl2ZScsICdyZWNvcmRpbmcnLCAncGF1c2VkJ107XHJcblxyXG4vKipcclxuICogSXQgY2hlY2tzIGNhcGFiaWxpdHkgb2YgcmVjb3JkaW5nIGluIHRoZSBlbnZpcm9ubWVudC5cclxuICogQ2hlY2tzIE1lZGlhUmVjb3JkZXIsIE1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkIGFuZCBCbG9iLlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIFFCTWVkaWFSZWNvcmRlciBpcyBhdmFpbGFibGUgYW5kIGNhbiBydW4sIG9yIGZhbHNlIG90aGVyd2lzZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogaWYoUUJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICogICAgIC8vIC4uLiBzaG93IFVJIGZvciByZWNvcmRpbmdcclxuICogfVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gISEod2luZG93ICYmIHdpbmRvdy5NZWRpYVJlY29yZGVyICYmIHR5cGVvZiB3aW5kb3cuTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQgPT09ICdmdW5jdGlvbicgJiYgd2luZG93LkJsb2IpO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLl9pc0F1ZGlvQ29udGV4dCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiAhISh3aW5kb3cgJiYgKHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCkpO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLl9pc01wM0VuY29kZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4gISEod2luZG93ICYmICh3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQpICYmIHdpbmRvdy5sYW1lanMpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgYSBCb29sZWFuIHdoaWNoIGlzIHRydWUgaWYgdGhlIE1JTUUgdHlwZSBzcGVjaWZpZWQgaXMgb25lIHRoZSB1c2VyIGFnZW50IGNhbiByZWNvcmQuXHJcbiAqIEBwYXJhbSAge1N0cmluZ30gbWltZVR5cGUgLSBUaGUgbWltZVR5cGUgdG8gY2hlY2suXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgICAgLSBUcnVlIGlmIHRoZSBNZWRpYVJlY29yZGVyIGltcGxlbWVudGF0aW9uIGlzIGNhcGFibGUgb2YgcmVjb3JkaW5nIEJsb2Igb2JqZWN0cyBmb3IgdGhlIHNwZWNpZmllZCBNSU1FIHR5cGUuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGlmKCBRQk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQnKSApIHtcclxuICogICAgIGVsLnRleHRDb250ZW50ID0gJ1dpbGwgYmUgcmVjb3JkIGluIHZpZGVvL21wNCc7XHJcbiAqIH1cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQgPSBmdW5jdGlvbihtaW1lVHlwZSkge1xyXG4gICAgdmFyIHJlc3VsdCA9IGZhbHNlO1xyXG5cclxuICAgIGlmKCFRQk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICBpZighbWltZVR5cGUpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnJlcXVyZUFyZ3VtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICBzd2l0Y2gobWltZVR5cGUpIHtcclxuICAgICAgICBjYXNlICdhdWRpby93YXYnOlxyXG4gICAgICAgICAgICBpZiAoUUJNZWRpYVJlY29yZGVyLl9pc0F1ZGlvQ29udGV4dCgpKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICBjYXNlICdhdWRpby9tcDMnOlxyXG4gICAgICAgICAgICBpZiAoUUJNZWRpYVJlY29yZGVyLl9pc0F1ZGlvQ29udGV4dCgpICYmIFFCTWVkaWFSZWNvcmRlci5faXNNcDNFbmNvZGVyKCkpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHdpbmRvdy5NZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZChtaW1lVHlwZSk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJuIGFsbCBzdXBwb3J0ZWQgbWltZSB0eXBlcyBhbmQgY29udGFpbmVyIGZvcm1hdC5cclxuICogQHBhcmFtICB7U3RyaW5nfSBbdHlwZT12aWRlb10gVHlwZSBvZiBtZWRpYS5cclxuICogQHJldHVybiB7QXJyYXl9ICAgICAgICAgICAgICAgICAgIEFycmF5IG9mIHN1cHBvcnRlZCBtaW1ldHlwZXMuUmVjb21tZW5kZWQgbWltZXR5cGUgaGFzIDAgaW5kZXguXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciB0eXBlID0gUUJNZWRpYVJlY29yZGVyLmdldFN1cHBvcnRlZE1pbWVUeXBlcygnYXVkaW8nKTtcclxuICogY29uc29sZS5pbmZvKGBDYWxsIHdpbGwgcmVjb3JkaW5nIGluICR7dHlwZVswXX1gKTtcclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXMgPSBmdW5jdGlvbih0eXBlKSB7XHJcbiAgICB2YXIgdHlwZU1lZGlhID0gdHlwZSB8fCAndmlkZW8nO1xyXG5cclxuICAgIGlmKCFRQk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gUUJNZWRpYVJlY29yZGVyLl9taW1lVHlwZXNbdHlwZU1lZGlhXS5maWx0ZXIoZnVuY3Rpb24obWltZVR5cGUpIHtcclxuICAgICAgICByZXR1cm4gUUJNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZChtaW1lVHlwZSk7XHJcbiAgICB9KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gdGhlIGN1cnJlbnQgW3N0YXRlIG9mIFFCTWVkaWFSZWNvcmRlciBpbnN0YW5jZV0oaHR0cHM6Ly93M2MuZ2l0aHViLmlvL21lZGlhY2FwdHVyZS1yZWNvcmQvTWVkaWFSZWNvcmRlci5odG1sI2lkbC1kZWYtcmVjb3JkaW5nc3RhdGUpLlxyXG4gKiBQb3NzaWJseSBzdGF0ZXM6ICoqaW5hY3RpdmUqKiwgKipyZWNvcmRpbmcqKiwgKipwYXVzZWQqKi5cclxuICogQHJldHVybiB7U3RyaW5nfSBOYW1lIG9mIGEgc3RhdGUuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciByZWNvcmRlciA9IG5ldyBRQk1lZGlhUmVjb3JkZXIoKTtcclxuICogLy8gLi4uc29tZSBjb2RlXHJcbiAqXHJcbiAqIGlmKHJlY29yZGVyLmdldFN0YXRlKCkgPT0gJ3JlY29yZGluZycpIHtcclxuICogICAgIGNvbnNvbGUuaW5mbygnWW91IGFyZSBzdGlsbCByZWNvcmRpbmcuJyk7XHJcbiAqIH1cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuZ2V0U3RhdGUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLl9tZWRpYVJlY29yZGVyID8gdGhpcy5fbWVkaWFSZWNvcmRlci5zdGF0ZSA6IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzBdO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBTdGFydCB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEZpcmUgdGhlIG1ldGhvZCBgc3RvcGAgaWYgYW4gaW5zdGFuY2UgaW5wcm9ncmVzcyAoaGFzIGEgc3RhdGUgcmVjb3JkaW5nIG9yIHBhdXNlZCkuXHJcbiAqIEZpcmUgb25zdGFydCBjYWxsYmFjay5cclxuICogQHBhcmFtIHtNZWRpYVN0cmVhbX0gc3RyZWFtIC0gU3RyZWFtIG9iamVjdCByZXByZXNlbnRpbmcgYSBmbHV4IG9mIGF1ZGlvLSBvciB2aWRlby1yZWxhdGVkIGRhdGEuXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgb3B0aW9ucyA9IHtcclxuICogICAgIG9uc3RhcnQ6IGZ1bmN0aW9uIG9uU3RhcnQoKSB7XHJcbiAqICAgICAgICAgdmFyIHRpbWUgPSAwLFxyXG4gKiAgICAgICAgICAgICBzdGVwID0gMTAwMDtcclxuICogICAgICAgICBcclxuICogICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICogICAgICAgICAgICAgdGltZSArPSBzdGVwO1xyXG4gKiAgICAgICAgICAgICBjb25zb2xlLmluZm8oYFlvdSBhcmUgcmVjb3JkaW5nICR7dGltZX0gc2VjLmApO1xyXG4gKiAgICAgICAgIH0sIHN0ZXApO1xyXG4gKiAgICAgfVxyXG4gKiB9XHJcbiAqXHJcbiAqIHZhciByZWMgPSBuZXcgcWJSZWNvcmRlcihvcHRpb25zKTtcclxuICogLy8gLi4uXHJcbiAqIHJlYy5zdGFydChzdHJlYW0pO1xyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKHN0cmVhbSkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmKCFzdHJlYW0pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnJlcXVyZUFyZ3VtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgbWVkaWFSZWNvcmRlclN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMV0gfHwgbWVkaWFSZWNvcmRlclN0YXRlID09PSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1syXSkge1xyXG4gICAgICAgIHRoaXMuX21lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKHRoaXMuX3N0cmVhbSkge1xyXG4gICAgICAgIHRoaXMuX3N0cmVhbSA9IG51bGw7XHJcbiAgICB9XHJcbiAgICAvLyBUT0RPOiBuZWVkIHRvIHN0cmVhbS5jbG9uZVxyXG4gICAgc2VsZi5fc3RyZWFtID0gc3RyZWFtO1xyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcbiAgICBzZWxmLl9yZWNvcmRlZENodW5rcy5sZW5ndGggPSAwO1xyXG5cclxuICAgIGlmIChzZWxmLl9jdXN0b21NaW1lVHlwZSkge1xyXG4gICAgICAgIHNlbGYuX3NldEN1c3RvbVJlY29yZGVyKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHNlbGYuX3NldE1lZGlhUmVjb3JkZXIoKTtcclxuICAgIH1cclxuICAgIHNlbGYuX3NldEV2ZW50cygpO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fc2V0TWVkaWFSZWNvcmRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBuZXcgd2luZG93Lk1lZGlhUmVjb3JkZXIoc2VsZi5fc3RyZWFtLCB7XHJcbiAgICAgICAgICAgICdtaW1lVHlwZSc6IHNlbGYubWltZVR5cGUsXHJcbiAgICAgICAgICAgICdpZ25vcmVNdXRlZE1lZGlhJzogc2VsZi5pZ25vcmVNdXRlZE1lZGlhXHJcbiAgICAgICAgfSk7XHJcbiAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLnVuc3VwcG9ydE1lZGlhUmVjb3JkZXJXaXRoT3B0aW9ucywgZSk7XHJcblxyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBuZXcgd2luZG93Lk1lZGlhUmVjb3JkZXIoc2VsZi5fc3RyZWFtKTtcclxuICAgIH1cclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3NldEN1c3RvbVJlY29yZGVyID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgc2VsZi5fY2xvc2VBdWRpb1Byb2Nlc3MoKTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0ge1xyXG4gICAgICAgIHN0YXJ0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXTtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3N0YXJ0QXVkaW9Qcm9jZXNzKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uc3RhcnQoKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vbmVycm9yKGVycm9yKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHN0b3A6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzBdO1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fc3RvcEF1ZGlvUHJvY2VzcygpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vbnN0b3AoKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vbmVycm9yKGVycm9yKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHBhdXNlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1syXTtcclxuICAgICAgICAgICAgICAgIHRoaXMub25wYXVzZSgpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgcmVzdW1lOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXTtcclxuICAgICAgICAgICAgICAgIHRoaXMub25yZXN1bWUoKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vbmVycm9yKGVycm9yKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qIGNhbGxiYWNrcyAqL1xyXG4gICAgICAgIG9uc3RhcnQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zdGF0ZSAhPT0gJ3JlY29yZGluZycpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIG9uc3RvcDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnN0YXRlICE9PSAnaW5hY3RpdmUnKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBvbnBhdXNlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhdGUgIT09ICdwYXVzZWQnKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMl07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBvbnJlc3VtZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnN0YXRlICE9PSAncmVjb3JkaW5nJykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzFdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgb25lcnJvcjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9jbG9zZUF1ZGlvUHJvY2VzcygpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3NldEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGZpcmVDYWxsYmFjayhuYW1lLCBhcmdzKSB7XHJcbiAgICAgICAgaWYoT2JqZWN0LmtleXMoc2VsZi5jYWxsYmFja3MpLmxlbmd0aCAhPT0gMCAmJiB0eXBlb2Ygc2VsZi5jYWxsYmFja3NbbmFtZV0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHNlbGYuY2FsbGJhY2tzW25hbWVdKGFyZ3MpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZvdW5kZWQgYW4gZXJyb3IgaW4gY2FsbGJhY2s6JyArIG5hbWUsIGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0eXBlb2Ygc2VsZi5fbWVkaWFSZWNvcmRlci5vbmRhdGFhdmFpbGFibGUgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgaWYoZS5kYXRhICYmIGUuZGF0YS5zaXplID4gMCkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fcmVjb3JkZWRDaHVua3MucHVzaChlLmRhdGEpO1xyXG4gICAgICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvbmRhdGFhdmFpbGFibGUnLCBlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnBhdXNlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgZmlyZUNhbGxiYWNrKCdvbnBhdXNlJyk7XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25yZXN1bWUgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBmaXJlQ2FsbGJhY2soJ29ucmVzdW1lJyk7XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25lcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XHJcbiAgICAgICAgc3dpdGNoKGVycm9yLm5hbWUpIHtcclxuICAgICAgICAgICAgY2FzZSAnSW52YWxpZFN0YXRlJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnT3V0T2ZNZW1vcnknOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnT3RoZXJSZWNvcmRpbmdFcnJvcic6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ0dlbmVyaWNFcnJvcic6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdNZWRpYVJlY29yZGVyIEVycm9yJywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZihzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlICE9PSAnaW5hY3RpdmUnKSB7XHJcbiAgICAgICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoc2VsZi5fdXNlckNhbGxiYWNrcyAmJiB0eXBlb2Ygc2VsZi5fdXNlckNhbGxiYWNrcy5vbkVycm9yUmVjb3JkaW5nID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGZpcmVDYWxsYmFjaygnb25lcnJvcicsIGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25zdG9wID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIGJsb2IgPSBuZXcgQmxvYihzZWxmLl9yZWNvcmRlZENodW5rcywge1xyXG4gICAgICAgICAgICAndHlwZScgOiBzZWxmLm1pbWVUeXBlXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHNlbGYucmVjb3JkZWRCbG9icy5wdXNoKGJsb2IpO1xyXG5cclxuICAgICAgICBpZighc2VsZi5fa2VlcFJlY29yZGluZykge1xyXG4gICAgICAgICAgICBpZihzZWxmLnJlY29yZGVkQmxvYnMubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvbnN0b3AnLCBibG9iKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGZpcmVDYWxsYmFjaygnb25zdG9wJywgc2VsZi5yZWNvcmRlZEJsb2JzWzBdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc2VsZi5fa2VlcFJlY29yZGluZyA9IGZhbHNlO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXJ0KHNlbGYudGltZXNsaWNlKTtcclxuXHJcbiAgICBmaXJlQ2FsbGJhY2soJ29uc3RhcnQnKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBTdG9wIHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogQHJldHVybiB7QmxvYn0gQmxvYiBvZiByZWNvcmRlZCBjaHVuY2tzLlxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgbWVkaWFSZWNvcmRlciA9IHRoaXMuX21lZGlhUmVjb3JkZXIsXHJcbiAgICAgICAgbWVkaWFSZWNvcmRlclN0YXRlID0gbWVkaWFSZWNvcmRlciAmJiBtZWRpYVJlY29yZGVyLnN0YXRlID8gbWVkaWFSZWNvcmRlci5zdGF0ZSA6ICdpbmFjdGl2ZSc7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlciAmJiAobWVkaWFSZWNvcmRlclN0YXRlID09PSAncmVjb3JkaW5nJyB8fCBtZWRpYVJlY29yZGVyU3RhdGUgPT09ICdwYXVzZWQnKSl7XHJcbiAgICAgICAgbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBQYXVzZSB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIgJiYgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSA9PT0gJ3JlY29yZGluZycpIHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnBhdXNlKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXN1bWUgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlciAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSAncGF1c2VkJykge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIucmVzdW1lKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGFuZ2UgYSByZWNvcmRlZCBzdHJlYW0uXHJcbiAqIEBwYXJhbSB7TWVkaWFTdHJlYW19IHN0cmVhbSAtIFN0cmVhbSBvYmplY3QgcmVwcmVzZW50aW5nIGEgZmx1eCBvZiBhdWRpby0gb3IgdmlkZW8tcmVsYXRlZCBkYXRhLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuY2hhbmdlID0gZnVuY3Rpb24oc3RyZWFtKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoIXN0cmVhbSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMucmVxdXJlQXJndW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX2tlZXBSZWNvcmRpbmcgPSB0cnVlOyAvLyBkb24ndCBzdG9wIGEgcmVjb3JkXHJcbiAgICBzZWxmLnN0b3AoKTtcclxuXHJcbiAgICBzZWxmLl9zdHJlYW0gPSBudWxsO1xyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcblxyXG4gICAgLy8gVE9ETyBzdHJlYW0uY2xvbmVcclxuICAgIHNlbGYuX3N0cmVhbSA9IHN0cmVhbTtcclxuXHJcbiAgICBpZiAoc2VsZi5fY3VzdG9tTWltZVR5cGUpIHtcclxuICAgICAgICBzZWxmLl9zZXRDdXN0b21SZWNvcmRlcigpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBzZWxmLl9zZXRNZWRpYVJlY29yZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fc2V0RXZlbnRzKCk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGEgZmlsZSBmcm9tIGJsb2IgYW5kIGRvd25sb2FkIGFzIHRoZSBmaWxlLiBJdHMgbWV0aG9kIHdpbGwgZmlyZSAnc3RvcCcgaWYgcmVjb3JkaW5nIGluIHByb2dyZXNzLlxyXG4gKiBAcGFyYW0ge1N0cmludH0gW2ZpbGVOYW1lPURhdGUubm93KCldIC0gTmFtZSBvZiBmaWxlLlxyXG4gKiBAcGFyYW0ge0Jsb2J9ICAgW2Jsb2JdIC0gWW91IGNhbiBzZXQgYmxvYiB3aGljaCB5b3UgZ2V0IGZyb20gdGhlIG1ldGhvZCBgc3RvcGAgb3IgZG9uJ3Qgc2V0IGFueXRoaW5nIGFuZCB3ZSB3aWxsIGdldCByZWNvcmRlZCBjaHVuY2tzLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICpcclxuICogQGV4YW1wbGVcclxuICogdmFyIHJlYyA9IG5ldyBxYlJlY29yZGVyKCk7XHJcbiAqIHJlYy5zdGFydChzdHJlYW0pO1xyXG4gKiAvLyAuLi5cclxuICogcmVjLmRvd25sb2FkKGZhbHNlKTsgLy8gU2V0IGZhbHNlLCBuYW1lIHdpbGwgYmUgZ2VuZXJhdGVkIGJhc2VkIG9uIERhdGUubm93KClcclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuZG93bmxvYWQgPSBmdW5jdGlvbihmaWxlTmFtZSwgYmxvYikge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHZhciBtZWRpYVJlY29yZGVyU3RhdGUgPSB0aGlzLmdldFN0YXRlKCk7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlclN0YXRlID09PSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXSB8fCBtZWRpYVJlY29yZGVyU3RhdGUgPT09IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzJdKSB7XHJcbiAgICAgICAgdGhpcy5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYiB8fCBzZWxmLl9nZXRCbG9iUmVjb3JkZWQoKSksXHJcbiAgICAgICAgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuXHJcbiAgICBhLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICBhLmhyZWYgPSB1cmw7XHJcbiAgICBhLmRvd25sb2FkID0gKGZpbGVOYW1lIHx8IERhdGUubm93KCkpICsgJy4nICsgc2VsZi5fZ2V0RXh0ZW5zaW9uKCk7XHJcblxyXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcclxuXHJcbiAgICAvLyBTdGFydCBkb3dsb2FkaW5nXHJcbiAgICBhLmNsaWNrKCk7XHJcblxyXG4gICAgLy8gUmVtb3ZlIGxpbmtcclxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChhKTtcclxuICAgICAgICB3aW5kb3cuVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xyXG4gICAgfSwgMTAwKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYSBCbG9iIGZyb20gcmVjb3JkZWQgY2h1bmtzLlxyXG4gKiBAYWNjZXNzIHByaXZhdGVcclxuICogQHBhcmFtIHtPYmplY3R9IFtkYXRhXSAtIFJlY29yZGVkIGRhdGEuXHJcbiAqIEByZXR1cm4ge09iamVjdH0gLSBCbG9iIG9mIHJlY29yZGVkIG1lZGlhIG9yIHdoYXQgeW91IHNldCBpbiBkYXRhXHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRCbG9iUmVjb3JkZWQgPSBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgY2h1bmtzID0gZGF0YSB8fCBzZWxmLl9yZWNvcmRlZENodW5rcztcclxuXHJcbiAgICBpZighY2h1bmtzLmxlbmd0aCkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMubm9fcmVjb3JkZWRfY2h1bmtzKTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG5ldyBCbG9iKGNodW5rcywgeyAndHlwZScgOiBzZWxmLm1pbWVUeXBlIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBhIGV4dGVuc2lvbiBvZiBhIGZpbGUuIEJhc2VkIG9uIGF2YWlsYWJsZSBtaW1lVHlwZS5cclxuICogQGFjY2VzcyBwcml2YXRlXHJcbiAqIEByZXR1cm4ge1N0cmluZ30gRm9yIGV4YW1wbGUsICd3ZWJtJyAvICdtcDQnIC8gJ29nZydcclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldEV4dGVuc2lvbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHZhciBlbmRUeXBlTWVkaWEgPSBzZWxmLm1pbWVUeXBlLmluZGV4T2YoJy8nKSxcclxuICAgICAgICBleHRlbnNpb24gPSBzZWxmLm1pbWVUeXBlLnN1YnN0cmluZyhlbmRUeXBlTWVkaWEgKyAxKSxcclxuICAgICAgICBzdGFydENvZGVjc0luZm8gPSBleHRlbnNpb24uaW5kZXhPZignOycpO1xyXG5cclxuICAgIGlmKHN0YXJ0Q29kZWNzSW5mbyAhPT0gLTEpIHtcclxuICAgICAgICBleHRlbnNpb24gPSBleHRlbnNpb24uc3Vic3RyaW5nKDAsIHN0YXJ0Q29kZWNzSW5mbyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGV4dGVuc2lvbjtcclxufTtcclxuXHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9zdGFydEF1ZGlvUHJvY2VzcyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgaWYoIVFCTWVkaWFSZWNvcmRlci5faXNBdWRpb0NvbnRleHQoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgYXVkaW9Db250ZXh0LFxyXG4gICAgICAgIGF1ZGlvSW5wdXQsXHJcbiAgICAgICAgcmVjb3JkZXIsXHJcbiAgICAgICAgdm9sdW1lO1xyXG5cclxuICAgIHNlbGYuX2Nsb3NlQXVkaW9Qcm9jZXNzKCk7XHJcblxyXG4gICAgYXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xyXG4gICAgc2VsZi5fYXVkaW9Db250ZXh0ID0gbmV3IGF1ZGlvQ29udGV4dDtcclxuXHJcbiAgICB2b2x1bWUgPSBzZWxmLl9hdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xyXG4gICAgYXVkaW9JbnB1dCA9IHNlbGYuX2F1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzZWxmLl9zdHJlYW0pO1xyXG4gICAgcmVjb3JkZXIgPSBzZWxmLl9hdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKHNlbGYuQlVGRkVSX1NJWkUsIHNlbGYuSU5QVVRfQ0hBTk5FTFMsIHNlbGYuT1VUUFVUX0NIQU5ORUxTKTtcclxuICAgIGF1ZGlvSW5wdXQuY29ubmVjdCh2b2x1bWUpO1xyXG5cclxuICAgIHJlY29yZGVyLm9uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmIChzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXSkge1xyXG4gICAgICAgICAgICBzZWxmLl9idWZmZXIucHVzaChuZXcgRmxvYXQzMkFycmF5KGUuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCkpKTtcclxuICAgICAgICAgICAgc2VsZi5fcmVjb3JkaW5nTGVuZ3RoICs9IHNlbGYuQlVGRkVSX1NJWkU7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB2b2x1bWUuY29ubmVjdChyZWNvcmRlcik7XHJcbiAgICByZWNvcmRlci5jb25uZWN0KHNlbGYuX2F1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9jbG9zZUF1ZGlvUHJvY2VzcyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmICghIXNlbGYuX2F1ZGlvQ29udGV4dCkge1xyXG4gICAgICAgIHNlbGYuX2F1ZGlvQ29udGV4dC5jbG9zZSgpXHJcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fYXVkaW9Db250ZXh0ID0gbnVsbDtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3JlY29yZGluZ0xlbmd0aCA9IDA7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9idWZmZXIgPSBbXTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9zdG9wQXVkaW9Qcm9jZXNzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgc2VsZi5fcmVjb3JkZWRDaHVua3MgPSBzZWxmLl9nZXRCbG9iRGF0YSgpO1xyXG4gICAgc2VsZi5fY2xvc2VBdWRpb1Byb2Nlc3MoKTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2VuY29kZU1QMyA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgIGRhdGEgPSBuZXcgSW50MTZBcnJheShidWZmZXIpLFxyXG4gICAgICAgIGVuY29kZWRCdWZmZXIgPSBzZWxmLl9tcDNlbmNvZGVyLmVuY29kZUJ1ZmZlcihkYXRhKSxcclxuICAgICAgICBmbHVzaGVkQnVmZmVyID0gc2VsZi5fbXAzZW5jb2Rlci5mbHVzaCgpLFxyXG4gICAgICAgIG1wM0RhdGEgPSBbXTtcclxuXHJcbiAgICBtcDNEYXRhLnB1c2goZW5jb2RlZEJ1ZmZlcik7XHJcbiAgICBtcDNEYXRhLnB1c2gobmV3IEludDhBcnJheShmbHVzaGVkQnVmZmVyKSk7XHJcblxyXG4gICAgcmV0dXJuIG1wM0RhdGE7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9lbmNvZGVXQVYgPSBmdW5jdGlvbihzYW1wbGVzKSB7XHJcbiAgICB2YXIgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDQ0ICsgc2FtcGxlcy5sZW5ndGggKiAyKSxcclxuICAgICAgICB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XHJcblxyXG4gICAgX3dyaXRlU3RyaW5nKHZpZXcsIDAsICdSSUZGJyk7XHJcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzMiArIHNhbXBsZXMubGVuZ3RoICogMiwgdHJ1ZSk7XHJcbiAgICBfd3JpdGVTdHJpbmcodmlldywgOCwgJ1dBVkUnKTtcclxuICAgIF93cml0ZVN0cmluZyh2aWV3LCAxMiwgJ2ZtdCAnKTtcclxuICAgIHZpZXcuc2V0VWludDMyKDE2LCAxNiwgdHJ1ZSk7XHJcbiAgICB2aWV3LnNldFVpbnQxNigyMCwgMSwgdHJ1ZSk7XHJcbiAgICB2aWV3LnNldFVpbnQxNigyMiwgMSwgdHJ1ZSk7XHJcbiAgICB2aWV3LnNldFVpbnQzMigyNCwgdGhpcy5zYW1wbGVSYXRlLCB0cnVlKTtcclxuICAgIHZpZXcuc2V0VWludDMyKDI4LCB0aGlzLnNhbXBsZVJhdGUgKiAyLCB0cnVlKTtcclxuICAgIHZpZXcuc2V0VWludDE2KDMyLCAyLCB0cnVlKTtcclxuICAgIHZpZXcuc2V0VWludDE2KDM0LCAxNiwgdHJ1ZSk7XHJcbiAgICBfd3JpdGVTdHJpbmcodmlldywgMzYsICdkYXRhJyk7XHJcbiAgICB2aWV3LnNldFVpbnQzMig0MCwgc2FtcGxlcy5sZW5ndGggKiAyLCB0cnVlKTtcclxuXHJcbiAgICBfZmxvYXRUbzE2Qml0UENNKHZpZXcsIDQ0LCBzYW1wbGVzKTtcclxuXHJcbiAgICBmdW5jdGlvbiBfZmxvYXRUbzE2Qml0UENNKG91dHB1dCwgb2Zmc2V0LCBpbnB1dCkge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyssIG9mZnNldCArPSAyKSB7XHJcbiAgICAgICAgICAgIHZhciBzID0gTWF0aC5tYXgoLTEsIE1hdGgubWluKDEsIGlucHV0W2ldKSk7XHJcbiAgICAgICAgICAgIG91dHB1dC5zZXRJbnQxNihvZmZzZXQsIHMgPCAwID8gcyAqIDB4ODAwMCA6IHMgKiAweDdGRkYsIHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfd3JpdGVTdHJpbmcodmlldywgb2Zmc2V0LCBzdHJpbmcpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2aWV3LnNldFVpbnQ4KG9mZnNldCArIGksIHN0cmluZy5jaGFyQ29kZUF0KGkpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHZpZXc7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRCbG9iRGF0YSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgIHJlc3VsdCA9IG5ldyBGbG9hdDMyQXJyYXkoc2VsZi5fcmVjb3JkaW5nTGVuZ3RoKSxcclxuICAgICAgICBidWZmZXJMZW5ndGggPSBzZWxmLl9idWZmZXIubGVuZ3RoLFxyXG4gICAgICAgIG9mZnNldCA9IDAsXHJcbiAgICAgICAgYnVmZmVyLFxyXG4gICAgICAgIHZpZXcsXHJcbiAgICAgICAgZGF0YTtcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKXtcclxuICAgICAgICBidWZmZXIgPSBzZWxmLl9idWZmZXJbaV07XHJcbiAgICAgICAgcmVzdWx0LnNldChidWZmZXIsIG9mZnNldCk7XHJcbiAgICAgICAgb2Zmc2V0ICs9IGJ1ZmZlci5sZW5ndGg7XHJcbiAgICB9XHJcblxyXG4gICAgdmlldyA9IHNlbGYuX2VuY29kZVdBVihyZXN1bHQpO1xyXG5cclxuICAgIHN3aXRjaChzZWxmLl9jdXN0b21NaW1lVHlwZSkge1xyXG4gICAgICAgIGNhc2UgJ2F1ZGlvL3dhdic6XHJcbiAgICAgICAgICAgIGRhdGEgPSBbdmlld107XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICBjYXNlICdhdWRpby9tcDMnOlxyXG4gICAgICAgICAgICBkYXRhID0gc2VsZi5fZW5jb2RlTVAzKHZpZXcuYnVmZmVyKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGRhdGE7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFFCTWVkaWFSZWNvcmRlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgICdhdWRpbyc6IFtcclxuICAgICAgICAnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycsXHJcbiAgICAgICAgJ2F1ZGlvL3dlYm0nLFxyXG4gICAgICAgICdhdWRpby9vZ2cnLFxyXG4gICAgICAgICdhdWRpby93YXYnLFxyXG4gICAgICAgICdhdWRpby9tcDMnXHJcbiAgICBdLFxyXG4gICAgJ3ZpZGVvJzogW1xyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1oMjY0JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA5JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA4JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9ZGFhbGEnLFxyXG4gICAgICAgICd2aWRlby93ZWJtJyxcclxuICAgICAgICAndmlkZW8vbXA0JyxcclxuICAgICAgICAndmlkZW8vbXBlZydcclxuICAgIF1cclxufTsiXX0=
