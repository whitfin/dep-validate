# dep-validate

dep-validate is a tool used to verify the ranges on your npm dependencies. It can be used from the command line or from JavaScript. It's available on npm, so just install it via:

```
# for node usage
$ npm install --save-dev dep-validate

# for command line usage
$ npm install -g dep-validate
```

### Command Line Usage

Super easy, it's just the same interface as the JavaScript library (read up).

```bash
$ dep-validate --dependencies '~' --devDependencies '^' --exclude pkg1 --exclude pkg2 --hardcoded=allow --only production --only development --packageFile ./package.json
```

The exit code will be a `1` in case of error, with a chart displaying errors. It'll be `0` on success with no output.

### Library Usages

You can use the JavaScript library directly in Node.js.

All options are shown below and are the defaults (so they're used if not provided). The only exception is `file`, which will resolve the current `package.json` (by reading upwards in directory).

```javascript
var dv = require('dep-validate');

// available options
var opts = {
  dependencies: '~',                      // the range to enforce on all "dependencies"
  devDependencies: '^',                   // the range to enforce on all "devDependencies"
  exluded: [ 'my-package' ],              // packages to exclude from validation
  hardcoded: 'allow|force',               // allow or force hardcoded versions
  packageFile: './package.json',          // the package.json file to read and validate
  only: [ 'production', 'development' ]   // only check prod/dev dependencies
}

// `validate()` results a results object
var results = dv.validate(opts);

// which can be printed using `log()`
if (dv.hasErrors(results)) {
  dv.log(results);
}

// or use `pipe()` for a callback-style interface (it's still synchronous)
dv.pipe(opts, function (err) {
  // err contains a `meta` field containing information about failures
  // you can either inspect this manually, or log the entire error using `log(err)`
})
```
