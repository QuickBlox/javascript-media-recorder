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
 * @param {String}   opts[].mimeType=video - Specifies the media type and container format for the recording. You can set simply: 'video' or 'audio' or 'audio/webm';
 * @param {Number}   opts[].timeslice=1000 - The minimum number of milliseconds of data to return in a single Blob, fire 'ondataavaible' callback.
 * @param {Boolean}  opts[].ignoreMutedMedia=true - What to do with a muted input MediaStreamTrack, e.g. insert black frames/zero audio volume in the recording or ignore altogether.
 * @param {Function} opts[].onstart - Called to handle the start event.
 * @param {Function} opts[].onstop - Called to handle the stop event.
 * @param {Function} opts[].onpause - Called to handle the pause event.
 * @param {Function} opts[].onresume - Called to handle the resume event.
 * @param {Function} opts[].onerror - Called to handle an ErrorEvent.
 * @param {Function} opts[].onchange - Called to handle the change a stream event.
 * @param {Function} opts[].ondataavailable - Called to handle the dataavailable event. The Blob of recorded data is contained in this event.
 *
 * @example
 * var opts = {
 *     onstart: function onStart() { // Use named function.
 *         console.log('Recorder is started');
 *     },
 *     onstop: function onStop(Blob) {
 *         videoElement.src = URL.createObjectURL(blob);
 *     }
 * };
 *
 * // uses as global variable, QBMediaRecorder is built as a UMD module.
 * var recorder = new QBMediaRecorder(opts);
 *
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
        self._mp3encoder = new window.lamejs.Mp3Encoder(1, 48000, 128);
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
        'start': function() {
            this.state = QBMediaRecorder._STATES[1];
            self._startAudioProcess();
        },

        'stop': function() {
            self._stopAudioProcess();
            this.state = QBMediaRecorder._STATES[0];
        },

        'pause': function() {
            this.state = QBMediaRecorder._STATES[2];
        },

        'resume': function() {
            this.state = QBMediaRecorder._STATES[1];
        },

        'state': QBMediaRecorder._STATES[0]
    };
};

QBMediaRecorder.prototype._setEvents = function() {
    var self = this,
        isMediaRecorder = !self._customMimeType;

    function fireCallback(name, args) {
        if(Object.keys(self.callbacks).length !== 0 && typeof self.callbacks[name] === 'function') {
            try {
                self.callbacks[name](args);
            } catch(e) {
                console.error('Founded an error in callback:' + name, e);
            }
        }
    }

    if (isMediaRecorder) {
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
    console.log(self.recordedBlobs);
        console.log(!self._keepRecording);
        if(!self._keepRecording) {
            if(self.recordedBlobs.length > 1) {
                console.log(blob);
                fireCallback('onstop', blob);
            } else {
                console.log(self.recordedBlobs[0]);
                fireCallback('onstop', self.recordedBlobs[0]);
            }
        }

        self._keepRecording = false;
    };

    if (isMediaRecorder) {
        self._mediaRecorder.start(self.timeslice);
    } else {
        self._mediaRecorder.start();
    }
    
    console.log(self._mediaRecorder);

    fireCallback('onstart');
};

/**
 * Stop to recording a stream.
 * @return {Blob} Blob of recorded chuncks.
 */
