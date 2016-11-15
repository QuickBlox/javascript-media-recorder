var gulp = require('gulp');
var browserify  = require('browserify');
var source = require('vinyl-source-stream');

var connect = require('gulp-connect');

var plumber = require('gulp-plumber');
var notify = require('gulp-notify');

gulp.task('build', function() {
    return browserify('./src/index.js', {
            'debug': true,
            'standalone': 'qbMediaRecorder'
        })
        .bundle()
        .on('error', function(error) {
            this.emit('end');
            return notify().write(error);
        })
        .pipe(plumber())
        .pipe(source('mediaRecorder.js'))
        .pipe(gulp.dest('./'))
        .pipe(notify('Build task is finished'));
});

gulp.task('connect', function() {
    connect.server({
        port: 8001,
        https: true
      });
});

gulp.task('default', ['build']);

gulp.task('develop', ['connect', 'watch']);

gulp.task('watch', ['build'], function() {
    gulp.watch('src/*.js', ['build']);
});