importScripts('https://cdn.rawgit.com/zhuker/lamejs/c318d57d/lame.min.js');

var MP3encoder = new lamejs.Mp3Encoder(1, 48000, 256);

function QBAudioRecorderWorker() {
    var self = this;

    self.bufferChunks = [];
    self.bufferSize = 0;
    self.sampleRate = 0;
    self.mimeType = '';

    onmessage = function(event) {
        self.onMessage(event.data);
    };
}

QBAudioRecorderWorker.prototype = {
    postMessage: function(data) {
        postMessage(data);
    },

    onMessage: function(data) {
        var self = this;

        switch (data.cmd) {
            case 'init':
                self.mimeType = data.mimeType;
                self.sampleRate = data.sampleRate;
                self.bufferChunks = [];
                self.bufferSize = 0;
                break;
            case 'record':
                self.bufferChunks.push(new Float32Array(data.bufferChunk));
                self.bufferSize += data.bufferSize;
                break;
            case 'finish':
                self.postMessage(self.getBlobData());
                break;
        }
    },

    encodeWAV: function(samples) {
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
    },

    encodeMP3: function(buffer) {
        var data = new Int16Array(buffer),
            encodedBuffer = MP3encoder.encodeBuffer(data),
            flushedBuffer = MP3encoder.flush(),
            mp3Data = [];

        mp3Data.push(encodedBuffer);
        mp3Data.push(new Int8Array(flushedBuffer));

        return mp3Data;
    },

    getBlobData: function() {
        var self = this,
            result = new Float32Array(self.bufferSize),
            bufferLength = self.bufferChunks.length,
            offset = 0,
            buffer,
            view,
            data;

        for (var i = 0; i < bufferLength; i++) {
            buffer = self.bufferChunks[i];
            result.set(buffer, offset);
            offset += buffer.length;
        }

        view = self.encodeWAV(result);

        switch (self.mimeType) {
            case 'audio/wav':
                data = [view];
                break;

            case 'audio/mp3':
                data = self.encodeMP3(view.buffer);
                break;

            default:
                throw new Error();
        }

        return data;
    }
};

new QBAudioRecorderWorker();