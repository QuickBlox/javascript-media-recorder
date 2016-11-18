/* JSHint inline rules */
/* jshint node: true, browser: true */ 

'use strict';

var ERRORS = require('./errors');

/**  
 * @constructor qbMediaRecorder
 * @param  {mediaStream} stream object representing a flux of audio- or video-related data.
 * @param  {object} opts        see example
 *
 * @example
 * opts = {
 *     mimeType: 'audio',       // set mime type of record media or only type of media: 'video'/'audio'.
 *     ignoreMutedMedia: false, // What to do with a muted input MediaStreamTrack,
 *                              // e.g. insert black frames/zero audio volume in the recording or ignore altogether.
 *                              // By default is `true`.
 *     timeSlice: 1000,         // optionally be passed a timeslice argument with a value in milliseconds.
 *                              // the media will be captured in separate chunks of that duration,
 *                              // rather than the default behavior of recording the media in a single large chunk.
 *     callbacks: {             // Note! Use named function for better debug.
 *         onStart: function startRecord() {
 *             //...
 *         },
 *         onError: function errorRecord(error) {
 *             //...
 *         },
 *         onPause: function pauseRecord() {
 *             //...
 *         },
 *         onStop: function stopRecord(blob) {
 *             //...
 *         },
 *         onResume: function resimeRecord() {
 *             //...
 *         }
 *     }
 * }
 */
