importScripts('https://cdn.rawgit.com/zhuker/lamejs/c318d57d/lame.min.js');

var mp3encoder = new lamejs.Mp3Encoder(1, 48000, 256);
console.log(mp3encoder);
self.onmessage = function(e) {
	switch (e.data.cmd) {
		case 'encode':
			self.postMessage({'mp3encoder': 'mp3encoder'});
			break;
		case 'finish':
			// self.postMessage({cmd: 'end', buf: mp3data.data});
			break;
	}
};