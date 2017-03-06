'use strict';

/*global lamejs, Float32Array, Int16Array, Int8Array, ArrayBuffer, DataView */


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

    if (self._audioContext) {
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
    }

    return data;
};

module.exports = QBMediaRecorder;