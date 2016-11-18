/* JSHint inline rules */
/* jshint node: true, browser: true */
/* globals qbMediaRecorder, Promise */

'use strict';

var streamCard = {
    stream: null,
    mediaEl: null,
    recorder: null,
    typeStream: null, // 1 - audio only, 2 - audion & video
    init: function(Rec, recOpts) {
        var self = this;

        self.typeStream =  self.getChoosesTypeMedia();
        self.mediaEl = document.querySelector('.j-video_local');

        var recOpts = {
            mimeType: self.typeStream === 2 ? 'video' : 'audio',
            callbacks: {
                onStart: function startRecord() {
                    console.info('onStart');
                }
            }
        };

        return new Promise(function(resolve, reject) {
            self.getMediaStreamLocal().then(function(stream) {
                self.stream = stream;
                self.recorder = new qbMediaRecorder(stream, recOpts);

                self.setupListeners();
                resolve();
            }).catch(function(error) {
                reject(error);
            });
        });
        
    },
    getChoosesTypeMedia: function() {
        var radioButtons = document.getElementsByName('type');

        radioButtons.forEach(function(radioButton) {
            if (radioButton.checked) {
                return +radioButton.value;
            }
        });
    },
    getMediaStreamLocal: function() {
        var constraints = {
                audio: true,
                video: this.typeStream === '1' ? false : true
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
    attachStreamToSource: function() {
        this.mediaEl.pause();
        this.mediaEl.src='';

        this.mediaEl.src = URL.createObjectURL(this.stream);
        this.mediaEl.play();
    },
    setupListeners: function() {
        var self = this;

        document.querySelector('.j-start').addEventListener('click', function() {
            console.log('assadas');
            // recorder.start();
        });

        // document.querySelector('.j-stop').addEventListener('click', function() {
        //     recorder.stop();
        // });

        // document.querySelector('.j-pause').addEventListener('click', function() {
        //     recorder.pause();
        // });

        // document.querySelector('.j-resume').addEventListener('click', function() {
        //     recorder.resume();
        // });

        // document.querySelector('.j-download').addEventListener('click', function() {
        //     recorder.download();
        // });
    },
};


streamCard.init(qbMediaRecorder).then(function() {
    streamCard.attachStreamToSource();

});



// function handleGetStreamError

// function handleGetStreamSuccess(stream) {
//     /* stop previously stream */
//     
    
//     
// }

// function getMediaStreamLocal() {
    
// }

// getMediaStreamLocal();

// /** set events listeners */
// var radioButtons = document.getElementsByName('type');

// for (var i = 0; i < radioButtons.length; i++) {
//     radioButtons[i].addEventListener('change', getMediaStreamLocal, false);
// }


    // handleGetStreamSuccess: function(stream) {
    //     console.info(this);
    //     
    // },


// var recorder = null,
//     recorderOpts = {
//         mimeType: 'audio',
//         callbacks: {
//             onStart: function onStart() {
//                 console.info('onStart callback');
//             },
//             onStop: function onStop(blob) {
//                 console.info('onStop callback');
                
//                 var videoEl = document.querySelector('.j-videoRecorded');
//                 var btnDownloadEl = document.querySelector('.j-download');
                
//                 videoEl.src = URL.createObjectURL(blob);
//                 videoEl.volume = 0.5;

//                 btnDownloadEl.disabled = false;
//             },
//             onPause: function onStart() {
//                 console.info('onPause callback');
//             },
//             onResume: function onStart() {
//                 console.info('onResume callback');
//             },
//         }
//     };





// * Start sample - choose what type of media you wnat to record. 
// document.querySelector('.j-startSample').addEventListener('click', function() {
//     
// });

    
//        //      ,
//        //      ;

//        //  

//        //  // navigator.mediaDevices.enumerateDevices()
//        //  // .then(function(devices) {
//        //  //     devices.forEach(function(device) {
//        //  //         console.info(device.kind + ": " + device.label + " id = " + device.deviceId);
//        //  //     });
//        //  // });

        

//        //  /** Event listeners */
