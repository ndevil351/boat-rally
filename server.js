//
// # SimpleServer
//
// A simple server using Socket.IO, Express, and Async.
//
var http = require('http');
var path = require('path');
var fs = require('fs');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

router.use(express.static(path.resolve(__dirname, 'client')));

var messages = [];
var sockets = [];

//радиус определения точки (м)
var distance_treshold = 100;

//код выдаваемый после снятия всех точек
var level_up_code = '';

var Points = [];

initPoints();

function initPoints() {
  var file = fs.readFileSync(__dirname + '/data/trees.json', 'utf8');
  Points = JSON.parse(file);

  file = fs.readFileSync(__dirname + '/data/settings.json', 'utf8');
  distance_treshold = JSON.parse(file).distance_treshold;
  level_up_code = JSON.parse(file).level_up_code;
}

/* Array.shuffle( deep ) - перемешать элементы массива случайным образом
deep - необязательный аргумент логического типа, указывающий на то, 
       нужно ли рекурсивно обрабатывать вложенные массивы;
       по умолчанию false (не обрабатывать)
*/
Array.prototype.shuffle = function(b) {
  var i = this.length,
    j, t;
  while (i) {
    j = Math.floor((i--) * Math.random());
    t = b && typeof this[i].shuffle !== 'undefined' ? this[i].shuffle() : this[i];
    this[i] = this[j];
    this[j] = t;
  }

  return this;
};

