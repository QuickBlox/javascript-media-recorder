(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.qbMediaRecorder = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* JSHint inline */ 
/* jshint node: true */ 

'use strict';

var ERRORS ={

};

var ERRORS_MEDIA_RECORDER = {
    'InvalidState': 'The MediaRecorder is not in a state in which the proposed operation is allowed to be executed.',
    'OutOfMemory': 'The UA has exhaused the available memory. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'IllegalStreamModification': 'A modification to the stream has occurred that makes it impossible to continue recording. An example would be the addition of a Track while recording is occurring. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'OtherRecordingError': 'Used for an fatal error other than those listed above. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'GenericError': 'The UA cannot provide the codec or recording option that has been requested'
};

module.exports = {
    'ERRORS': ERRORS,
    'ERRORS_MEDIA_RECORDER': ERRORS_MEDIA_RECORDER
};
},{}],2:[function(require,module,exports){
/* JSHint inline rules */
/* globals MediaStream, MediaRecorder, URL, Blob, navigator */
/* jshint node: true */ 

'use strict';

/**
 * Stream Record Module
 * 
 * User's callbacks (listener-functions):
 * - onStartRecording
 * - onPauseRecording
 * - onStopRecording
 * - onErrorRecording
 *
 * @module Recorder
 *
 * @example
 * var options = {
 *     mimeType: 'video/mp4', // or set 'video' or 'audio' only
 *     audioBitsPerSecond : 256 * 8 * 1024,
 *     videoBitsPerSecond : 256 * 8 * 1024,
 *     bitsPerSecond: 256 * 8 * 1024,  // if this is provided, skip audioBitsPerSecond / videoBitsPerSecond
 *     callbacks: {
 *         onStartRecording: function startRecord() {
 *             console.log('Start recording...');
 *         },
 *         onErrorRecording: function errorRecord(error) {
 *             //...
 *         },
 *         onPauseRecording: function pauseRecord() {
 *             //...
 *         },
 *         onStopRecording: function stopRecord(blob) {
 *             //...
 *         },
 *         onResumeRecording: function resimeRecord() {
 *             //...
 *         }
 *     }
 * }
 * 
 * var recorder = new QB.Recorder(stream, options);
 * // start record
 * recorder.record();
 * 
 */

var ERRORS = require('./errors');
console.info(ERRORS);

function Recorder(mediaStream, opts) {
    var self = this;

    if(!Recorder.isAvailable()) {
        throw new Error('QBRecorder isn\'t avaible.');
    }

    var typeOfRecorded = 'video',
        clientMimeType = opts && opts.mimeType;

    var BITS_PER_SECOND = 256 * 8 * 1024;

    self._mediaStream = null;
    self._userCallbacks = opts && opts.callbacks ? opts.callbacks : null; 

    if(clientMimeType) {
        typeOfRecorded = opts.mimeType.toString().toLowerCase().indexOf('audio') === -1 ? 'video' : 'audio';
    }

    /* prepare self._mediaStream for record */
    if(typeOfRecorded === 'audio') {
        if(mediaStream.getVideoTracks().length && mediaStream.getAudioTracks().length) {
            var stream;

            if (!!navigator.mozGetUserMedia) {
                stream = new MediaStream();
                stream.addTrack(mediaStream.getAudioTracks()[0]);
            } else {
                stream = new MediaStream(mediaStream.getAudioTracks());
            }

            self._mediaStream = stream;
        }
    } else {
        self._mediaStream = mediaStream;
    }

    /* prepare setting for MediaRecorder */
    self.mediaRecorderOptions = {
        mimeType: Recorder.getSupportedMimeType(typeOfRecorded, clientMimeType),
        audioBitsPerSecond: opts && opts.audioBitsPerSecond ? opts.audioBitsPerSecond : BITS_PER_SECOND,
        videoBitsPerSecond : opts && opts.videoBitsPerSecond ? opts.videoBitsPerSecond : BITS_PER_SECOND,
        bitsPerSecond: opts && opts.bitsPerSecond ? opts.bitsPerSecond : BITS_PER_SECOND
    };

    this._mediaRecorder = null;
    self._recordedBlobs = [];
}

Recorder._isAvailable = !!(window && window.MediaRecorder);

Recorder.isAvailable = function(){
    return Recorder._isAvailable;
};

Recorder._mimeTypes = {
    audio: [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg'
    ],
    video: [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm;codecs=daala',
        'video/webm;codecs=h264',
        'video/webm',
        'video/mp4',
        'video/mpeg'
    ]
};

Recorder.getSupportedMimeType = function(type, clientMimeType) {
    var supportedMimeType;

    if(!type && type === '') {
        throw new Error('Set type of record is require.');
    }

    if(!MediaRecorder.isTypeSupported) {
        supportedMimeType = 'video/mp4';
    } else {
        if(clientMimeType && MediaRecorder.isTypeSupported(clientMimeType)) {
            supportedMimeType = clientMimeType;
        } else {
            Recorder._mimeTypes[type].some(function(item) {
                if(MediaRecorder.isTypeSupported(item)) {
                    supportedMimeType = item;
                    return true;
                }

                return false;
            });
        }
    }

    return supportedMimeType;
};

Recorder.prototype.getExtension = function() {
    var self = this;

    if(!self.mediaRecorderOptions) {
        throw new Error('Options isn\'t set');
    }

    var endTypeMedia = self.mediaRecorderOptions.mimeType.indexOf('/'),
        extension = self.mediaRecorderOptions.mimeType.substring(endTypeMedia + 1),
        startCodecsInfo = extension.indexOf(';');

    if(startCodecsInfo !== -1) {
        extension = extension.substring(0, startCodecsInfo);
    }

    return extension;
};

Recorder.prototype.start = function() {
    var self = this;

    if (self._mediaRecorder) {
        self._mediaRecorder = null;
    }

    try {
        self._mediaRecorder = new MediaRecorder(self._mediaStream, self.mediaRecorderOptions);
    } catch(e) {
        self._mediaRecorder = new MediaRecorder(self._mediaStream);
    }

    self._mediaRecorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) {
           self._recordedBlobs.push(e.data);
        }
    };

    self._mediaRecorder.onerror = function(error) {
        if (error.name === 'InvalidState') {
            console.error('The MediaRecorder is not in a state in which the proposed operation is allowed to be executed.');
        } else if (error.name === 'OutOfMemory') {
            console.error('The UA has exhaused the available memory. User agents SHOULD provide as much additional information as possible in the message attribute.');
        } else if (error.name === 'IllegalStreamModification') {
            console.error('A modification to the stream has occurred that makes it impossible to continue recording. An example would be the addition of a Track while recording is occurring. User agents SHOULD provide as much additional information as possible in the message attribute.');
        } else if (error.name === 'OtherRecordingError') {
            console.error('Used for an fatal error other than those listed above. User agents SHOULD provide as much additional information as possible in the message attribute.');
        } else if (error.name === 'GenericError') {
            console.error('The UA cannot provide the codec or recording option that has been requested.', error);
        } else {
            console.error('MediaRecorder Error', error);
        }

        if(self._mediaRecorder.state !== 'inactive' && self._mediaRecorder.state !== 'stopped') {
            self._mediaRecorder.stop();
        }

        if(self._userCallbacks && typeof self._userCallbacks.onErrorRecording === 'function') {
            self._userCallbacks.onErrorRecording(error);
        }
    };

    self._mediaRecorder.onstop = function(e) {
        var blob = new Blob(self._recordedBlobs, {
            'type' : self.mediaRecorderOptions.mimeType
        });

        if(self._userCallbacks && typeof self._userCallbacks.onStopRecording === 'function') {
            self._userCallbacks.onStopRecording(blob);
        }
    };

    self._mediaRecorder.onpause = function() {
        if(self._userCallbacks && typeof self._userCallbacks.onPauseRecording === 'function') {
            self._userCallbacks.onPauseRecording();
        }
    };

    self._mediaRecorder.onresume = function() {
        if(self._userCallbacks && typeof self._userCallbacks.onResumeRecording === 'function') {
            self._userCallbacks.onResumeRecording();
        }
    };

    self._mediaRecorder.start(1000);

    if(self._userCallbacks && typeof self._userCallbacks.onStartRecording === 'function') {
        self._userCallbacks.onStartRecording();
    }
};

