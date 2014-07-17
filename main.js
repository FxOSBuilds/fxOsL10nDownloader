/** jshint node:true */

var path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    async = require('async'),
    exec = require('child_process').exec,
    cpus = require('os').cpus().length;

var versions = require('./versions');
var gaiaLocales = require('./gaia-locales.json');
var geckoLocales = getGeckoLocales('./gecko-locales.list');

function getGeckoLocales(filename) {
    console.log('getGeckoLocales()');
    var filepath = path.resolve(__dirname, filename);
    var contents = fs.readFileSync(filepath, { encoding: 'utf8'});
    return contents.split(' ');
}


function expandPathsWithRepos(callback) {
    console.log('expandPathsWithRepos()');
    var rv = {};
    var mainVersions = Object.keys(versions);
    mainVersions.forEach(function(version) {
        if (versions[version].gecko) {
            geckoLocales.forEach(function(lang) {
                //console.log('detecting', version, 'gecko', lang);
                var localPath, repository;
                localPath = path.join(__dirname, version, 'gecko', lang);
                repository = versions[version].gecko.replace('$lang', lang);
                rv[localPath] = repository;
            });
        }
        if (versions[version].gaia) {
            var gaiaLocalesKeys = Object.keys(gaiaLocales);
            gaiaLocalesKeys.forEach(function(lang) {
                //console.log('detecting', version, 'gaia', lang);
                var localPath, repository;
                localPath = path.join(__dirname, version, 'gaia', lang);
                repository = versions[version].gaia.replace('$lang', lang);
                rv[localPath] = repository;
            });
        }
    });
    callback(null, rv);
}

// On versions we have a object of what directories must exist for
// this to work. So let's create them in case they are not present
// mkdirp handle if there are a directory or need to create it
function checkOrCreateSkeleton(repoObject, callback) {
    console.log('checkOrCreateSkeleton()');
    var paths = Object.keys(repoObject);
    for (var i = paths.length - 1; i >= 0; i--) {
        //console.log('Making ' + paths[i]);
        mkdirp.sync(paths[i]);
    }

    return callback(null, repoObject);
}

function cloneOrUpdatePaths(repoObject, callback) {
    console.log('cloneOrUpdatePaths()');
    console.log(repoObject);
    var keys = Object.keys(repoObject);
    var tasks = {};
    for (var i = keys.length - 1; i >= 0; i--) {
        //console.log('checking' + keys[i]);
        var hgHiddenPath = path.join(keys[i], '.hg');
        if (fs.existsSync(hgHiddenPath) && fs.statSync(hgHiddenPath).isDirectory) {
            //console.log('to update ' + keys[i]);
            tasks[keys[i]] = updateClone.bind(null, keys[i]);
        } else {
            //console.log('to CLONE ' + keys[i]);
            tasks[keys[i]] = initialClone.bind(null, repoObject[keys[i]], keys[i]);
        }
    }
    // Let's launch number of cpus tasks for mercurial.
    async.parallelLimit(tasks, cpus, callback);
}

function initialClone(repository, path, callback) {
    console.log('initialClone', repository, path);
    exec('hg clone --insecure ' + repository + ' ' + path, callback);
}

function updateClone(path, callback) {
    console.log('updateClone', path);
    exec('hg pull --insecure -u', { cwd: path }, callback);
}

async.waterfall([
    //getGeckoLocales,
    expandPathsWithRepos,
    checkOrCreateSkeleton,
    cloneOrUpdatePaths
], function(err, results) {
    console.log(results);
});