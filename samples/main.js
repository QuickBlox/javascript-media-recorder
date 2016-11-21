/* JSHint inline rules */
/* jshint node: true, browser: true */
/* globals qbMediaRecorder, Promise */

'use strict';

var resultCard = {
    ui: {
        wrap: document.querySelector('.j-result-card'),
        video: document.querySelector('.j-video_result'),
        clear: document.querySelector('.j-clear'),
        download: document.querySelector('.j-download')
    },
    attachVideo: function(blob) {
        this.ui.video.src = URL.createObjectURL(blob);

        this.ui.clear.disabled = false;
        this.ui.download.disabled = false;
    },
    detachVideo: function() {
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
    mediaEl: null,
    recorder: null,
    typeStream: null, // 1 - audio only, 2 - audion & video
    ui: {
        start: document.querySelector('.j-start'),
        stop: document.querySelector('.j-stop'),
        pause: document.querySelector('.j-pause'),
        resume: document.querySelector('.j-resume'),
        video: document.querySelector('.j-video_local'),
        typesOfMedia: document.getElementsByName('type')
    },
    getChoosesTypeMedia: function() {
        var typeMedia;

        this.ui.typesOfMedia.forEach(function(rBtn) {
            if (rBtn.checked) {
                typeMedia = +rBtn.value;
            }
        });

        return typeMedia;
    },
    getMediaStream: function() {
        var constraints = {
            audio: true,
            video: this.typeStream === 1 ? false : true
        };

        return new Promise(function(resolve, reject) {
            navigator.mediaDevices.getUserMedia(constraints)
                .then(function(stream) {
                    resolve(stream);
                })
                .catch(function(error) {
                    reject(error);
                });
        });
    },
    init: function() {
        this.typeStream =  this.getChoosesTypeMedia();

        this.getMediaStream().then(function(stream) {
            self.stream = stream;
        });
    }
};

console.log(streamCard.getChoosesTypeMedia());



/** Start fun */
resultCard.setupListeners();

/** Remove recorded media */
resultCard.ui.wrap.addEventListener('clear', function() {
    console.info('CLEAR');
}, false);

/** Download recorded media */
resultCard.ui.wrap.addEventListener('clear', function() {
    console.info('CLEAR');
}, false);




//     getMediaStreamLocal: function() {
//         
//     },
//     init: function() {
//         var self = this;

//         

//         return new Promise(function(resolve, reject) {
//             self.getMediaStreamLocal().then(function(stream) {
//                 self.stream = stream;
//                 self.recorder = new qbMediaRecorder(stream, recOpts);

//                 self.setupListeners();
//                 resolve();
//             }).catch(function(error) {
//                 reject(error);
//             });
//         });
//     },
//     attachStreamToSource: function() {
//         this.mediaEl.pause();
//         this.mediaEl.src='';

//         this.mediaEl.src = URL.createObjectURL(this.stream);
//         this.mediaEl.play();
//     },
//     setupListeners: function() {
//         var self = this;

//         var radioButtons = document.getElementsByName('type');

        // for (var i = 0; i < radioButtons.length; i++) {
        //     radioButtons[i].addEventListener('change', function() {
        //         self.typeStream = self.getChoosesTypeMedia();
        //         self.stream = null;
        //         self.recorder.stop();

        //         self.getMediaStreamLocal().then(function(stream) {
        //             self.stream = stream;
        //             self.recorder = new qbMediaRecorder(stream, recOpts);

        //             self.ui.btnStart.disabled = true;
        //             self.ui.btnStop.disabled = false;
        //             self.ui.btnPause.disabled = false;
        //             self.ui.btnResume.disabled = false;

        //         }).catch(function(error) {
        //             console.error(error);
        //         });
        //     }, false);
        // }

        // self.ui.btnStart.addEventListener('click', function() {
        //     self.recorder.start();

        //     self.ui.btnStop.disabled = false;
        //     self.ui.btnPause.disabled = false;
        // });

        // self.ui.btnPause.addEventListener('click', function() {
        //     self.recorder.pause();

        //     self.ui.btnPause.disabled = true;
        //     self.ui.btnResume.disabled = false;
        // });

        // self.ui.btnResume.addEventListener('click', function() {
        //     self.recorder.resume();

        //     self.ui.btnResume.disabled = true;
        //     self.ui.btnPause.disabled = false;
        // });

        // self.ui.btnStop.addEventListener('click', function() {
        //     self.recorder.stop();

        //     self.ui.btnStop.disabled = false;
        //     self.ui.btnPause.disabled = false;
        //     self.ui.btnResume.disabled = false;
        // });
//     },
// };


// streamCard.init().then(function() {
//     streamCard.attachStreamToSource();

//     resultCard.setupListeners(streamCard.recorder);
// });

// var recOpts = {
//     mimeType: streamCard.typeStream === 2 ? 'video' : 'audio',
//     callbacks: {
//         onStart: function startRecord() {
//             console.info('onStart');
//         },
//         onError: function errorRecord(error) {
//             console.info('onError', error);
//         },
//         onPause: function pauseRecord() {
//             console.info('onPause');
//         },
//         onStop: function stopRecord(blob) {
//             console.info('onStop');

//             resultCard.attachVideo(blob);
//         },
//         onResume: function resimeRecord() {
//             console.info('onResume');
//         }
//     }
// };