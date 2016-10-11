var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');



var User = db.Model.extend({
  tableName: 'users',

  initialize: function() {
    this.on('creating', function(model, attrs, options) {
      model.set('username', model.attributes.username);
      model.set('password', model.attributes.password);
    });
  }
});

module.exports = User;