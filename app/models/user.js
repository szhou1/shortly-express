var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');



var User = db.Model.extend({
  tableName: 'users',

  initialize: function() {
    console.log('initialize user model');
    this.on('creating', function(model, attrs, options) {
      console.log('creating user in DB');
      model.set('username', model.attributes.username);
      // model.set('password', model.attributes.password);
    });
  }

});

module.exports = User;