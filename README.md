# Resolver-generating allow/deny Schema Directives

Wouldn't it be sweet if we could setup our role-based security in GraphQL type and field definitions?

Yes, it would be very sweet.

# Work In Progress

So far this is going swimmingly. Appologies to anyone who wants to try this out. Currently the way I'm developing this is by a using a modified the fork of the cult-of-coders:apollo package among others and its all a bit fresh. I'll update this as I go so give it a star and/or a watch to stay up to date.

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

Here's an example schema:

```
type Thing @deny(group: 'usersWithThingAllergies') {
  _id: ID!
  name: String!
  secret: String @allow(roles: ["admin"])
}

input ThingInput {
  name: String
  secret: String @allow(roles: ["admin"])
}

type Query {
  things: [Thing] @deny(roles: ["user"], group: 'banned')
}

type Mutation @deny(roles: ['noobs']) {
  addThing(input: ThingInput): Thing
  updateThing(id: ID!, input: ThingInput): Thing
}
```

Notice the locations of the directives:

1.  On a field inside a Type
2.  On a field inside an InputType
3.  On a field inside the Query Type
4.  On a Type

Each of these locations do different things.

### On a field inside a Type

Anytime this field makes its way into a query, if the permission fails, only that particular field will be null and an error added to the errors array in the response. This works even for mutations that return the field.

### On a field inside an InputType

For any Mutation that has this InputType as one of its args, its resolver will be wrapped with a permissions check. The wrapper will first check if the protected field is being passed and do the necessary permissions checking.

### On a field inside the Query Type

In this case, if the permissions fail the entire query will return null with an error.

### On a Type

This is getting redundant. You get the idea, right?
