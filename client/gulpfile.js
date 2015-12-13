'use strict';

var autoprefixer = require('gulp-autoprefixer');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var concat = require('gulp-concat');
var del = require('del');
var eslint = require('gulp-eslint');
var gulp = require('gulp');
var gutil = require('gulp-util');
var header = require('gulp-header');
var htmlreplace = require('gulp-html-replace');
var less = require('gulp-less');
var merge = require('merge-stream');
var minifycss = require('gulp-minify-css');
var moment = require('moment');
var path = require('path');
var pkg = require('./package.json');
var reactify = require('reactify');
var rename = require('gulp-rename');
var runSequence = require('run-sequence');
var size = require('gulp-size');
var source = require('vinyl-source-stream');
var uglify = require('gulp-uglify');
var watchify = require('watchify');
var webserver = require('gulp-webserver');

var isDebug = true;
var isWatching = false;

var SRCDIR = './src/';
var SCRIPTSDIR = path.join(SRCDIR, 'scripts/');
var STYLESDIR = path.join(SRCDIR, 'styles/');
var BOLT = 'bolt/';
var SRCBOLTDIR = path.join(SCRIPTSDIR, BOLT);
var THIRDPARTYDIR = path.join(SRCDIR, 'thirdparty/');
var BUILDDIR = './build/';

var INDEXHTML = path.join(SRCDIR, 'index.html');
var MAINJS = path.join(SCRIPTSDIR, 'main.jsx');
var MAINCSS = path.join(STYLESDIR, 'styles.less');
var BUNDLEJS = 'bundle.js';
var BUNDLEMINJS = 'printStudio.min.js';
var VENDORJS = 'vendor.min.js';
var STYLESCSS = 'styles.css';
var STYLESMINCSS = 'printStudio.min.css';
var BOLTLOADERJS = 'BLTLoader.js';
var BOLTWORKERJS = 'BLTWorker.js';

var BOOTSTRAPLESSDIR = './bower_components/bootstrap/less';

var HEADER = '/*! <%= pkg.name %> v<%= pkg.version %> | (c) <%= pkg.author %> | <%=now %> */\n';

gulp.task('bolt', function (callback) {
    runSequence('bolt:loader', 'bolt:worker', callback);
});

gulp.task('bolt:loader', function () {
    return gulp.src( path.join(SRCBOLTDIR, BOLTLOADERJS) )
        .pipe(uglify())
        .pipe(gulp.dest(path.join(BUILDDIR, BOLT)));
});

gulp.task('bolt:worker', function () {
    return gulp.src(
        [
            path.join(SRCBOLTDIR, BOLTWORKERJS),
            path.join(THIRDPARTYDIR, 'jpeg', '**/*.js'),
            './bower_components/zlib.js/bin/zlib.min.js'
        ])
        .pipe(concat(BOLTWORKERJS))
        .pipe(uglify({
            compress: {
                global_defs: {
                    IS_CONCAT_BUILD: true
                }
            }
        }))
        .pipe(gulp.dest(path.join(BUILDDIR, BOLT)));
});

gulp.task('browserify', function () {
    var bundler = browserify(MAINJS, {
        debug: isDebug,
        cache: {},
        packageCache: {},
        fullPaths: isWatching
    });

    if (isWatching) {
        bundler = watchify(bundler);
    }

    bundler.transform(reactify);

    var rebundle = function () {
        return bundler.bundle()
            .on('error', gutil.log.bind(gutil, 'browserify error'))
            .pipe(source(BUNDLEJS))
            .pipe(buffer())
            .pipe(gulp.dest(BUILDDIR));
    };

    bundler.on('update', function () {
        gutil.log('Updating');
        rebundle();
    });
    return rebundle();
});

gulp.task('clean', function () {
    del.sync([path.join(BUILDDIR, '**/*'), '!' + BUILDDIR]);
});

gulp.task('copy:assets', function () {
    var assetsDir = path.join(SRCDIR, 'assets');
    var favicon = path.join(SRCDIR, 'assets', 'images', 'favicon.ico');

    var copyAssetsStream = gulp.src([path.join(assetsDir, '**/*.*'), '!' + favicon])
        .pipe(gulp.dest(path.join(BUILDDIR, 'assets')));

    var copyFavIconStream = gulp.src(favicon)
        .pipe(gulp.dest(path.join(BUILDDIR)));

    return merge(copyAssetsStream, copyFavIconStream);
});