QBMediaRecorder.prototype.stop = function() {
    var mediaRecorder = this._mediaRecorder,
        mediaRecorderState = mediaRecorder && mediaRecorder.state ? mediaRecorder.state : 'inactive';

    if(mediaRecorder && mediaRecorderState === 'recording'){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL21pbWVUeXBlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbnJCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgJ3Vuc3VwcG9ydCc6ICdRQk1lZGlhUmVjb3JkZXIgaXMgbm90IHN1cHBvcnRlZCB0aGlzIGVudmlyb25tZW50LicsXHJcbiAgICAndW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zJzogJ0dvdCBhIHdhcm5pbmcgd2hlbiBjcmVhdGluZyBhIE1lZGlhUmVjb3JkZXIsIHRyeWluZyB0byBjcmVhdGUgTWVkaWFSZWNvcmRlciB3aXRob3V0IG9wdGlvbnMuJyxcclxuICAgICdyZXF1cmVBcmd1bWVudCc6ICcxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAwIHByZXNlbnQuJyxcclxuICAgICdjYWxsYmFja0Vycm9yJzogJ0ZvdW5kZWQgYW4gZXJyb3IgaW4gY2FsbGJhY2s6JyxcclxuICAgICdhY3Rpb25GYWlsZWQnOiAnUUJNZWRpYVJlY29yZGVyIGlzIG5vdCBjcmVhdGVkIG9yIGhhcyBhbiBpbnZhbGlkIHN0YXRlLicsXHJcbiAgICAnbm9fcmVjb3JkZWRfY2h1bmtzJzogJ0RvZXMgbm90IGhhdmUgYW55IHJlY29yZGluZyBkYXRhLicsXHJcbiAgICAnc3RyZWFtUmVxdWlyZWQnOiAnTWVkaWFTdHJlYW0gaXMgcmVxdWlyZWQuJyxcclxuICAgICdJbnZhbGlkU3RhdGUnOiAnUUJNZWRpYVJlY29yZGVyIGlzIG5vdCBpbiBhIHN0YXRlIGluIHdoaWNoIHRoZSBwcm9wb3NlZCBvcGVyYXRpb24gaXMgYWxsb3dlZCB0byBiZSBleGVjdXRlZC4nLFxyXG4gICAgJ091dE9mTWVtb3J5JzogJ1RoZSBVQSBoYXMgZXhoYXVzZWQgdGhlIGF2YWlsYWJsZSBtZW1vcnkuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJzogJ0EgbW9kaWZpY2F0aW9uIHRvIHRoZSBzdHJlYW0gaGFzIG9jY3VycmVkIHRoYXQgbWFrZXMgaXQgaW1wb3NzaWJsZSB0byBjb250aW51ZSByZWNvcmRpbmcuIEFuIGV4YW1wbGUgd291bGQgYmUgdGhlIGFkZGl0aW9uIG9mIGEgVHJhY2sgd2hpbGUgcmVjb3JkaW5nIGlzIG9jY3VycmluZy4gVXNlciBhZ2VudHMgU0hPVUxEIHByb3ZpZGUgYXMgbXVjaCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlIGluIHRoZSBtZXNzYWdlIGF0dHJpYnV0ZS4nLFxyXG4gICAgJ090aGVyUmVjb3JkaW5nRXJyb3InOiAnVXNlZCBmb3IgYW4gZmF0YWwgZXJyb3Igb3RoZXIgdGhhbiB0aG9zZSBsaXN0ZWQgYWJvdmUuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdHZW5lcmljRXJyb3InOiAnVGhlIFVBIGNhbm5vdCBwcm92aWRlIHRoZSBjb2RlYyBvciByZWNvcmRpbmcgb3B0aW9uIHRoYXQgaGFzIGJlZW4gcmVxdWVzdGVkJ1xyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBFUlJPUlMgPSByZXF1aXJlKCcuL2Vycm9ycycpO1xyXG5cclxuLyoqXHJcbiAqIEBjb25zdHJ1Y3RvciBRQk1lZGlhUmVjb3JkZXJcclxuICogQHBhcmFtIHtPYmplY3R9ICAgW29wdHNdIC0gT2JqZWN0IG9mIHBhcmFtZXRlcnMuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSAgIG9wdHNbXS5taW1lVHlwZT12aWRlbyAtIFNwZWNpZmllcyB0aGUgbWVkaWEgdHlwZSBhbmQgY29udGFpbmVyIGZvcm1hdCBmb3IgdGhlIHJlY29yZGluZy4gWW91IGNhbiBzZXQgc2ltcGx5OiAndmlkZW8nIG9yICdhdWRpbycgb3IgJ2F1ZGlvL3dlYm0nO1xyXG4gKiBAcGFyYW0ge051bWJlcn0gICBvcHRzW10udGltZXNsaWNlPTEwMDAgLSBUaGUgbWluaW11bSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIG9mIGRhdGEgdG8gcmV0dXJuIGluIGEgc2luZ2xlIEJsb2IsIGZpcmUgJ29uZGF0YWF2YWlibGUnIGNhbGxiYWNrLlxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59ICBvcHRzW10uaWdub3JlTXV0ZWRNZWRpYT10cnVlIC0gV2hhdCB0byBkbyB3aXRoIGEgbXV0ZWQgaW5wdXQgTWVkaWFTdHJlYW1UcmFjaywgZS5nLiBpbnNlcnQgYmxhY2sgZnJhbWVzL3plcm8gYXVkaW8gdm9sdW1lIGluIHRoZSByZWNvcmRpbmcgb3IgaWdub3JlIGFsdG9nZXRoZXIuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbnN0YXJ0IC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgc3RhcnQgZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbnN0b3AgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBzdG9wIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25wYXVzZSAtIENhbGxlZCB0byBoYW5kbGUgdGhlIHBhdXNlIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25yZXN1bWUgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSByZXN1bWUgZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbmVycm9yIC0gQ2FsbGVkIHRvIGhhbmRsZSBhbiBFcnJvckV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25jaGFuZ2UgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBjaGFuZ2UgYSBzdHJlYW0gZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbmRhdGFhdmFpbGFibGUgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBkYXRhYXZhaWxhYmxlIGV2ZW50LiBUaGUgQmxvYiBvZiByZWNvcmRlZCBkYXRhIGlzIGNvbnRhaW5lZCBpbiB0aGlzIGV2ZW50LlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgb3B0cyA9IHtcclxuICogICAgIG9uc3RhcnQ6IGZ1bmN0aW9uIG9uU3RhcnQoKSB7IC8vIFVzZSBuYW1lZCBmdW5jdGlvbi5cclxuICogICAgICAgICBjb25zb2xlLmxvZygnUmVjb3JkZXIgaXMgc3RhcnRlZCcpO1xyXG4gKiAgICAgfSxcclxuICogICAgIG9uc3RvcDogZnVuY3Rpb24gb25TdG9wKEJsb2IpIHtcclxuICogICAgICAgICB2aWRlb0VsZW1lbnQuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcclxuICogICAgIH1cclxuICogfTtcclxuICpcclxuICogLy8gdXNlcyBhcyBnbG9iYWwgdmFyaWFibGUsIFFCTWVkaWFSZWNvcmRlciBpcyBidWlsdCBhcyBhIFVNRCBtb2R1bGUuXHJcbiAqIHZhciByZWNvcmRlciA9IG5ldyBRQk1lZGlhUmVjb3JkZXIob3B0cyk7XHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiBRQk1lZGlhUmVjb3JkZXIob3B0cykge1xyXG4gICAgdmFyIHByZWZmZXJlZE1pbWVUeXBlID0gb3B0cyAmJiBvcHRzLm1pbWVUeXBlID8gb3B0cy5taW1lVHlwZSA6IGZhbHNlO1xyXG4gICAgdGhpcy5fY3VzdG9tTWltZVR5cGUgPSAocHJlZmZlcmVkTWltZVR5cGUgPT09ICdhdWRpby93YXYnKSA/ICdhdWRpby93YXYnIDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgKHByZWZmZXJlZE1pbWVUeXBlID09PSAnYXVkaW8vbXAzJykgPyAnYXVkaW8vbXAzJyA6IGZhbHNlO1xyXG5cclxuICAgIGlmKCFRQk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSAmJiAhdGhpcy5fY3VzdG9tTWltZVR5cGUpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5taW1lVHlwZSA9IHRoaXMuX2dldE1pbWVUeXBlKHByZWZmZXJlZE1pbWVUeXBlKTtcclxuICAgIHRoaXMudGltZXNsaWNlID0gb3B0cyAmJiBvcHRzLnRpbWVzbGljZSAmJiBpc05hTigrb3B0cy50aW1lc2xpY2UpID8gb3B0cy50aW1lc2xpY2UgOiAxMDAwO1xyXG4gICAgdGhpcy5jYWxsYmFja3MgPSBvcHRzID8gdGhpcy5fZ2V0Q2FsbGJhY2tzKG9wdHMpIDoge307XHJcbiAgICB0aGlzLnJlY29yZGVkQmxvYnMgPSBbXTtcclxuICAgIHRoaXMuaWdub3JlTXV0ZWRNZWRpYSA9IG9wdHMgJiYgdHlwZW9mKG9wdHMuaWdub3JlTXV0ZWRNZWRpYSkgPT09ICdib29sZWFuJyA/IG9wdHMuaWdub3JlTXV0ZWRNZWRpYSA6IHRydWU7XHJcblxyXG4gICAgdGhpcy5fc3RyZWFtID0gbnVsbDtcclxuICAgIHRoaXMuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG4gICAgdGhpcy5fcmVjb3JkZWRDaHVua3MgPSBbXTtcclxuICAgIHRoaXMuX2tlZXBSZWNvcmRpbmcgPSBmYWxzZTtcclxuXHJcbiAgICBpZiAodGhpcy5fY3VzdG9tTWltZVR5cGUpIHtcclxuICAgICAgICB0aGlzLl9zZXRDdXN0b21SZWNvcmRlclRvb2xzKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3NldEN1c3RvbVJlY29yZGVyVG9vbHMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBpZighUUJNZWRpYVJlY29yZGVyLl9pc0F1ZGlvQ29udGV4dCgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBzZWxmLm1pbWVUeXBlID0gc2VsZi5fY3VzdG9tTWltZVR5cGU7XHJcbiAgICBzZWxmLl9hdWRpb0NvbnRleHQgPSBudWxsO1xyXG4gICAgc2VsZi5fYnVmZmVyID0gW107XHJcbiAgICBzZWxmLl9yZWNvcmRpbmdMZW5ndGggPSAwO1xyXG5cclxuICAgIGlmIChRQk1lZGlhUmVjb3JkZXIuX2lzTXAzRW5jb2RlcigpICYmIHRoaXMuX2N1c3RvbU1pbWVUeXBlID09PSAnYXVkaW8vbXAzJykge1xyXG4gICAgICAgIHNlbGYuX21wM2VuY29kZXIgPSBuZXcgd2luZG93LmxhbWVqcy5NcDNFbmNvZGVyKDEsIDQ4MDAwLCAxMjgpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0TWltZVR5cGUgPSBmdW5jdGlvbiAocHJlZmZlcmVkKSB7XHJcbiAgICB2YXIgbWltZVR5cGUsXHJcbiAgICAgICAgdHlwZSA9ICd2aWRlbyc7XHJcblxyXG4gICAgaWYocHJlZmZlcmVkICYmIFFCTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQocHJlZmZlcmVkKSkge1xyXG4gICAgICAgIG1pbWVUeXBlID0gcHJlZmZlcmVkO1xyXG4gICAgfSBlbHNlIGlmKHByZWZmZXJlZCkge1xyXG4gICAgICAgIHR5cGUgPSBwcmVmZmVyZWQudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2F1ZGlvJykgPT09IC0xID8gJ3ZpZGVvJyA6ICdhdWRpbyc7XHJcbiAgICAgICAgbWltZVR5cGUgPSBRQk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzKHR5cGUpWzBdO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBtaW1lVHlwZSA9IFFCTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXModHlwZSlbMF07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG1pbWVUeXBlO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0Q2FsbGJhY2tzID0gZnVuY3Rpb24ob3B0cykge1xyXG4gICAgdmFyIGNhbGxiYWNrcyA9IHt9LFxyXG4gICAgICAgIGNhbGxiYWNrTmFtZXMgPSBbJ29uc3RhcnQnLCAnb25zdG9wJywgJ29ucGF1c2UnLCAnb25yZXN1bWUnLCAnb25lcnJvcicsICdvbmNoYW5nZScsICdvbmRhdGFhdmFpbGFibGUnXTtcclxuXHJcbiAgICBjYWxsYmFja05hbWVzLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xyXG4gICAgICAgIGlmIChuYW1lIGluIG9wdHMpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2tzW25hbWVdID0gb3B0c1tuYW1lXTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gY2FsbGJhY2tzO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLl9taW1lVHlwZXMgPSByZXF1aXJlKCcuL21pbWVUeXBlcycpO1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLl9TVEFURVMgPSBbJ2luYWN0aXZlJywgJ3JlY29yZGluZycsICdwYXVzZWQnXTtcclxuXHJcbi8qKlxyXG4gKiBJdCBjaGVja3MgY2FwYWJpbGl0eSBvZiByZWNvcmRpbmcgaW4gdGhlIGVudmlyb25tZW50LlxyXG4gKiBDaGVja3MgTWVkaWFSZWNvcmRlciwgTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQgYW5kIEJsb2IuXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgUUJNZWRpYVJlY29yZGVyIGlzIGF2YWlsYWJsZSBhbmQgY2FuIHJ1biwgb3IgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBpZihRQk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSkge1xyXG4gKiAgICAgLy8gLi4uIHNob3cgVUkgZm9yIHJlY29yZGluZ1xyXG4gKiB9XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiAhISh3aW5kb3cgJiYgd2luZG93Lk1lZGlhUmVjb3JkZXIgJiYgdHlwZW9mIHdpbmRvdy5NZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCA9PT0gJ2Z1bmN0aW9uJyAmJiB3aW5kb3cuQmxvYik7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIuX2lzQXVkaW9Db250ZXh0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuICEhKHdpbmRvdyAmJiAod2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0KSk7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIuX2lzTXAzRW5jb2RlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiAhISh3aW5kb3cgJiYgKHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCkgJiYgd2luZG93LmxhbWVqcyk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJucyBhIEJvb2xlYW4gd2hpY2ggaXMgdHJ1ZSBpZiB0aGUgTUlNRSB0eXBlIHNwZWNpZmllZCBpcyBvbmUgdGhlIHVzZXIgYWdlbnQgY2FuIHJlY29yZC5cclxuICogQHBhcmFtICB7U3RyaW5nfSBtaW1lVHlwZSAtIFRoZSBtaW1lVHlwZSB0byBjaGVjay5cclxuICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgICAtIFRydWUgaWYgdGhlIE1lZGlhUmVjb3JkZXIgaW1wbGVtZW50YXRpb24gaXMgY2FwYWJsZSBvZiByZWNvcmRpbmcgQmxvYiBvYmplY3RzIGZvciB0aGUgc3BlY2lmaWVkIE1JTUUgdHlwZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogaWYoIFFCTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNCcpICkge1xyXG4gKiAgICAgZWwudGV4dENvbnRlbnQgPSAnV2lsbCBiZSByZWNvcmQgaW4gdmlkZW8vbXA0JztcclxuICogfVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCA9IGZ1bmN0aW9uKG1pbWVUeXBlKSB7XHJcbiAgICB2YXIgcmVzdWx0ID0gZmFsc2U7XHJcblxyXG4gICAgaWYoIVFCTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKCFtaW1lVHlwZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMucmVxdXJlQXJndW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaChtaW1lVHlwZSkge1xyXG4gICAgICAgIGNhc2UgJ2F1ZGlvL3dhdic6XHJcbiAgICAgICAgICAgIGlmIChRQk1lZGlhUmVjb3JkZXIuX2lzQXVkaW9Db250ZXh0KCkpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgIGNhc2UgJ2F1ZGlvL21wMyc6XHJcbiAgICAgICAgICAgIGlmIChRQk1lZGlhUmVjb3JkZXIuX2lzQXVkaW9Db250ZXh0KCkgJiYgUUJNZWRpYVJlY29yZGVyLl9pc01wM0VuY29kZXIoKSkge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgcmVzdWx0ID0gd2luZG93Lk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKG1pbWVUeXBlKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gYWxsIHN1cHBvcnRlZCBtaW1lIHR5cGVzIGFuZCBjb250YWluZXIgZm9ybWF0LlxyXG4gKiBAcGFyYW0gIHtTdHJpbmd9IFt0eXBlPXZpZGVvXSBUeXBlIG9mIG1lZGlhLlxyXG4gKiBAcmV0dXJuIHtBcnJheX0gICAgICAgICAgICAgICAgICAgQXJyYXkgb2Ygc3VwcG9ydGVkIG1pbWV0eXBlcy5SZWNvbW1lbmRlZCBtaW1ldHlwZSBoYXMgMCBpbmRleC5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogdmFyIHR5cGUgPSBRQk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzKCdhdWRpbycpO1xyXG4gKiBjb25zb2xlLmluZm8oYENhbGwgd2lsbCByZWNvcmRpbmcgaW4gJHt0eXBlWzBdfWApO1xyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLmdldFN1cHBvcnRlZE1pbWVUeXBlcyA9IGZ1bmN0aW9uKHR5cGUpIHtcclxuICAgIHZhciB0eXBlTWVkaWEgPSB0eXBlIHx8ICd2aWRlbyc7XHJcblxyXG4gICAgaWYoIVFCTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBRQk1lZGlhUmVjb3JkZXIuX21pbWVUeXBlc1t0eXBlTWVkaWFdLmZpbHRlcihmdW5jdGlvbihtaW1lVHlwZSkge1xyXG4gICAgICAgIHJldHVybiBRQk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKG1pbWVUeXBlKTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiB0aGUgY3VycmVudCBbc3RhdGUgb2YgUUJNZWRpYVJlY29yZGVyIGluc3RhbmNlXShodHRwczovL3czYy5naXRodWIuaW8vbWVkaWFjYXB0dXJlLXJlY29yZC9NZWRpYVJlY29yZGVyLmh0bWwjaWRsLWRlZi1yZWNvcmRpbmdzdGF0ZSkuXHJcbiAqIFBvc3NpYmx5IHN0YXRlczogKippbmFjdGl2ZSoqLCAqKnJlY29yZGluZyoqLCAqKnBhdXNlZCoqLlxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IE5hbWUgb2YgYSBzdGF0ZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogdmFyIHJlY29yZGVyID0gbmV3IFFCTWVkaWFSZWNvcmRlcigpO1xyXG4gKiAvLyAuLi5zb21lIGNvZGVcclxuICpcclxuICogaWYocmVjb3JkZXIuZ2V0U3RhdGUoKSA9PSAncmVjb3JkaW5nJykge1xyXG4gKiAgICAgY29uc29sZS5pbmZvKCdZb3UgYXJlIHN0aWxsIHJlY29yZGluZy4nKTtcclxuICogfVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5nZXRTdGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuX21lZGlhUmVjb3JkZXIgPyB0aGlzLl9tZWRpYVJlY29yZGVyLnN0YXRlIDogUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMF07XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIFN0YXJ0IHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogRmlyZSB0aGUgbWV0aG9kIGBzdG9wYCBpZiBhbiBpbnN0YW5jZSBpbnByb2dyZXNzIChoYXMgYSBzdGF0ZSByZWNvcmRpbmcgb3IgcGF1c2VkKS5cclxuICogRmlyZSBvbnN0YXJ0IGNhbGxiYWNrLlxyXG4gKiBAcGFyYW0ge01lZGlhU3RyZWFtfSBzdHJlYW0gLSBTdHJlYW0gb2JqZWN0IHJlcHJlc2VudGluZyBhIGZsdXggb2YgYXVkaW8tIG9yIHZpZGVvLXJlbGF0ZWQgZGF0YS5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciBvcHRpb25zID0ge1xyXG4gKiAgICAgb25zdGFydDogZnVuY3Rpb24gb25TdGFydCgpIHtcclxuICogICAgICAgICB2YXIgdGltZSA9IDAsXHJcbiAqICAgICAgICAgICAgIHN0ZXAgPSAxMDAwO1xyXG4gKiAgICAgICAgIFxyXG4gKiAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gKiAgICAgICAgICAgICB0aW1lICs9IHN0ZXA7XHJcbiAqICAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhgWW91IGFyZSByZWNvcmRpbmcgJHt0aW1lfSBzZWMuYCk7XHJcbiAqICAgICAgICAgfSwgc3RlcCk7XHJcbiAqICAgICB9XHJcbiAqIH1cclxuICpcclxuICogdmFyIHJlYyA9IG5ldyBxYlJlY29yZGVyKG9wdGlvbnMpO1xyXG4gKiAvLyAuLi5cclxuICogcmVjLnN0YXJ0KHN0cmVhbSk7XHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oc3RyZWFtKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoIXN0cmVhbSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMucmVxdXJlQXJndW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBtZWRpYVJlY29yZGVyU3RhdGUgPSB0aGlzLmdldFN0YXRlKCk7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlclN0YXRlID09PSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXSB8fCBtZWRpYVJlY29yZGVyU3RhdGUgPT09IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzJdKSB7XHJcbiAgICAgICAgdGhpcy5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYodGhpcy5fc3RyZWFtKSB7XHJcbiAgICAgICAgdGhpcy5fc3RyZWFtID0gbnVsbDtcclxuICAgIH1cclxuICAgIC8vIFRPRE86IG5lZWQgdG8gc3RyZWFtLmNsb25lXHJcbiAgICBzZWxmLl9zdHJlYW0gPSBzdHJlYW07XHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuICAgIHNlbGYuX3JlY29yZGVkQ2h1bmtzLmxlbmd0aCA9IDA7XHJcblxyXG4gICAgaWYgKHNlbGYuX2N1c3RvbU1pbWVUeXBlKSB7XHJcbiAgICAgICAgc2VsZi5fc2V0Q3VzdG9tUmVjb3JkZXIoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2VsZi5fc2V0TWVkaWFSZWNvcmRlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX3NldEV2ZW50cygpO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fc2V0TWVkaWFSZWNvcmRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBuZXcgd2luZG93Lk1lZGlhUmVjb3JkZXIoc2VsZi5fc3RyZWFtLCB7XHJcbiAgICAgICAgICAgICdtaW1lVHlwZSc6IHNlbGYubWltZVR5cGUsXHJcbiAgICAgICAgICAgICdpZ25vcmVNdXRlZE1lZGlhJzogc2VsZi5pZ25vcmVNdXRlZE1lZGlhXHJcbiAgICAgICAgfSk7XHJcbiAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLnVuc3VwcG9ydE1lZGlhUmVjb3JkZXJXaXRoT3B0aW9ucywgZSk7XHJcblxyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBuZXcgd2luZG93Lk1lZGlhUmVjb3JkZXIoc2VsZi5fc3RyZWFtKTtcclxuICAgIH1cclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3NldEN1c3RvbVJlY29yZGVyID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgc2VsZi5fY2xvc2VBdWRpb1Byb2Nlc3MoKTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0ge1xyXG4gICAgICAgICdzdGFydCc6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMV07XHJcbiAgICAgICAgICAgIHNlbGYuX3N0YXJ0QXVkaW9Qcm9jZXNzKCk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgJ3N0b3AnOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgc2VsZi5fc3RvcEF1ZGlvUHJvY2VzcygpO1xyXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMF07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgJ3BhdXNlJzogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1syXTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAncmVzdW1lJzogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAnc3RhdGUnOiBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1swXVxyXG4gICAgfTtcclxufTtcclxuXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3NldEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgIGlzTWVkaWFSZWNvcmRlciA9ICFzZWxmLl9jdXN0b21NaW1lVHlwZTtcclxuXHJcbiAgICBmdW5jdGlvbiBmaXJlQ2FsbGJhY2sobmFtZSwgYXJncykge1xyXG4gICAgICAgIGlmKE9iamVjdC5rZXlzKHNlbGYuY2FsbGJhY2tzKS5sZW5ndGggIT09IDAgJiYgdHlwZW9mIHNlbGYuY2FsbGJhY2tzW25hbWVdID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLmNhbGxiYWNrc1tuYW1lXShhcmdzKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGb3VuZGVkIGFuIGVycm9yIGluIGNhbGxiYWNrOicgKyBuYW1lLCBlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoaXNNZWRpYVJlY29yZGVyKSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbmRhdGFhdmFpbGFibGUgPSBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIGlmKGUuZGF0YSAmJiBlLmRhdGEuc2l6ZSA+IDApIHtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3JlY29yZGVkQ2h1bmtzLnB1c2goZS5kYXRhKTtcclxuICAgICAgICAgICAgICAgIGZpcmVDYWxsYmFjaygnb25kYXRhYXZhaWxhYmxlJywgZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25wYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGZpcmVDYWxsYmFjaygnb25wYXVzZScpO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9ucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgZmlyZUNhbGxiYWNrKCdvbnJlc3VtZScpO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9uZXJyb3IgPSBmdW5jdGlvbihlcnJvcikge1xyXG4gICAgICAgIHN3aXRjaChlcnJvci5uYW1lKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ0ludmFsaWRTdGF0ZSc6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ091dE9mTWVtb3J5JzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnSWxsZWdhbFN0cmVhbU1vZGlmaWNhdGlvbic6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ090aGVyUmVjb3JkaW5nRXJyb3InOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdHZW5lcmljRXJyb3InOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignTWVkaWFSZWNvcmRlciBFcnJvcicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSAhPT0gJ2luYWN0aXZlJyAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlICE9PSAnc3RvcHBlZCcpIHtcclxuICAgICAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZihzZWxmLl91c2VyQ2FsbGJhY2tzICYmIHR5cGVvZiBzZWxmLl91c2VyQ2FsbGJhY2tzLm9uRXJyb3JSZWNvcmRpbmcgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvbmVycm9yJywgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgYmxvYiA9IG5ldyBCbG9iKHNlbGYuX3JlY29yZGVkQ2h1bmtzLCB7XHJcbiAgICAgICAgICAgICd0eXBlJyA6IHNlbGYubWltZVR5cGVcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgc2VsZi5yZWNvcmRlZEJsb2JzLnB1c2goYmxvYik7XHJcbiAgICBjb25zb2xlLmxvZyhzZWxmLnJlY29yZGVkQmxvYnMpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCFzZWxmLl9rZWVwUmVjb3JkaW5nKTtcclxuICAgICAgICBpZighc2VsZi5fa2VlcFJlY29yZGluZykge1xyXG4gICAgICAgICAgICBpZihzZWxmLnJlY29yZGVkQmxvYnMubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYmxvYik7XHJcbiAgICAgICAgICAgICAgICBmaXJlQ2FsbGJhY2soJ29uc3RvcCcsIGJsb2IpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coc2VsZi5yZWNvcmRlZEJsb2JzWzBdKTtcclxuICAgICAgICAgICAgICAgIGZpcmVDYWxsYmFjaygnb25zdG9wJywgc2VsZi5yZWNvcmRlZEJsb2JzWzBdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc2VsZi5fa2VlcFJlY29yZGluZyA9IGZhbHNlO1xyXG4gICAgfTtcclxuXHJcbiAgICBpZiAoaXNNZWRpYVJlY29yZGVyKSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGFydChzZWxmLnRpbWVzbGljZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhcnQoKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc29sZS5sb2coc2VsZi5fbWVkaWFSZWNvcmRlcik7XHJcblxyXG4gICAgZmlyZUNhbGxiYWNrKCdvbnN0YXJ0Jyk7XHJcbn07XHJcblxyXG4vKipcclxuICogU3RvcCB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm4ge0Jsb2J9IEJsb2Igb2YgcmVjb3JkZWQgY2h1bmNrcy5cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXIgPSB0aGlzLl9tZWRpYVJlY29yZGVyLFxyXG4gICAgICAgIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlci5zdGF0ZSA/IG1lZGlhUmVjb3JkZXIuc3RhdGUgOiAnaW5hY3RpdmUnO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlclN0YXRlID09PSAncmVjb3JkaW5nJyl7XHJcbiAgICAgICAgbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBQYXVzZSB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKi9cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIgJiYgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSA9PT0gJ3JlY29yZGluZycpIHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnBhdXNlKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXN1bWUgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlciAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSAncGF1c2VkJykge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIucmVzdW1lKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGFuZ2UgYSByZWNvcmRlZCBzdHJlYW0uXHJcbiAqIEBwYXJhbSB7TWVkaWFTdHJlYW19IHN0cmVhbSAtIFN0cmVhbSBvYmplY3QgcmVwcmVzZW50aW5nIGEgZmx1eCBvZiBhdWRpby0gb3IgdmlkZW8tcmVsYXRlZCBkYXRhLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuY2hhbmdlID0gZnVuY3Rpb24oc3RyZWFtKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoIXN0cmVhbSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMucmVxdXJlQXJndW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX2tlZXBSZWNvcmRpbmcgPSB0cnVlOyAvLyBkb24ndCBzdG9wIGEgcmVjb3JkXHJcbiAgICBzZWxmLnN0b3AoKTtcclxuXHJcbiAgICBzZWxmLl9zdHJlYW0gPSBudWxsO1xyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcblxyXG4gICAgLy8gVE9ETyBzdHJlYW0uY2xvbmVcclxuICAgIHNlbGYuX3N0cmVhbSA9IHN0cmVhbTtcclxuXHJcbiAgICBpZiAoc2VsZi5fY3VzdG9tTWltZVR5cGUpIHtcclxuICAgICAgICBzZWxmLl9zZXRDdXN0b21SZWNvcmRlcigpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBzZWxmLl9zZXRNZWRpYVJlY29yZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fc2V0RXZlbnRzKCk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGEgZmlsZSBmcm9tIGJsb2IgYW5kIGRvd25sb2FkIGFzIHRoZSBmaWxlLiBJdHMgbWV0aG9kIHdpbGwgZmlyZSAnc3RvcCcgaWYgcmVjb3JkaW5nIGluIHByb2dyZXNzLlxyXG4gKiBAcGFyYW0ge1N0cmludH0gW2ZpbGVOYW1lPURhdGUubm93KCldIC0gTmFtZSBvZiBmaWxlLlxyXG4gKiBAcGFyYW0ge0Jsb2J9ICAgW2Jsb2JdIC0gWW91IGNhbiBzZXQgYmxvYiB3aGljaCB5b3UgZ2V0IGZyb20gdGhlIG1ldGhvZCBgc3RvcGAgb3IgZG9uJ3Qgc2V0IGFueXRoaW5nIGFuZCB3ZSB3aWxsIGdldCByZWNvcmRlZCBjaHVuY2tzLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICpcclxuICogQGV4YW1wbGVcclxuICogdmFyIHJlYyA9IG5ldyBxYlJlY29yZGVyKCk7XHJcbiAqIHJlYy5zdGFydChzdHJlYW0pO1xyXG4gKiAvLyAuLi5cclxuICogcmVjLmRvd25sb2FkKGZhbHNlKTsgLy8gU2V0IGZhbHNlLCBuYW1lIHdpbGwgYmUgZ2VuZXJhdGVkIGJhc2VkIG9uIERhdGUubm93KClcclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuZG93bmxvYWQgPSBmdW5jdGlvbihmaWxlTmFtZSwgYmxvYikge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHZhciBtZWRpYVJlY29yZGVyU3RhdGUgPSB0aGlzLmdldFN0YXRlKCk7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlclN0YXRlID09PSBRQk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXSB8fCBtZWRpYVJlY29yZGVyU3RhdGUgPT09IFFCTWVkaWFSZWNvcmRlci5fU1RBVEVTWzJdKSB7XHJcbiAgICAgICAgdGhpcy5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYiB8fCBzZWxmLl9nZXRCbG9iUmVjb3JkZWQoKSksXHJcbiAgICAgICAgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuXHJcbiAgICBhLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICBhLmhyZWYgPSB1cmw7XHJcbiAgICBhLmRvd25sb2FkID0gKGZpbGVOYW1lIHx8IERhdGUubm93KCkpICsgJy4nICsgc2VsZi5fZ2V0RXh0ZW5zaW9uKCk7XHJcblxyXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcclxuXHJcbiAgICAvLyBTdGFydCBkb3dsb2FkaW5nXHJcbiAgICBhLmNsaWNrKCk7XHJcblxyXG4gICAgLy8gUmVtb3ZlIGxpbmtcclxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChhKTtcclxuICAgICAgICB3aW5kb3cuVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xyXG4gICAgfSwgMTAwKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYSBCbG9iIGZyb20gcmVjb3JkZWQgY2h1bmtzLlxyXG4gKiBAYWNjZXNzIHByaXZhdGVcclxuICogQHBhcmFtIHtPYmplY3R9IFtkYXRhXSAtIFJlY29yZGVkIGRhdGEuXHJcbiAqIEByZXR1cm4ge09iamVjdH0gLSBCbG9iIG9mIHJlY29yZGVkIG1lZGlhIG9yIHdoYXQgeW91IHNldCBpbiBkYXRhXHJcbiAqL1xyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRCbG9iUmVjb3JkZWQgPSBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgY2h1bmtzID0gZGF0YSB8fCBzZWxmLl9yZWNvcmRlZENodW5rcztcclxuXHJcbiAgICBpZighY2h1bmtzLmxlbmd0aCkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMubm9fcmVjb3JkZWRfY2h1bmtzKTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG5ldyBCbG9iKGNodW5rcywgeyAndHlwZScgOiBzZWxmLm1pbWVUeXBlIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBhIGV4dGVuc2lvbiBvZiBhIGZpbGUuIEJhc2VkIG9uIGF2YWlsYWJsZSBtaW1lVHlwZS5cclxuICogQGFjY2VzcyBwcml2YXRlXHJcbiAqIEByZXR1cm4ge1N0cmluZ30gRm9yIGV4YW1wbGUsICd3ZWJtJyAvICdtcDQnIC8gJ29nZydcclxuICovXHJcblFCTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldEV4dGVuc2lvbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHZhciBlbmRUeXBlTWVkaWEgPSBzZWxmLm1pbWVUeXBlLmluZGV4T2YoJy8nKSxcclxuICAgICAgICBleHRlbnNpb24gPSBzZWxmLm1pbWVUeXBlLnN1YnN0cmluZyhlbmRUeXBlTWVkaWEgKyAxKSxcclxuICAgICAgICBzdGFydENvZGVjc0luZm8gPSBleHRlbnNpb24uaW5kZXhPZignOycpO1xyXG5cclxuICAgIGlmKHN0YXJ0Q29kZWNzSW5mbyAhPT0gLTEpIHtcclxuICAgICAgICBleHRlbnNpb24gPSBleHRlbnNpb24uc3Vic3RyaW5nKDAsIHN0YXJ0Q29kZWNzSW5mbyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGV4dGVuc2lvbjtcclxufTtcclxuXHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9zdGFydEF1ZGlvUHJvY2VzcyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgaWYoIVFCTWVkaWFSZWNvcmRlci5faXNBdWRpb0NvbnRleHQoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgYXVkaW9Db250ZXh0LFxyXG4gICAgICAgIGF1ZGlvSW5wdXQsXHJcbiAgICAgICAgcmVjb3JkZXIsXHJcbiAgICAgICAgdm9sdW1lO1xyXG5cclxuICAgIHNlbGYuX2Nsb3NlQXVkaW9Qcm9jZXNzKCk7XHJcblxyXG4gICAgYXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xyXG4gICAgc2VsZi5fYXVkaW9Db250ZXh0ID0gbmV3IGF1ZGlvQ29udGV4dDtcclxuICAgIHZvbHVtZSA9IHNlbGYuX2F1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XHJcbiAgICBhdWRpb0lucHV0ID0gc2VsZi5fYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHNlbGYuX3N0cmVhbSk7XHJcbiAgICByZWNvcmRlciA9IHNlbGYuX2F1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IoMTAyNCwgMSwgMSk7XHJcbiAgICBhdWRpb0lucHV0LmNvbm5lY3Qodm9sdW1lKTtcclxuXHJcbiAgICByZWNvcmRlci5vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSA9PT0gUUJNZWRpYVJlY29yZGVyLl9TVEFURVNbMV0pIHtcclxuICAgICAgICAgICAgc2VsZi5fYnVmZmVyLnB1c2gobmV3IEZsb2F0MzJBcnJheShlLmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApKSk7XHJcbiAgICAgICAgICAgIHNlbGYuX3JlY29yZGluZ0xlbmd0aCArPSAxMDI0O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdm9sdW1lLmNvbm5lY3QocmVjb3JkZXIpO1xyXG4gICAgcmVjb3JkZXIuY29ubmVjdChzZWxmLl9hdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fY2xvc2VBdWRpb1Byb2Nlc3MgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZiAoISFzZWxmLl9hdWRpb0NvbnRleHQpIHtcclxuICAgICAgICBzZWxmLl9hdWRpb0NvbnRleHQuY2xvc2UoKVxyXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHNlbGYuX2F1ZGlvQ29udGV4dCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICBzZWxmLl9yZWNvcmRpbmdMZW5ndGggPSAwO1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fYnVmZmVyID0gW107XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuUUJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fc3RvcEF1ZGlvUHJvY2VzcyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHNlbGYuX3JlY29yZGVkQ2h1bmtzID0gc2VsZi5fZ2V0QmxvYkRhdGEoKTtcclxuICAgIHNlbGYuX2Nsb3NlQXVkaW9Qcm9jZXNzKCk7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9lbmNvZGVNUDMgPSBmdW5jdGlvbihidWZmZXIpIHtcclxuICAgIHZhciBkYXRhID0gbmV3IEludDE2QXJyYXkoYnVmZmVyKSxcclxuICAgICAgICBtcDNlbmNvZGVyID0gbmV3IGxhbWVqcy5NcDNFbmNvZGVyKDEsIDQ4MDAwLCAxMjgpLFxyXG4gICAgICAgIGVuY29kZWRCdWZmZXIgPSBtcDNlbmNvZGVyLmVuY29kZUJ1ZmZlcihkYXRhKSxcclxuICAgICAgICBmbHVzaGVkQnVmZmVyID0gbXAzZW5jb2Rlci5mbHVzaCgpLFxyXG4gICAgICAgIG1wM0RhdGEgPSBbXTtcclxuXHJcbiAgICBtcDNEYXRhLnB1c2goZW5jb2RlZEJ1ZmZlcik7XHJcbiAgICBtcDNEYXRhLnB1c2gobmV3IEludDhBcnJheShmbHVzaGVkQnVmZmVyKSk7XHJcblxyXG4gICAgcmV0dXJuIG1wM0RhdGE7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9lbmNvZGVXQVYgPSBmdW5jdGlvbihzYW1wbGVzKSB7XHJcbiAgICB2YXIgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDQ0ICsgc2FtcGxlcy5sZW5ndGggKiAyKSxcclxuICAgICAgICB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XHJcblxyXG4gICAgX3dyaXRlU3RyaW5nKHZpZXcsIDAsICdSSUZGJyk7XHJcbiAgICB2aWV3LnNldFVpbnQzMig0LCAzMiArIHNhbXBsZXMubGVuZ3RoICogMiwgdHJ1ZSk7XHJcbiAgICBfd3JpdGVTdHJpbmcodmlldywgOCwgJ1dBVkUnKTtcclxuICAgIF93cml0ZVN0cmluZyh2aWV3LCAxMiwgJ2ZtdCAnKTtcclxuICAgIHZpZXcuc2V0VWludDMyKDE2LCAxNiwgdHJ1ZSk7XHJcbiAgICB2aWV3LnNldFVpbnQxNigyMCwgMSwgdHJ1ZSk7XHJcbiAgICB2aWV3LnNldFVpbnQxNigyMiwgMSwgdHJ1ZSk7XHJcbiAgICB2aWV3LnNldFVpbnQzMigyNCwgdGhpcy5zYW1wbGVSYXRlLCB0cnVlKTtcclxuICAgIHZpZXcuc2V0VWludDMyKDI4LCB0aGlzLnNhbXBsZVJhdGUgKiAyLCB0cnVlKTtcclxuICAgIHZpZXcuc2V0VWludDE2KDMyLCAyLCB0cnVlKTtcclxuICAgIHZpZXcuc2V0VWludDE2KDM0LCAxNiwgdHJ1ZSk7XHJcbiAgICBfd3JpdGVTdHJpbmcodmlldywgMzYsICdkYXRhJyk7XHJcbiAgICB2aWV3LnNldFVpbnQzMig0MCwgc2FtcGxlcy5sZW5ndGggKiAyLCB0cnVlKTtcclxuXHJcbiAgICBfZmxvYXRUbzE2Qml0UENNKHZpZXcsIDQ0LCBzYW1wbGVzKTtcclxuXHJcbiAgICBmdW5jdGlvbiBfZmxvYXRUbzE2Qml0UENNKG91dHB1dCwgb2Zmc2V0LCBpbnB1dCkge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyssIG9mZnNldCArPSAyKSB7XHJcbiAgICAgICAgICAgIHZhciBzID0gTWF0aC5tYXgoLTEsIE1hdGgubWluKDEsIGlucHV0W2ldKSk7XHJcbiAgICAgICAgICAgIG91dHB1dC5zZXRJbnQxNihvZmZzZXQsIHMgPCAwID8gcyAqIDB4ODAwMCA6IHMgKiAweDdGRkYsIHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfd3JpdGVTdHJpbmcodmlldywgb2Zmc2V0LCBzdHJpbmcpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2aWV3LnNldFVpbnQ4KG9mZnNldCArIGksIHN0cmluZy5jaGFyQ29kZUF0KGkpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHZpZXc7XHJcbn07XHJcblxyXG5RQk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRCbG9iRGF0YSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgIHJlc3VsdCA9IG5ldyBGbG9hdDMyQXJyYXkoc2VsZi5fcmVjb3JkaW5nTGVuZ3RoKSxcclxuICAgICAgICBidWZmZXJMZW5ndGggPSBzZWxmLl9idWZmZXIubGVuZ3RoLFxyXG4gICAgICAgIG9mZnNldCA9IDAsXHJcbiAgICAgICAgYnVmZmVyLFxyXG4gICAgICAgIHZpZXcsXHJcbiAgICAgICAgZGF0YTtcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKXtcclxuICAgICAgICBidWZmZXIgPSBzZWxmLl9idWZmZXJbaV07XHJcbiAgICAgICAgcmVzdWx0LnNldChidWZmZXIsIG9mZnNldCk7XHJcbiAgICAgICAgb2Zmc2V0ICs9IGJ1ZmZlci5sZW5ndGg7XHJcbiAgICB9XHJcblxyXG4gICAgdmlldyA9IHNlbGYuX2VuY29kZVdBVihyZXN1bHQpO1xyXG5cclxuICAgIHN3aXRjaChzZWxmLl9jdXN0b21NaW1lVHlwZSkge1xyXG4gICAgICAgIGNhc2UgJ2F1ZGlvL3dhdic6XHJcbiAgICAgICAgICAgIGRhdGEgPSBbdmlld107XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICBjYXNlICdhdWRpby9tcDMnOlxyXG4gICAgICAgICAgICBkYXRhID0gc2VsZi5fZW5jb2RlTVAzKHZpZXcuYnVmZmVyKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGRhdGE7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFFCTWVkaWFSZWNvcmRlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgICdhdWRpbyc6IFtcclxuICAgICAgICAnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycsXHJcbiAgICAgICAgJ2F1ZGlvL3dlYm0nLFxyXG4gICAgICAgICdhdWRpby9vZ2cnLFxyXG4gICAgICAgICdhdWRpby93YXYnLFxyXG4gICAgICAgICdhdWRpby9tcDMnXHJcbiAgICBdLFxyXG4gICAgJ3ZpZGVvJzogW1xyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1oMjY0JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA5JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA4JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9ZGFhbGEnLFxyXG4gICAgICAgICd2aWRlby93ZWJtJyxcclxuICAgICAgICAndmlkZW8vbXA0JyxcclxuICAgICAgICAndmlkZW8vbXBlZydcclxuICAgIF1cclxufTsiXX0=