Recorder.prototype.stop = function() {
    var mediaRec = this._mediaRecorder;

    if(mediaRec && mediaRec.state !== 'inactive' && mediaRec.state !== 'stopped'){
        mediaRec.stop();
    } else {
        console.warn('[Recorder stop]: MediaRecorder isn\'t created or has invalid state');
    }
};

Recorder.prototype.pause = function() {
    var self = this;

    if(self._mediaRecorder && self._mediaRecorder.state === 'recording') {
        self._mediaRecorder.pause();

        // Firefox doesn't fire onpause event
        if(navigator.mozGetUserMedia) {
            if(self._userCallbacks && typeof self._userCallbacks.onPauseRecording === 'function') {
                self._userCallbacks.onPauseRecording();
            }
        }
    } else {
        console.warn('[Recorder pause]: MediaRecorder isn\'t created or has invalid state.');
    }
};

Recorder.prototype.resume = function() {
    var self = this;

    if(self._mediaRecorder && self._mediaRecorder.state === 'paused') {
        self._mediaRecorder.resume();

        // Firefox doesn't fire onpause event
        if(navigator.mozGetUserMedia) {
            if(self._userCallbacks && typeof self._userCallbacks.onResumeRecording === 'function') {
                self._userCallbacks.onResumeRecording();
            }
        }
    } else {
        console.warn('[Recorder resume]: MediaRecorder isn\'t created or has invalid state.');
    }
};

