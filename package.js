Package.describe({
  name: 'mattblackdev:roles-schema-directives',
  version: '0.1.0',

  // Brief, one-line summary of the package.
  summary: 'Roles and GraphQL Schema Directives',

  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/mattblackdev/roles-schema-directives',

  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md',
})

Package.onUse(function(api) {
  api.versionsFrom('METEOR@1.3')
  api.use('ecmascript')
  api.use('alanning:roles@1.2.16')
  api.mainModule('index.js', 'server')
})

Package.onTest(function(api) {})
