var express = require('express');
var session = require('express-session');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
// var session = require('express-session');
var url = require('url');
var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;

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

app.use(session({secret: 'session secret'}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GitHubStrategy({
  clientID: '3fff66762b75a629c5c1',
  clientSecret: '77b5bc754e9e66598255eef091e98310f5635700',
  callbackURL: 'http://127.0.0.1:4568/auth/github/callback'
},
  function(accessToken, refreshToken, profile, done) {
    console.log('inside githubstrategy callback');
    // console.log('User', User);
    // console.log('profile', profile);
    new User({username: profile.username})
      .fetch()
      .then( function(model) {
        var user = model;
        if (user === null) {
          new User({
            username: profile.username
          }).save()
          .then(function(model2) {
            // console.log('AFTER CREATING NEW USER', model2.attributes);
            return done(null, model2.attributes);
          });

        } else {
          console.log(user.attributes);
          return done(null, user.attributes);
        }
      });

  }
));

passport.serializeUser(function(user, done) {
  console.log('serializeUser', user);
  done(null, user.username);
});

passport.deserializeUser(function(username, done) {
  console.log('deserializeUser', username);
  new User({username: username}).fetch().then( function(model) {
    // console.log('user', model.attributes);
    done(null, model.attributes.username);
  });
  // done();

});

var ensureAuthenticated = function(req, res, next) {
  console.log('ensureAuthenticated() req.user', req.user);
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/');
};

app.get('/protected', ensureAuthenticated, function(req, res) {
  console.log('GET /protected');
  res.render('index');
});

app.get('/auth/github', passport.authenticate('github'));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/'}), 
  function(req, res) {
    console.log('GET /auth/github/callback');
    res.redirect('/');
  });


app.get('/', 
  function(req, res) {
    console.log('get /');
    console.log('req.user', req.user);
    if (req.isAuthenticated()) {
      console.log('authenticated');
      res.render('index');
    } else {
      console.log('not authenticated');
      res.render('landing');
    }
  });


app.get('/logout', function(req, res) {
  console.log('inside LOGOUT');
  req.logout();
  res.render('landing');

});

app.get('/create', passport.authenticate('github'),
function(req, res) {
  console.log('GET /create');
  res.render('index');
});

app.get('/links',
  // passport.authenticate('github'),
function(req, res) {
  console.log('GET /links');

  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', 
  // passport.authenticate('github'), 
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
app.get('/login', function(req, res, next) {
  console.log('GET /login');
  res.redirect('/');
  // req.login(req.user, function(err) {
  //   if (err) {
  //     next(err);
  //   }
  //   res.render('login');
  // });

});

app.post('/login', 
  passport.authenticate('github'), 
  function(req, res) {
    console.log('POST /login');
    res.redirect('/');

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
