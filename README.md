# Grapher and GraphQL Schema Directives

Wouldn't it be sweet if we could setup our role-based security in GraphQL type definitions?

Yes, it would be very sweet.

## Install

```
meteor add mattblackdev:roles-schema-directives
```

## Sample

Where you define your types:

```js
type Post {
  content: String
  history: [Post] @allow(roles: ["admin"])
}

type Mutation {
  addPost(content: String): ID @deny(groups: ['banned'])
}
```

In the background, the schema directives analyze our types and wrap the resolvers with the popular alanning:roles package. The wrapped resolver will check userIsInRole() with the roles and groups arguments provided to the directive.

## Usage

```js
import {
  directives, // the full map of the directives: { allow, deny }
  directiveDefinitions, // the definitions
  AllowDirective, // the actual directive classes
  DenyDirective,
} from 'meteor/mattblackdev:roles-schema-directives'

// Add them to your graphql servers
```

This is currently designed to work with the `cultofcoders:apollo` package, and you can add the directives to the initilization like this:

```js
import { initialize } from 'meteor/cultofcoders:apollo'
import { directives as rolesDirectives } from 'meteor/mattblackdev:roles-schema-directives'

Meteor.startup(() => {
  initialize({
    GRAPHQL_SCHEMA_DIRECTIVES: {
      ...rolesDirectives,
    },
  })
})
```