Recorder.prototype.download = function(blob, downloadFileName) {
    var self = this;

    var url = URL.createObjectURL(blob || self._recordedBlobs),
        a = document.createElement('a');

    a.style.display = 'none';
    a.href = url;
    a.download = (downloadFileName || Date.now()) + '.' + self.getExtension();

    document.body.appendChild(a);

    /* Start dowloading */
    a.click();
    
    /* Remove link */
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
};

module.exports = Recorder;

},{"./errors":1}]},{},[2])(2)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIEpTSGludCBpbmxpbmUgKi8gXHJcbi8qIGpzaGludCBub2RlOiB0cnVlICovIFxyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEVSUk9SUyA9e1xyXG5cclxufTtcclxuXHJcbnZhciBFUlJPUlNfTUVESUFfUkVDT1JERVIgPSB7XHJcbiAgICAnSW52YWxpZFN0YXRlJzogJ1RoZSBNZWRpYVJlY29yZGVyIGlzIG5vdCBpbiBhIHN0YXRlIGluIHdoaWNoIHRoZSBwcm9wb3NlZCBvcGVyYXRpb24gaXMgYWxsb3dlZCB0byBiZSBleGVjdXRlZC4nLFxyXG4gICAgJ091dE9mTWVtb3J5JzogJ1RoZSBVQSBoYXMgZXhoYXVzZWQgdGhlIGF2YWlsYWJsZSBtZW1vcnkuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJzogJ0EgbW9kaWZpY2F0aW9uIHRvIHRoZSBzdHJlYW0gaGFzIG9jY3VycmVkIHRoYXQgbWFrZXMgaXQgaW1wb3NzaWJsZSB0byBjb250aW51ZSByZWNvcmRpbmcuIEFuIGV4YW1wbGUgd291bGQgYmUgdGhlIGFkZGl0aW9uIG9mIGEgVHJhY2sgd2hpbGUgcmVjb3JkaW5nIGlzIG9jY3VycmluZy4gVXNlciBhZ2VudHMgU0hPVUxEIHByb3ZpZGUgYXMgbXVjaCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlIGluIHRoZSBtZXNzYWdlIGF0dHJpYnV0ZS4nLFxyXG4gICAgJ090aGVyUmVjb3JkaW5nRXJyb3InOiAnVXNlZCBmb3IgYW4gZmF0YWwgZXJyb3Igb3RoZXIgdGhhbiB0aG9zZSBsaXN0ZWQgYWJvdmUuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdHZW5lcmljRXJyb3InOiAnVGhlIFVBIGNhbm5vdCBwcm92aWRlIHRoZSBjb2RlYyBvciByZWNvcmRpbmcgb3B0aW9uIHRoYXQgaGFzIGJlZW4gcmVxdWVzdGVkJ1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICAnRVJST1JTJzogRVJST1JTLFxyXG4gICAgJ0VSUk9SU19NRURJQV9SRUNPUkRFUic6IEVSUk9SU19NRURJQV9SRUNPUkRFUlxyXG59OyIsIi8qIEpTSGludCBpbmxpbmUgcnVsZXMgKi9cclxuLyogZ2xvYmFscyBNZWRpYVN0cmVhbSwgTWVkaWFSZWNvcmRlciwgVVJMLCBCbG9iLCBuYXZpZ2F0b3IgKi9cclxuLyoganNoaW50IG5vZGU6IHRydWUgKi8gXHJcblxyXG4ndXNlIHN0cmljdCc7XHJcblxyXG4vKipcclxuICogU3RyZWFtIFJlY29yZCBNb2R1bGVcclxuICogXHJcbiAqIFVzZXIncyBjYWxsYmFja3MgKGxpc3RlbmVyLWZ1bmN0aW9ucyk6XHJcbiAqIC0gb25TdGFydFJlY29yZGluZ1xyXG4gKiAtIG9uUGF1c2VSZWNvcmRpbmdcclxuICogLSBvblN0b3BSZWNvcmRpbmdcclxuICogLSBvbkVycm9yUmVjb3JkaW5nXHJcbiAqXHJcbiAqIEBtb2R1bGUgUmVjb3JkZXJcclxuICpcclxuICogQGV4YW1wbGVcclxuICogdmFyIG9wdGlvbnMgPSB7XHJcbiAqICAgICBtaW1lVHlwZTogJ3ZpZGVvL21wNCcsIC8vIG9yIHNldCAndmlkZW8nIG9yICdhdWRpbycgb25seVxyXG4gKiAgICAgYXVkaW9CaXRzUGVyU2Vjb25kIDogMjU2ICogOCAqIDEwMjQsXHJcbiAqICAgICB2aWRlb0JpdHNQZXJTZWNvbmQgOiAyNTYgKiA4ICogMTAyNCxcclxuICogICAgIGJpdHNQZXJTZWNvbmQ6IDI1NiAqIDggKiAxMDI0LCAgLy8gaWYgdGhpcyBpcyBwcm92aWRlZCwgc2tpcCBhdWRpb0JpdHNQZXJTZWNvbmQgLyB2aWRlb0JpdHNQZXJTZWNvbmRcclxuICogICAgIGNhbGxiYWNrczoge1xyXG4gKiAgICAgICAgIG9uU3RhcnRSZWNvcmRpbmc6IGZ1bmN0aW9uIHN0YXJ0UmVjb3JkKCkge1xyXG4gKiAgICAgICAgICAgICBjb25zb2xlLmxvZygnU3RhcnQgcmVjb3JkaW5nLi4uJyk7XHJcbiAqICAgICAgICAgfSxcclxuICogICAgICAgICBvbkVycm9yUmVjb3JkaW5nOiBmdW5jdGlvbiBlcnJvclJlY29yZChlcnJvcikge1xyXG4gKiAgICAgICAgICAgICAvLy4uLlxyXG4gKiAgICAgICAgIH0sXHJcbiAqICAgICAgICAgb25QYXVzZVJlY29yZGluZzogZnVuY3Rpb24gcGF1c2VSZWNvcmQoKSB7XHJcbiAqICAgICAgICAgICAgIC8vLi4uXHJcbiAqICAgICAgICAgfSxcclxuICogICAgICAgICBvblN0b3BSZWNvcmRpbmc6IGZ1bmN0aW9uIHN0b3BSZWNvcmQoYmxvYikge1xyXG4gKiAgICAgICAgICAgICAvLy4uLlxyXG4gKiAgICAgICAgIH0sXHJcbiAqICAgICAgICAgb25SZXN1bWVSZWNvcmRpbmc6IGZ1bmN0aW9uIHJlc2ltZVJlY29yZCgpIHtcclxuICogICAgICAgICAgICAgLy8uLi5cclxuICogICAgICAgICB9XHJcbiAqICAgICB9XHJcbiAqIH1cclxuICogXHJcbiAqIHZhciByZWNvcmRlciA9IG5ldyBRQi5SZWNvcmRlcihzdHJlYW0sIG9wdGlvbnMpO1xyXG4gKiAvLyBzdGFydCByZWNvcmRcclxuICogcmVjb3JkZXIucmVjb3JkKCk7XHJcbiAqIFxyXG4gKi9cclxuXHJcbnZhciBFUlJPUlMgPSByZXF1aXJlKCcuL2Vycm9ycycpO1xyXG5jb25zb2xlLmluZm8oRVJST1JTKTtcclxuXHJcbmZ1bmN0aW9uIFJlY29yZGVyKG1lZGlhU3RyZWFtLCBvcHRzKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoIVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1FCUmVjb3JkZXIgaXNuXFwndCBhdmFpYmxlLicpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB0eXBlT2ZSZWNvcmRlZCA9ICd2aWRlbycsXHJcbiAgICAgICAgY2xpZW50TWltZVR5cGUgPSBvcHRzICYmIG9wdHMubWltZVR5cGU7XHJcblxyXG4gICAgdmFyIEJJVFNfUEVSX1NFQ09ORCA9IDI1NiAqIDggKiAxMDI0O1xyXG5cclxuICAgIHNlbGYuX21lZGlhU3RyZWFtID0gbnVsbDtcclxuICAgIHNlbGYuX3VzZXJDYWxsYmFja3MgPSBvcHRzICYmIG9wdHMuY2FsbGJhY2tzID8gb3B0cy5jYWxsYmFja3MgOiBudWxsOyBcclxuXHJcbiAgICBpZihjbGllbnRNaW1lVHlwZSkge1xyXG4gICAgICAgIHR5cGVPZlJlY29yZGVkID0gb3B0cy5taW1lVHlwZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkuaW5kZXhPZignYXVkaW8nKSA9PT0gLTEgPyAndmlkZW8nIDogJ2F1ZGlvJztcclxuICAgIH1cclxuXHJcbiAgICAvKiBwcmVwYXJlIHNlbGYuX21lZGlhU3RyZWFtIGZvciByZWNvcmQgKi9cclxuICAgIGlmKHR5cGVPZlJlY29yZGVkID09PSAnYXVkaW8nKSB7XHJcbiAgICAgICAgaWYobWVkaWFTdHJlYW0uZ2V0VmlkZW9UcmFja3MoKS5sZW5ndGggJiYgbWVkaWFTdHJlYW0uZ2V0QXVkaW9UcmFja3MoKS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgdmFyIHN0cmVhbTtcclxuXHJcbiAgICAgICAgICAgIGlmICghIW5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEpIHtcclxuICAgICAgICAgICAgICAgIHN0cmVhbSA9IG5ldyBNZWRpYVN0cmVhbSgpO1xyXG4gICAgICAgICAgICAgICAgc3RyZWFtLmFkZFRyYWNrKG1lZGlhU3RyZWFtLmdldEF1ZGlvVHJhY2tzKClbMF0pO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3RyZWFtID0gbmV3IE1lZGlhU3RyZWFtKG1lZGlhU3RyZWFtLmdldEF1ZGlvVHJhY2tzKCkpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzZWxmLl9tZWRpYVN0cmVhbSA9IHN0cmVhbTtcclxuICAgICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHNlbGYuX21lZGlhU3RyZWFtID0gbWVkaWFTdHJlYW07XHJcbiAgICB9XHJcblxyXG4gICAgLyogcHJlcGFyZSBzZXR0aW5nIGZvciBNZWRpYVJlY29yZGVyICovXHJcbiAgICBzZWxmLm1lZGlhUmVjb3JkZXJPcHRpb25zID0ge1xyXG4gICAgICAgIG1pbWVUeXBlOiBSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZSh0eXBlT2ZSZWNvcmRlZCwgY2xpZW50TWltZVR5cGUpLFxyXG4gICAgICAgIGF1ZGlvQml0c1BlclNlY29uZDogb3B0cyAmJiBvcHRzLmF1ZGlvQml0c1BlclNlY29uZCA/IG9wdHMuYXVkaW9CaXRzUGVyU2Vjb25kIDogQklUU19QRVJfU0VDT05ELFxyXG4gICAgICAgIHZpZGVvQml0c1BlclNlY29uZCA6IG9wdHMgJiYgb3B0cy52aWRlb0JpdHNQZXJTZWNvbmQgPyBvcHRzLnZpZGVvQml0c1BlclNlY29uZCA6IEJJVFNfUEVSX1NFQ09ORCxcclxuICAgICAgICBiaXRzUGVyU2Vjb25kOiBvcHRzICYmIG9wdHMuYml0c1BlclNlY29uZCA/IG9wdHMuYml0c1BlclNlY29uZCA6IEJJVFNfUEVSX1NFQ09ORFxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLl9tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuICAgIHNlbGYuX3JlY29yZGVkQmxvYnMgPSBbXTtcclxufVxyXG5cclxuUmVjb3JkZXIuX2lzQXZhaWxhYmxlID0gISEod2luZG93ICYmIHdpbmRvdy5NZWRpYVJlY29yZGVyKTtcclxuXHJcblJlY29yZGVyLmlzQXZhaWxhYmxlID0gZnVuY3Rpb24oKXtcclxuICAgIHJldHVybiBSZWNvcmRlci5faXNBdmFpbGFibGU7XHJcbn07XHJcblxyXG5SZWNvcmRlci5fbWltZVR5cGVzID0ge1xyXG4gICAgYXVkaW86IFtcclxuICAgICAgICAnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycsXHJcbiAgICAgICAgJ2F1ZGlvL3dlYm0nLFxyXG4gICAgICAgICdhdWRpby9vZ2cnXHJcbiAgICBdLFxyXG4gICAgdmlkZW86IFtcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA5JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA4JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9ZGFhbGEnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1oMjY0JyxcclxuICAgICAgICAndmlkZW8vd2VibScsXHJcbiAgICAgICAgJ3ZpZGVvL21wNCcsXHJcbiAgICAgICAgJ3ZpZGVvL21wZWcnXHJcbiAgICBdXHJcbn07XHJcblxyXG5SZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZSA9IGZ1bmN0aW9uKHR5cGUsIGNsaWVudE1pbWVUeXBlKSB7XHJcbiAgICB2YXIgc3VwcG9ydGVkTWltZVR5cGU7XHJcblxyXG4gICAgaWYoIXR5cGUgJiYgdHlwZSA9PT0gJycpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NldCB0eXBlIG9mIHJlY29yZCBpcyByZXF1aXJlLicpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKCFNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCkge1xyXG4gICAgICAgIHN1cHBvcnRlZE1pbWVUeXBlID0gJ3ZpZGVvL21wNCc7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmKGNsaWVudE1pbWVUeXBlICYmIE1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKGNsaWVudE1pbWVUeXBlKSkge1xyXG4gICAgICAgICAgICBzdXBwb3J0ZWRNaW1lVHlwZSA9IGNsaWVudE1pbWVUeXBlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIFJlY29yZGVyLl9taW1lVHlwZXNbdHlwZV0uc29tZShmdW5jdGlvbihpdGVtKSB7XHJcbiAgICAgICAgICAgICAgICBpZihNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZChpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHN1cHBvcnRlZE1pbWVUeXBlID0gaXRlbTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gc3VwcG9ydGVkTWltZVR5cGU7XHJcbn07XHJcblxyXG5SZWNvcmRlci5wcm90b3R5cGUuZ2V0RXh0ZW5zaW9uID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoIXNlbGYubWVkaWFSZWNvcmRlck9wdGlvbnMpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ09wdGlvbnMgaXNuXFwndCBzZXQnKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgZW5kVHlwZU1lZGlhID0gc2VsZi5tZWRpYVJlY29yZGVyT3B0aW9ucy5taW1lVHlwZS5pbmRleE9mKCcvJyksXHJcbiAgICAgICAgZXh0ZW5zaW9uID0gc2VsZi5tZWRpYVJlY29yZGVyT3B0aW9ucy5taW1lVHlwZS5zdWJzdHJpbmcoZW5kVHlwZU1lZGlhICsgMSksXHJcbiAgICAgICAgc3RhcnRDb2RlY3NJbmZvID0gZXh0ZW5zaW9uLmluZGV4T2YoJzsnKTtcclxuXHJcbiAgICBpZihzdGFydENvZGVjc0luZm8gIT09IC0xKSB7XHJcbiAgICAgICAgZXh0ZW5zaW9uID0gZXh0ZW5zaW9uLnN1YnN0cmluZygwLCBzdGFydENvZGVjc0luZm8pO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBleHRlbnNpb247XHJcbn07XHJcblxyXG5SZWNvcmRlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZiAoc2VsZi5fbWVkaWFSZWNvcmRlcikge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyBNZWRpYVJlY29yZGVyKHNlbGYuX21lZGlhU3RyZWFtLCBzZWxmLm1lZGlhUmVjb3JkZXJPcHRpb25zKTtcclxuICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBuZXcgTWVkaWFSZWNvcmRlcihzZWxmLl9tZWRpYVN0cmVhbSk7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbmRhdGFhdmFpbGFibGUgPSBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKGUuZGF0YSAmJiBlLmRhdGEuc2l6ZSA+IDApIHtcclxuICAgICAgICAgICBzZWxmLl9yZWNvcmRlZEJsb2JzLnB1c2goZS5kYXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25lcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XHJcbiAgICAgICAgaWYgKGVycm9yLm5hbWUgPT09ICdJbnZhbGlkU3RhdGUnKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1RoZSBNZWRpYVJlY29yZGVyIGlzIG5vdCBpbiBhIHN0YXRlIGluIHdoaWNoIHRoZSBwcm9wb3NlZCBvcGVyYXRpb24gaXMgYWxsb3dlZCB0byBiZSBleGVjdXRlZC4nKTtcclxuICAgICAgICB9IGVsc2UgaWYgKGVycm9yLm5hbWUgPT09ICdPdXRPZk1lbW9yeScpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVGhlIFVBIGhhcyBleGhhdXNlZCB0aGUgYXZhaWxhYmxlIG1lbW9yeS4gVXNlciBhZ2VudHMgU0hPVUxEIHByb3ZpZGUgYXMgbXVjaCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlIGluIHRoZSBtZXNzYWdlIGF0dHJpYnV0ZS4nKTtcclxuICAgICAgICB9IGVsc2UgaWYgKGVycm9yLm5hbWUgPT09ICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJykge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdBIG1vZGlmaWNhdGlvbiB0byB0aGUgc3RyZWFtIGhhcyBvY2N1cnJlZCB0aGF0IG1ha2VzIGl0IGltcG9zc2libGUgdG8gY29udGludWUgcmVjb3JkaW5nLiBBbiBleGFtcGxlIHdvdWxkIGJlIHRoZSBhZGRpdGlvbiBvZiBhIFRyYWNrIHdoaWxlIHJlY29yZGluZyBpcyBvY2N1cnJpbmcuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChlcnJvci5uYW1lID09PSAnT3RoZXJSZWNvcmRpbmdFcnJvcicpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVXNlZCBmb3IgYW4gZmF0YWwgZXJyb3Igb3RoZXIgdGhhbiB0aG9zZSBsaXN0ZWQgYWJvdmUuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChlcnJvci5uYW1lID09PSAnR2VuZXJpY0Vycm9yJykge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdUaGUgVUEgY2Fubm90IHByb3ZpZGUgdGhlIGNvZGVjIG9yIHJlY29yZGluZyBvcHRpb24gdGhhdCBoYXMgYmVlbiByZXF1ZXN0ZWQuJywgZXJyb3IpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ01lZGlhUmVjb3JkZXIgRXJyb3InLCBlcnJvcik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZihzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlICE9PSAnaW5hY3RpdmUnICYmIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgIT09ICdzdG9wcGVkJykge1xyXG4gICAgICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKHNlbGYuX3VzZXJDYWxsYmFja3MgJiYgdHlwZW9mIHNlbGYuX3VzZXJDYWxsYmFja3Mub25FcnJvclJlY29yZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBzZWxmLl91c2VyQ2FsbGJhY2tzLm9uRXJyb3JSZWNvcmRpbmcoZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdmFyIGJsb2IgPSBuZXcgQmxvYihzZWxmLl9yZWNvcmRlZEJsb2JzLCB7XHJcbiAgICAgICAgICAgICd0eXBlJyA6IHNlbGYubWVkaWFSZWNvcmRlck9wdGlvbnMubWltZVR5cGVcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYoc2VsZi5fdXNlckNhbGxiYWNrcyAmJiB0eXBlb2Ygc2VsZi5fdXNlckNhbGxiYWNrcy5vblN0b3BSZWNvcmRpbmcgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgc2VsZi5fdXNlckNhbGxiYWNrcy5vblN0b3BSZWNvcmRpbmcoYmxvYik7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9ucGF1c2UgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBpZihzZWxmLl91c2VyQ2FsbGJhY2tzICYmIHR5cGVvZiBzZWxmLl91c2VyQ2FsbGJhY2tzLm9uUGF1c2VSZWNvcmRpbmcgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgc2VsZi5fdXNlckNhbGxiYWNrcy5vblBhdXNlUmVjb3JkaW5nKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9ucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgaWYoc2VsZi5fdXNlckNhbGxiYWNrcyAmJiB0eXBlb2Ygc2VsZi5fdXNlckNhbGxiYWNrcy5vblJlc3VtZVJlY29yZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBzZWxmLl91c2VyQ2FsbGJhY2tzLm9uUmVzdW1lUmVjb3JkaW5nKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXJ0KDEwMDApO1xyXG5cclxuICAgIGlmKHNlbGYuX3VzZXJDYWxsYmFja3MgJiYgdHlwZW9mIHNlbGYuX3VzZXJDYWxsYmFja3Mub25TdGFydFJlY29yZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIHNlbGYuX3VzZXJDYWxsYmFja3Mub25TdGFydFJlY29yZGluZygpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuUmVjb3JkZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBtZWRpYVJlYyA9IHRoaXMuX21lZGlhUmVjb3JkZXI7XHJcblxyXG4gICAgaWYobWVkaWFSZWMgJiYgbWVkaWFSZWMuc3RhdGUgIT09ICdpbmFjdGl2ZScgJiYgbWVkaWFSZWMuc3RhdGUgIT09ICdzdG9wcGVkJyl7XHJcbiAgICAgICAgbWVkaWFSZWMuc3RvcCgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oJ1tSZWNvcmRlciBzdG9wXTogTWVkaWFSZWNvcmRlciBpc25cXCd0IGNyZWF0ZWQgb3IgaGFzIGludmFsaWQgc3RhdGUnKTtcclxuICAgIH1cclxufTtcclxuXHJcblJlY29yZGVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIgJiYgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSA9PT0gJ3JlY29yZGluZycpIHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnBhdXNlKCk7XHJcblxyXG4gICAgICAgIC8vIEZpcmVmb3ggZG9lc24ndCBmaXJlIG9ucGF1c2UgZXZlbnRcclxuICAgICAgICBpZihuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhKSB7XHJcbiAgICAgICAgICAgIGlmKHNlbGYuX3VzZXJDYWxsYmFja3MgJiYgdHlwZW9mIHNlbGYuX3VzZXJDYWxsYmFja3Mub25QYXVzZVJlY29yZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fdXNlckNhbGxiYWNrcy5vblBhdXNlUmVjb3JkaW5nKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybignW1JlY29yZGVyIHBhdXNlXTogTWVkaWFSZWNvcmRlciBpc25cXCd0IGNyZWF0ZWQgb3IgaGFzIGludmFsaWQgc3RhdGUuJyk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5SZWNvcmRlci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlciAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSAncGF1c2VkJykge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIucmVzdW1lKCk7XHJcblxyXG4gICAgICAgIC8vIEZpcmVmb3ggZG9lc24ndCBmaXJlIG9ucGF1c2UgZXZlbnRcclxuICAgICAgICBpZihuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhKSB7XHJcbiAgICAgICAgICAgIGlmKHNlbGYuX3VzZXJDYWxsYmFja3MgJiYgdHlwZW9mIHNlbGYuX3VzZXJDYWxsYmFja3Mub25SZXN1bWVSZWNvcmRpbmcgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3VzZXJDYWxsYmFja3Mub25SZXN1bWVSZWNvcmRpbmcoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKCdbUmVjb3JkZXIgcmVzdW1lXTogTWVkaWFSZWNvcmRlciBpc25cXCd0IGNyZWF0ZWQgb3IgaGFzIGludmFsaWQgc3RhdGUuJyk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5SZWNvcmRlci5wcm90b3R5cGUuZG93bmxvYWQgPSBmdW5jdGlvbihibG9iLCBkb3dubG9hZEZpbGVOYW1lKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYiB8fCBzZWxmLl9yZWNvcmRlZEJsb2JzKSxcclxuICAgICAgICBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG5cclxuICAgIGEuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgIGEuaHJlZiA9IHVybDtcclxuICAgIGEuZG93bmxvYWQgPSAoZG93bmxvYWRGaWxlTmFtZSB8fCBEYXRlLm5vdygpKSArICcuJyArIHNlbGYuZ2V0RXh0ZW5zaW9uKCk7XHJcblxyXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcclxuXHJcbiAgICAvKiBTdGFydCBkb3dsb2FkaW5nICovXHJcbiAgICBhLmNsaWNrKCk7XHJcbiAgICBcclxuICAgIC8qIFJlbW92ZSBsaW5rICovXHJcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoYSk7XHJcbiAgICAgICAgd2luZG93LlVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcclxuICAgIH0sIDEwMCk7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFJlY29yZGVyO1xyXG4iXX0=
