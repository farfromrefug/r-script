var child_process = require("child_process");

function init(path) {
  var obj = new R(path);
  ["data", "call", "callSync"].forEach(function(f) {
    obj[f] = obj[f].bind(obj);
  })
  return obj;
}

var dirname = __dirname.replace('app.asar', 'app.asar.unpacked')
function R(path) {
  this.d = {};
  this.path = path;
  this.options = {
    env: Object.assign({
      DIRNAME: dirname
    }, process.env),
    encoding: "utf8"
  };
  this.idCounter = 0;
  this.args = ["--vanilla", dirname + "/R/launch.R"];
}

R.prototype.data = function () {
  for (var i = 0; i < arguments.length; i++) {
    this.d[++this.idCounter] = arguments[i];
  }
  return this;
};

R.prototype.call = function (_opts, _callback) {
  if (typeof _opts === 'function' && !_callback) {
    _callback = _opts;
    _opts = {};
  }
  // console.log('Rscript call ', _callback, _opts);
  this.options.env.input = JSON.stringify([this.d, this.path, _opts]);

  var child = child_process.spawn("Rscript", this.args, this.options);
  var body = {
    out: "",
    err: "",
    timeout: false
  };
  if (_opts.timeout) {
    setTimeout(function () {
      child.stdin.pause(); // Required to make sure KILL works
      child.kill();
      body.timeout = true;
    }, _opts.timeout);
  }
  child.stderr.on("data", function (d) {
    body.err += d;
  });
  child.stdout.on("data", function (d) {
    body.out += d;
  });
  child.on('close', function (code) {
    if (body.timeout) _callback(new Error('timeout'));

    // console.log('R done', '\'' + body.err.toString() + '\'', '\'' + body.out.toString() + '\'');
    if (body.err) {
      _callback(new Error(body.err.toString()));
    }
    var result = body.out.toString();

    _callback(null, JSON.parse(result.slice(result.indexOf('{'))));
  });
}
R.prototype.callSync = function (_opts) {
  var opts = _opts || {};
  this.options.env.input = JSON.stringify([this.d, this.path, opts]);
  var child = child_process.spawnSync("Rscript", this.args, this.options);
  if (child.stderr) throw child.stderr;
  return (JSON.parse(child.stdout));
};

module.exports = init;