gulp.task('html', function () {
    return gulp.src(INDEXHTML)
        .pipe(htmlreplace({
            css: isDebug ? STYLESCSS : STYLESMINCSS,
            js: isDebug ? [VENDORJS, BUNDLEJS] : [VENDORJS, BUNDLEMINJS]
        }))
        .pipe(gulp.dest(BUILDDIR));
});

gulp.task('lint', function () {
    return gulp.src(
        [
            './gulpfile.js',
            path.join(SCRIPTSDIR, '**/*.jsx'),
            path.join(SCRIPTSDIR, '**/*.js'),
            '!' + path.join(SRCBOLTDIR, '**/*.js')
        ])
        .pipe(eslint())
        .pipe(eslint.format());
});

gulp.task('minifycss', function () {
    return gulp.src(path.join(BUILDDIR, STYLESCSS))
        .pipe(minifycss({
            keepSpecialComments: 0
        }))
        .pipe(rename(STYLESMINCSS))
        .pipe(header(HEADER, {
            pkg: pkg,
            now: moment.utc().format('YYYY-MM-DD HH:mm')
        }))
        .pipe(gulp.dest(BUILDDIR))
        .pipe(size({title: STYLESMINCSS}));
});

gulp.task('minifyjs', function () {
    return gulp.src(path.join(BUILDDIR, BUNDLEJS))
        .pipe(uglify())
        .pipe(rename(BUNDLEMINJS))
        .pipe(header(HEADER, {
            pkg: pkg,
            now: moment.utc().format('YYYY-MM-DD HH:mm')
        }))
        .pipe(gulp.dest(BUILDDIR))
        .pipe(size({title: BUNDLEMINJS}));
});

gulp.task('styles', function () {
    return gulp.src([MAINCSS])
        .pipe(less({
            paths: [BOOTSTRAPLESSDIR]
        }))
        .on('error', gutil.log.bind(gutil, 'less error'))
        .pipe(autoprefixer('last 2 versions')) // what browsers?
        .pipe(gulp.dest(BUILDDIR));
});

gulp.task('vendor', function () {
    return gulp.src(
        [
            './bower_components/jquery/dist/jquery.min.js',
            './bower_components/bootbox.js/bootbox.js',
            './bower_components/bootstrap/dist/js/bootstrap.min.js',
            './bower_components/classnames/index.js',
            './bower_components/d3/d3.min.js',
            './bower_components/moment/min/moment.min.js',
            './bower_components/moment-duration-format/lib/moment-duration-format.js',
            './bower_components/react/react.js',
            './bower_components/react/react-dom.min.js',
            './bower_components/react-bootstrap/react-bootstrap.min.js',
            './bower_components/react-infinite/dist/react-infinite.min.js',
            './bower_components/reflux/dist/reflux.js',
            './bower_components/threejs/build/three.js',
            './bower_components/toastr/toastr.min.js',
            './bower_components/zlib.js/bin/unzip.min.js',
            path.join(THIRDPARTYDIR, 'radialProgress/radialProgress.js'),
            path.join(THIRDPARTYDIR, 'threejs', '**/*.js')
        ])
        .pipe(concat(VENDORJS))
        .pipe(uglify())
        .pipe(gulp.dest(BUILDDIR))
        .pipe(size({title: VENDORJS}));
});

gulp.task('watch', function () {
    gulp.watch(path.join(SRCBOLTDIR, '**/*.*'), ['bolt']);
    gulp.watch(MAINCSS, ['styles']);
    gulp.watch(INDEXHTML, ['html']);
});

gulp.task('webserver', function () {
    return gulp.src(BUILDDIR)
        .pipe(webserver({
            livereload: true,
            open: 'http://localhost.autodesk.com:8000'
        }));
});

gulp.task('build:debug', function (callback) {
    delete process.env.NODE_ENV; // eslint-disable-line no-undef
    runSequence(
        'lint',
        ['vendor', 'browserify', 'styles', 'html', 'copy:assets', 'bolt'],
        callback
    );
});

gulp.task('build:release', function (callback) {
    isDebug = false;
    process.env.NODE_ENV = 'production'; // eslint-disable-line no-undef
    runSequence(
        ['clean', 'lint'],
        ['vendor', 'browserify', 'styles', 'html', 'copy:assets', 'bolt'],
        ['minifycss', 'minifyjs'],
        callback
    );
});

gulp.task('serve', function () {
    isWatching = true;
    runSequence(
        'lint',
        ['vendor', 'browserify', 'styles', 'html', 'copy:assets', 'bolt'],
        'webserver',
        'watch');
});

gulp.task('default', ['build:debug']);
gulp.task('build', ['build:debug']);
gulp.task('dist', ['build:release']);
