var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var url = require('url');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  name: 'server-session-shortly',
  secret: 'secret_thing',
  saveUninitialized: true,
  resave: true
}));

var authenticate = function(req, res, next) {

  if (req.session.isAuth) {
    console.log('PASSED AUTH');
    next();
  } else {
    console.log('FAILED AUTH');
    res.redirect('/login');
  }
};

app.get('/', authenticate, function(req, res) {
  console.log('get /');
  res.render('index');
});

var userCheck = function(user, callback) {
  var check = false;

  db.knex('users')
    .where('username', '=', user.username)
    .andWhere('password', '=', user.password)
    .then(function(dbRes) {
      if (dbRes && dbRes.length > 0) {
        if (user.username === dbRes[0].username) {
          console.log('user check is true');
          check = true;
        }
      }

      callback(check);
    }).catch(function(err) {
      throw {
        type: 'DatabaseError',
        message: 'Failed to get user and password'
      };
    });
};

app.get('/create', 
function(req, res) {
  console.log('GET /create');
  if (!req.session.user) {
    return res.redirect('/login');
  }

  res.render('index');
});

app.get('/links',
function(req, res) {
  console.log('getT /links');
  // if (!req.session.user) {
  //   return res.redirect('/login');
  // }

  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', 
function(req, res) {
  console.log('POST /links');
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    } 
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/login', function(req, res) {
  console.log('GET /login');
  res.render('login');
});

app.post('/login', function(req, res) {
  console.log('POST /login');
  // check db for user
  req.session.user = {
    username: req.body.username,
    password: req.body.password
  };

  userCheck(req.session.user, function(passed) {
    req.session.isAuth = passed;
    console.log('isAuth after userCheck', req.session.isAuth);
    if (req.session.isAuth) {
      res.redirect('/');
    } else {
      res.redirect('/login');
    }
  });
});

app.get('/signup', function(req, res) {
  console.log('GET /signup');
  res.render('signup');
});

app.post('/signup', function(req, res) {
  console.log('POST /signup');
  new User({
    'username': req.body.username,
    'password': req.body.password
  }).save()
  .then(function(model) {
    console.log('res ending after then');
    // res.setHeader('Location', '/index');
    res.redirect('/login');
  });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  console.log(req.url);
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    

    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
