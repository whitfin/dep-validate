var PluginError = require('gulp-util').PluginError;
var Table = require('cli-table3');
var Through = require('through');

/* Public */

/**
 * The main backbone validation function.
 *
 * This will return an Object containing two keys against any
 * validation errors found when validating. If both keys are
 * empty Arrays, you can assume that validation succeeded.
 *
 * @param opts an options Object (see README.md).
 * @returns {{dependencies: Array, devDependencies: Array}}.
 */
function validate(opts) {
  opts = opts || {};

  var pkg;

  if (opts.packageFile) {
    pkg = require(opts.packageFile);
  } else {
    pkg = require(require('path').join(process.cwd(), 'package.json'));
  }

  var depsErrors = [];
  var devDepsErrors = [];

  var deps = pkg.dependencies || {};
  var devDeps = pkg.devDependencies || {};

  var depsEnforce = opts.dependencies || '~';
  var devDepsEnforce = opts.devDependencies || '^';

  if (opts.only && !Array.isArray(opts.only)) {
    opts.only = [ opts.only ];
  }

  if (!opts.only || ~opts.only.indexOf('prod') || ~opts.only.indexOf('production')) {
    depsErrors = _processDeps(deps, depsEnforce, opts);
  }

  if (!opts.only || ~opts.only.indexOf('dev') || ~opts.only.indexOf('development')) {
    devDepsErrors = _processDeps(devDeps, devDepsEnforce, opts);
  }

  return { dependencies: depsErrors, devDependencies: devDepsErrors };
}

/**
 * Formats an Object of results.
 *
 * The Object should be of the same form as the result of
 * calling #validate, as the formatter expects the values
 * to be piped straight through.
 *
 * @param results our Object containing validation results.
 * @returns {{dependencies: Array, devDependencies: Array}}.
 */
function format(results) {
  if (_isFormatted(results)) {
    return results;
  }

  var dependencyErrors = results.dependencies || [];
  var devDependencyErrors = results.devDependencies || [];

  var formattedErrors = { };

  formattedErrors.dependencies = dependencyErrors.length
    ? _formatErrors('Dependencies', dependencyErrors)
    : dependencyErrors;

  formattedErrors.devDependencies = devDependencyErrors.length
    ? _formatErrors('Dev Dependencies', devDependencyErrors)
    : devDependencyErrors;

  return formattedErrors;
}

/**
 * Detects if a results Object contains any errors.
 *
 * @param results our Object containing validation results.
 * @returns true if errors are contained in the results.
 */
function hasErrors(results) {
  return  (results.dependencies && results.dependencies.length) ||
          (results.devDependencies && results.devDependencies.length)
}

/**
 * Returns a Transform Stream for use with Gulp.
 *
 * @param opts an options Object (see README.md).
 * @returns a Stream instance for Gulp use.
 */
function gulp(opts) {
  opts = opts || {};

  var failOnError = opts['failOnError'] || false;
  var interimFiles = [];
  var failedValidations = [];

  return Through(
    function (file) {
      interimFiles.push(file.path);
      this.queue(file);
    },
    function () {
      var baseFile = opts.packageFile;

      interimFiles.forEach(function (file) {
        opts.packageFile = file;

        var results = validate(opts);

        if (hasErrors(results)) {
          failedValidations.push(file);
          log(results);
        }
      });

      opts.packageFile = baseFile;

      if (failOnError &&  failedValidations.length) {
        this.emit('error', new PluginError('dep-validate', 'Unable to validate dependencies'));
      } else {
        this.emit('end');
      }
    }
  );
}

/**
 * Logs a results Object out to a given write stream.
 *
 * The stream defaults to `process.stdout`, and results
 * will be formatted on-demand if needed.
 *
 * @param results our Object containing validation results.
 * @param stream a write stream to write the log to.
 */
function log(results, stream) {
  stream = stream || process.stdout;

  if (results instanceof Error) {
    results = results.meta;
  }

  if (!_isFormatted(results)) {
    results = format(results);
  }

  stream.write(_join(results));
}

/**
 * Callback style interface to #validate.
 *
 * @param opts an options Object (see README.md).
 * @param cb a callback to pass a potential error to.
 */
function pipe(opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  if (!cb) {
    cb = function () { }
  }

  opts = opts || {};

  var results = validate(opts);

  if (!hasErrors(results)) {
    return cb();
  }

  var err = new Error('Unable to validate dependencies');
  err.meta = results;
  return cb(err);
}

/* Exports */

module.exports.format = format;
module.exports.gulp = gulp;
module.exports.hasErrors = hasErrors;
module.exports.log = log;
module.exports.pipe = pipe;
module.exports.validate = validate;

/* Private */

function _align(content, alignment) {
  return {
    content: content,
    hAlign: alignment
  }
}

function _formatErrors(name, errors) {
  var head = _align(name, 'center');

  head.colSpan = 3;

  var table = new Table({
    style: { head: [] },
    head: [ head ]
  });

  table.push([ '', _align('Actual', 'center'), _align('Expected', 'center') ]);

  errors.forEach(function (error) {
    table.push([ error.name, _align(error.version, 'right'), _align(error.expected, 'right') ]);
  });

  return table.toString();
}

function _isFormatted(results) {
  return  (!results.dependencies || results.dependencies instanceof Table) &&
          (!results.devDependencies || results.devDependencies instanceof Table)
}

function _join(results) {
  var output = '';

  var dependencyErrors = results.dependencies;
  var devDependencyErrors = results.devDependencies;

  if (dependencyErrors) {
    output += dependencyErrors + '\n';
  }

  if (devDependencyErrors) {
    output += devDependencyErrors + '\n';
  }

  return output;
}

function _processDeps(deps, enforce, opts) {
  var allowHardcoded = opts.hardcoded === 'allow';
  var forceHardcoded = opts.hardcoded === 'force';
  var excludedDeps = opts.excluded || [];

  if (!Array.isArray(excludedDeps)) {
    excludedDeps = [ excludedDeps ];
  }

  var errors = [];
  var rangeMatch = /^(<|<=|=|=>|>|\^|~)/;

  function emitError(name, ver, enf) {
    errors.push({
      name: name,
      version: ver,
      expected: enf + ver.replace(rangeMatch, '')
    });
  }

  Object.keys(deps).forEach(function (dependencyName) {
    if (excludedDeps.length && ~excludedDeps.indexOf(dependencyName)) {
      return;
    }

    var dependencyVersion = deps[dependencyName];
    var firstCharacter = dependencyVersion[0];

    if (!rangeMatch.test(firstCharacter)) {
      if (/^[a-zA-Z/.~]/.test(firstCharacter) || allowHardcoded || forceHardcoded) {
        return;
      }
      return emitError(dependencyName, dependencyVersion, enforce);
    }

    if (forceHardcoded) {
      return emitError(dependencyName, dependencyVersion, '');
    }

    if (dependencyVersion.slice(0, enforce.length) !== enforce) {
      emitError(dependencyName, dependencyVersion, enforce);
    }
  });

  return errors;
}