/*Этот метод был добавлен в спецификации ECMAScript 6 и пока может быть недоступен во всех реализациях JavaScript. Однако, вы можете использовать следующий кусочек кода в качестве полифилла:*/
if (!Array.prototype.find) {
  Array.prototype.find = function(predicate) {
    if (this == null) {
      throw new TypeError('Array.prototype.find called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };
}

/*возвращает расстояние между двумя точками в проекции меркатора на элипсоид wgs84*/
function geoDistance(point1, point2) {
  if (!point1 || !point2) {
    return Infinity;
  }

  lat1 = point1[0] * Math.PI / 180;
  lng1 = point1[1] * Math.PI / 180;
  lat2 = point2[0] * Math.PI / 180;
  lng2 = point2[1] * Math.PI / 180;

  return Math.round(6378137 * Math.acos(Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng1 - lng2) + Math.sin(lat1) * Math.sin(lat2)));
}

var cloneDeep = function(obj) {
  // Handle string, int, boolean, null or undefined
  if (null == obj || "object" != typeof obj) {
    return obj;
  }

  var copy;
  // Handle Date
  if (obj instanceof Date) {
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }

  // Handle Array
  if (obj instanceof Array) {
    copy = [];
    for (var i = 0, len = obj.length; i < len; i++) {
      copy[i] = cloneDeep(obj[i]);
    }
    return copy;
  }

  // Handle Object
  if (obj instanceof Object) {
    copy = {};
    for (var attr in obj) {
      if (obj.hasOwnProperty(attr)) {
        copy[attr] = cloneDeep(obj[attr]);
      }
    }
    return copy;
  }

  console.error("Unable to copy object! Its type isn't supported.", obj);
}

io.on('connection', function(socket) {

  messages.forEach(function(data) {
    socket.emit('message', data);
  });

  socket.emit('distance_treshold', distance_treshold);
  sendPoints(Points, socket);
  updateRoster();
  if (!checkActivePoints(Points)) {
    socket.emit('level_up', level_up_code);
  }

  sockets.push(socket);
  broadcast_adm('adm_sockets', sock_to_txt(sockets));

  socket.on('disconnect', function() {
    name = socket.store.data.name;
    socketid = socket.id;

    sockets.splice(sockets.indexOf(socket), 1);

    broadcast('removed', name + '-' + socketid);
    broadcast_adm('adm_sockets', sock_to_txt(sockets));

    thelastOne = true;
    sockets.forEach(function(a) {
      if (a.store.data.name == name) {
        thelastOne = false;
      }
    });
    updateRoster();
    if (thelastOne) {
      broadcast('removedLastOne', name)
    }
  });

  socket.on('message', function(msg) {
    var text = String(msg || '');

    if (!text)
      return;

    socket.get('name', function(err, name) {
      var data = {
        name: name,
        text: text
      };

      broadcast('message', data);
      messages.push(data);
    });
  });

  socket.on('coords', function(msg) {
    var text = String(msg || '');

    if (!text)
      return;

    socket.get('name', function(err, name) {
      var data = {
        name: name,
        text: text
      };

      socket.last_data = data;

      broadcast('coords', data);
      broadcast_adm('adm_sockets', sock_to_txt(sockets));
      
    });
  });

  socket.on('identify', function(name) {
    socket.set('name', String(name.name || 'Anonymous'), function(err) {
      socket.set('name_id', String(name.name_id || 'Anonymous'), function(err) {
        updateRoster();
        sendPoints(Points, socket);
        if (!checkActivePoints(Points)) {
          socket.emit('level_up', level_up_code);
        }
      });
    });
    broadcast_adm('adm_sockets', sock_to_txt(sockets));
  });

  socket.on('isAdmin', function(e) {
    console.log('Its admin...');
    if (e) {
      socket.isAdmin = true;
    }
    
    broadcast_adm('adm_sockets',sockets);
  });

  socket.on('request_roaster', function() {
    console.log('Update roaster request reacived. Sending...');
    updateRoster();
  });

  socket.on('code', function(msg) {
    timestamp = new Date();
    console.log('socket: ' + socket.id + ' name: ' + ((socket.last_data) ? socket.last_data.name : socket.last_data) + ' code:' + msg);
    log_event({
      ts: timestamp.getTime(),
      date: timestamp.toJSON(),
      team_name: ((socket.store && socket.store.data) ? socket.store.data.name : undefined),
      team_id: ((socket.store && socket.store.data) ? socket.store.data.name_id : undefined),
      player_name: ((socket.last_data) ? JSON.parse(socket.last_data.text).player_name : undefined),
      code: msg,
      coords: ((socket.last_data) ? JSON.parse(socket.last_data.text).coords : socket.last_data),
      socketID: socket.id
    });
    Points.forEach(function(point) {
      if (point.isActive) {
        if (socket.last_data &&
          socket.last_data.name &&
          socket.last_data.name !== 'Anonymous' &&
          geoDistance(point.coords, JSON.parse(socket.last_data.text).coords) < distance_treshold) {
          console.log('Is near of : ' + point.name + ' distance: ' + geoDistance(point.coords, JSON.parse(socket.last_data.text).coords));
          log_event({
            ts: timestamp.getTime(),
            date: timestamp.toJSON(),
            team_name: ((socket.store && socket.store.data) ? socket.store.data.name : undefined),
            team_id: ((socket.store && socket.store.data) ? socket.store.data.name_id : undefined),
            player_name: ((socket.last_data) ? JSON.parse(socket.last_data.text).player_name : undefined),
            code: msg,
            action: 'Is near of : ' + point.name,
            distance: geoDistance(point.coords, JSON.parse(socket.last_data.text).coords),
            coords: ((socket.last_data) ? JSON.parse(socket.last_data.text).coords : socket.last_data),
            socketID: socket.id
          });
          if (msg && point.ConfirmCode.indexOf(msg.trim().toLowerCase()) >= 0) {
            socket.get('name_id', function(err, name_id) {
              if (name_id !== 'Anonymous') {
                point.Team_id = name_id;
                point.isActive = false;
                point.Team = socket.last_data.name;
                log_event({
                  ts: timestamp.getTime(),
                  date: timestamp.toJSON(),
                  team_name: ((socket.store && socket.store.data) ? socket.store.data.name : undefined),
                  team_id: ((socket.store && socket.store.data) ? socket.store.data.name_id : undefined),
                  player_name: ((socket.last_data) ? JSON.parse(socket.last_data.text).player_name : undefined),
                  code: msg,
                  action: 'Got : ' + point.name,
                  distance: geoDistance(point.coords, JSON.parse(socket.last_data.text).coords),
                  coords: ((socket.last_data) ? JSON.parse(socket.last_data.text).coords : undefined),
                  socketID: socket.id
                });
              }
            });
            broadcastPoints(Points, sockets);
            broadcast_adm('adm_points', Points);
          }
        }
      }
    });
  });

});

function broadcastPoints(_points, _sockets) {
  _sockets.forEach(function(_socket) {
    sendPoints(_points, _socket);
  });

  if (!checkActivePoints(_points)) {
    broadcast('level_up', level_up_code);
  }
}

function sendPoints(_points, _socket) {
  _name_id = undefined;

  _socket.get('name_id', function(err, name_id) {
    _name_id = name_id
  });

  b = [];
  _points.forEach(function(elem) {
    c = cloneDeep(elem);
    if (_name_id && _name_id == c.Team_id && !c.isActive) {
      b.push(c);
    }
    else {
      c.ActivateCode = '';
      c.ConfirmCode = '';
      c.Team_id = '';
      b.push(c);
    }
  });

  _socket.emit('points', b);
}

function checkActivePoints(e) {
  result = false;
  e.forEach(function(el) {
    result = result || el.isActive;
    if (result) {
      return result
    };
  });
  return result;
}

function updateRoster() {
  async.map(
    sockets,
    function(socket, callback) {
      socket.get('name', function(err, name) {
        result = {};
        result.id = socket.id;
        if (socket.last_data) {
          result.last_data = socket.last_data.text;
        }
        if (!err) {
          result.name = name;
        }
        callback(err, result);
      });
    },
    function(err, names) {
      broadcast('roster', names);
      broadcast_adm('adm_sockets',sock_to_txt(sockets));
    }
  );
}

function broadcast(event, data) {
  sockets.forEach(function(socket) {
    socket.emit(event, data);
  });
}

function broadcast_adm(event, data) {
  sockets.forEach(function(socket) {
    if (socket.isAdmin) {
      socket.emit(event, data);
    }
  });
}

function log_event(event) {
  fs.appendFileSync(__dirname + '/data/events.log', JSON.stringify(event) + '\n');
}

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function() {
  var addr = server.address();
  console.log("Tree server listening at", addr.address + ":" + addr.port);
});

router.get('/reset-NOTforAplayers', function(req, res) {
  initPoints();
  broadcastPoints(Points, sockets);
  broadcast_adm('adm_points',Points);
  var body = (
    '<script>' +
    'ts = new Date(' + (new Date()).getTime() + ');' +
    'document.body = document.createElement(\'body\');' +
    'document.body.innerHTML = (new Date(ts)).toLocaleDateString() + \' \' + ' +
    '(new Date(ts)).toLocaleTimeString() + \'.\' + ' +
    '(new Date(ts)).getMilliseconds() + ' +
    '\' Reset - OK\'' +
    '</script>');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Length', body.length);
  res.end(body);
});

router.get('/log-NOTforAplayers-JSON', function(req, res) {
  var file = fs.readFileSync(__dirname + '/data/events.log', 'utf8');
  log = file.split('\n');
  a = [];
  log.forEach(function(e) {
    if (e !== '') {
      a.push(JSON.parse(e));
    }
  });
  var body = JSON.stringify(a);
  res.setHeader('Content-Type', 'text/html');
  res.end(body);
});

router.get('/vars-NOTforAplayers-JSON', function(req, res) {

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Charset', 'utf-8');
  var body = {
    distance_treshold: distance_treshold,
    level_up_code: level_up_code,
    Points: Points,
    sockets_length: sockets.length,
    sockets: sock_to_txt(sockets)
  };

  res.end(JSON.stringify(body));
});

function sock_to_txt(s___) {
  r__ = [];
  s___.forEach(function(d_) {
    if (d_.last_data) {
      d_coords = JSON.parse(d_.last_data.text).coords;
    }
    r__.push({
      name: ((d_.store && d_.store.data) ? d_.store.data.name : undefined),
      name_id: ((d_.store && d_.store.data) ? d_.store.data.name_id : undefined),
      player_name: ((d_.last_data) ? JSON.parse(d_.last_data.text).player_name : undefined),
      id: d_.id,
      coords: ((d_.last_data) ? JSON.parse(d_.last_data.text).coords : undefined),
      handshaken: ((d_.manager && d_.manager.handshaken) ? d_.manager.handshaken : undefined)
    });
  });
  return r__;
}
