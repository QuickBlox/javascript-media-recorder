var gulp = require('gulp');
var browserify  = require('browserify');
var source = require('vinyl-source-stream');

var uglify = require('gulp-uglify');

var connect = require('gulp-connect');

var plumber = require('gulp-plumber');
var notify = require('gulp-notify');

var uglifyOpts = {
    mangle: true,
    compress: true
};

gulp.task('build', function() {
    return browserify('./src/index.js', {
            'debug': true,
            'standalone': 'QBMediaRecorder'
        })
        .bundle()
        .on('error', function(error) {
            this.emit('end');
            return notify().write(error);
        })
        .pipe(plumber())
        .pipe(source('qbMediaRecorder.js'))
        .pipe(gulp.dest('./'))
        .pipe(notify('Build task is finished'));
});

gulp.task('connect', function() {
    connect.server({
        port: 8001,
        https: true
    });
});

gulp.task('compress', function() {
    return gulp.src('qbMediaRecorder.js')
        .pipe(uglify(uglifyOpts))
        .pipe(gulp.dest('./'))
        .pipe(notify('Compress task is finished'));
});

gulp.task('compress:worker', function() {
    return gulp.src('./src/qbAudioRecorderWorker.js')
        .pipe(uglify(uglifyOpts))
        .pipe(gulp.dest('./'))
        .pipe(notify('Compress task is finished'));
});

gulp.task('watch', ['build'], function() {
    gulp.watch('src/*.js', ['build']);
});

gulp.task('default', ['build']);

gulp.task('develop', ['connect', 'watch']);