function qbMediaRecorder(stream, opts) {
    var self = this;

    if(!qbMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    self._stream = null;
    
    self._mediaRecorder = null;
    self._recordedChunks = [];

    self._timeSlice = opts && opts.timeSlice ? opts.timeSlice : 1000;
    self._userCallbacks = opts && opts.callbacks ? opts.callbacks : null; 

    var typeMediaRecorded = 'video', // by default
        prefferedMimeType = opts && opts.mimeType;

    if(prefferedMimeType) {
        typeMediaRecorded = prefferedMimeType.toString().toLowerCase().indexOf('audio') === -1 ? 'video' : 'audio';
    }

    self._options = {
        mimeType: qbMediaRecorder.getSupportedMimeTypes(typeMediaRecorded, prefferedMimeType)[0],
        ignoreMutedMedia: opts && typeof opts.ignoreMutedMedia !== undefined ? opts.ignoreMutedMedia : true
    };
}

/**
 * Checking is environment supports recording.
 * @return {Boolean} Returns true if the qbMediaRecorder is available and can run, or false otherwise.
 */
qbMediaRecorder.isAvailable = function(){
    return !!(window && window.MediaRecorder && typeof window.MediaRecorder.isTypeSupported === 'function');
};

/**
 * @access private
 * 
 * All available mime types in browser environment.
 * @type {Object}
 */
qbMediaRecorder._mimeTypes = {
    'audio': [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg'
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

/**
 * Checking all mime types for support in browser enviroment. Recommended mime type has 0 index.
 * 
 * @param  {string} prefferedTypeMedia 'audio' or 'video'. What type of media you want to check support.
 *                                     By default is 'video'.
 * @return {array}                     Array of supported mimetypes.
 */
qbMediaRecorder.getSupportedMimeTypes = function(prefferedTypeMedia) {
    var self = this,
        supportedMimeType = [],
        typeMedia = prefferedTypeMedia || 'video';

    if(!qbMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    return qbMediaRecorder._mimeTypes[typeMedia].filter(function(mimeType) {
        return window.MediaRecorder.isTypeSupported(mimeType);
    });
};

qbMediaRecorder.prototype.getState = function() {
    return this._mediaRecorder.state;
};

/**
 * Start to recording a stream.
 * Fire the method `stop` if record has state `inprogress`.
 */
qbMediaRecorder.prototype.start = function() {
    var self = this;

    function fireCallback(name, args) {
        if(self._userCallbacks && typeof self._userCallbacks[name] === 'function') {
            try {
                self._userCallbacks[name](args);
            } catch(e) {
                console.error('Founded an error in callback:' + name, e);
            }
        }
    }

    /* Clear data from previously recording */ 
    self._mediaRecorder = null;
    self._recordedChunks.length = 0;

    try {
        self._mediaRecorder = new window.MediaRecorder(self._stream, self._options);
    } catch(e) {
        console.info(ERRORS.unsupportMediaRecorderWithOptions, e);

        self._mediaRecorder = new window.MediaRecorder(self._stream);
    }

    self._mediaRecorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) {
           self._recordedChunks.push(e.data);
        }
    };

    self._mediaRecorder.onpause = function() {
        fireCallback('onPause');
    };

    self._mediaRecorder.onresume = function() {
        fireCallback('onResume');
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
            fireCallback('onError', error);
        }
    };

    self._mediaRecorder.onstop = function(e) {
        var blob = new Blob(self._recordedChunks, {
            'type' : self._options.mimeType
        });

        fireCallback('onStop', blob);
    };

    self._mediaRecorder.start(self._timeSlice);

    fireCallback('onStart');
};

/**
 * Stop to recording a stream.
 * @return {Blob} Blob of recorded chuncks.
 */
qbMediaRecorder.prototype.stop = function() {
    var mediaRecorder = this._mediaRecorder,
        mediaRecorderState = mediaRecorder.state;

    if(mediaRecorder && mediaRecorderState === 'recording'){
        mediaRecorder.stop();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

/**
 * Pause to recording a stream.
 */
qbMediaRecorder.prototype.pause = function() {
    var self = this;

    if(self._mediaRecorder && self._mediaRecorder.state === 'recording') {
        self._mediaRecorder.pause();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

/**
 * Resume to recording a stream.
 */
qbMediaRecorder.prototype.resume = function() {
    var self = this;

    if(self._mediaRecorder && self._mediaRecorder.state === 'paused') {
        self._mediaRecorder.resume();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

/**
 * Return a [state of recording](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/state).
 * Possibly, inactive / paused / recording 
 * @return {String} A state of recording. 
 */
qbMediaRecorder.prototype.getState = function() {
    return this._mediaRecorder.state;
};

/**
 * Create a file from blob and download as the file. Its method will fire 'stop' if recording in progress.
 * @param  {Strint} fileName Name of file. You can set `false` and we are generate name of file based on Date.now()
 * @param  {Blob}   blob     You can set blob which you get from the method `stop` or don't set anything and
 *                           we will get recorded chuncks.
 */
qbMediaRecorder.prototype.download = function(fileName, blob) {
    var self = this;

    var mediaRecorder = this._mediaRecorder,
        mediaRecorderState = mediaRecorder.state;

    if(mediaRecorder && mediaRecorderState === 'recording') {
        mediaRecorder.stop();
    }

    var url = URL.createObjectURL(blob || self._getBlobRecorded()),
        a = document.createElement('a');

    a.style.display = 'none';
    a.href = url;
    a.download = (fileName || Date.now()) + '.' + self._getExtension();

    document.body.appendChild(a);

    /* Start dowloading */
    a.click();
    
    /* Remove link */
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
};

/**
 * Create a Blob from recorded chunks.
 * @access private
 * @return {Blob}
 */
qbMediaRecorder.prototype._getBlobRecorded = function(data) {
    var self = this,
        chunks = data || self._recordedChunks;

    if(!chunks.length) {
        console.warn(ERRORS.no_recorded_chunks);
        return false;
    }

    return new Blob(chunks, { 'type' : self._options.mimeType });
};

/**
 * Return a extension of a file. Based on avaible mimeType.
 * @access private
 * @return {String} For example, 'webm' / 'mp4' / 'ogg'
 */
qbMediaRecorder.prototype._getExtension = function() {
    var self = this;

    var endTypeMedia = self._options.mimeType.indexOf('/'),
        extension = self._options.mimeType.substring(endTypeMedia + 1),
        startCodecsInfo = extension.indexOf(';');

    if(startCodecsInfo !== -1) {
        extension = extension.substring(0, startCodecsInfo);
    }

    return extension;
};



module.exports = qbMediaRecorder;
