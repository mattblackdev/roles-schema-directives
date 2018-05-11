import { SchemaDirectiveVisitor } from 'graphql-tools'
import { defaultFieldResolver } from 'graphql'
import { Roles } from 'meteor/alanning:roles'
import { Meteor } from 'meteor/meteor'

/* TODO: What to do about this? 🤔
  https://www.apollographql.com/docs/graphql-tools/schema-directives.html
  
  "One drawback of this approach is that it does not guarantee fields 
  will be wrapped if they are added to the schema after AuthDirective 
  is applied"
*/

const POLARITY = {
  ALLOW: 'allow',
  DENY: 'deny',
}

function throwNotAuthorized() {
  throw new Error('Not Authorized.')
}

function throwInvalidArgs(args) {
  throw new Error('Invalid arguments for allow/deny directives.')
}

class RolesDirective extends SchemaDirectiveVisitor {
  visitObject(objectType) {
    const { roles, group } = this.args
    if (!roles && !group) throwInvalidArgs({ roles, group })
    objectType[`_${this.name}`] = { roles, group }
    this.ensureFieldsWrapped(objectType)
  }
  // Visitor methods for nested types like fields and arguments
  // also receive a details object that provides information about
  // the parent and grandparent types.
  visitFieldDefinition(field, details) {
    const { roles, group } = this.args
    if (!roles && !group) throwInvalidArgs({ roles, group })
    field[`_${this.name}`] = { roles, group }
    this.ensureFieldsWrapped(details.objectType)
  }

  visitInputFieldDefinition(field, { objectType }) {
    /**
     * Basically the way this works is:
     * 1. For the given InputField on an InputType, find the mutations that use it
     * 2. Then store the field name and allow/deny directive info on the mutation field
     * 3. Wrap the mutation resolver with the permissions check
     *
     * Also, there are 2 optimizations at play:
     * 1. Only wrap the mutation resolver once
     * 2. Only check the unique set of permissions
     */
    const { roles, group } = this.args
    if (!roles && !group) throwInvalidArgs({ roles, group })

    const typeName = objectType.name
    const { schema } = this
    const PROTECTED_INPUTS_KEY = `_allowDenyInputs`
    const WRAPPED_KEY = `_allowDenyWrapped`

    // find mutations using this InputType
    const mutations = getMutationsWithArgType(schema, typeName)

    // store the directive meta on each mutation
    mutations.forEach(mutation => {
      mutation[PROTECTED_INPUTS_KEY] = this.mergeProtectedFields(
        mutation[PROTECTED_INPUTS_KEY],
        field.name,
        this.name,
        this.args
      )

      // Ensure mutaion resolver is only wrapped once
      if (mutation[WRAPPED_KEY]) return
      mutation[WRAPPED_KEY] = true

      const { resolve = defaultFieldResolver } = mutation
      mutation.resolve = (...args) => {
        // Get all protected fields in the input argument
        const { input } = args[1]
        const protectedFields = Object.keys(input).filter(inputKey => {
          return mutation[PROTECTED_INPUTS_KEY].hasOwnProperty(inputKey)
        })

        // If there aren't any, move along...
        if (!protectedFields.length) {
          return resolve.apply(this, args)
        }

        // make sure there is a user
        const context = args[2]
        const userId = context.userId
        if (!userId) throwNotAuthorized()

        // To avoid repeating the same permission checks we need only the unique permissions
        const permissionsToCheck = this.getUniquePermissionsToCheck(
          mutation[PROTECTED_INPUTS_KEY],
          protectedFields
        )

        // For each unique permission, check it
        const { allow, deny } = permissionsToCheck
        if (allow) {
          allow.forEach(({ roles, group }) => {
            // White list
            if (!Roles.userIsInRole(userId, roles, group)) {
              throwNotAuthorized()
            }
          })
        }
        if (deny) {
          deny.forEach(({ roles, group }) => {
            // Black list
            if (Roles.userIsInRole(userId, roles, group)) {
              throwNotAuthorized()
            }
          })
        }

        return resolve.apply(this, args)
      }
    })
  }

  /**
   * Returns a new object with the merged protected fields
   * @param {*} source Object to merge
   * @param {string} fieldName
   * @param {POLARITY} polarity
   * @param {*} args
   */
  mergeProtectedFields(source, fieldName, polarity, args) {
    // Considering these properties may or may not exist yet,
    // this is the structure we want:
    // mutation = {
    //   [STATE_KEY]: {
    //     secretField: {
    //       deny: {
    //         roles: ['user']
    //       }
    //     }
    //   }
    // }
    if (!source) {
      return { [fieldName]: { [polarity]: { ...args } } }
    } else {
      return {
        ...source,
        [fieldName]: {
          ...source[fieldName],
          [polarity]: { ...args },
        },
      }
    }
  }

  getUniquePermissionsToCheck(permissions, inputs) {
    const allowSet = new Set()
    const denySet = new Set()

    inputs.forEach(input => {
      const { allow, deny } = permissions[input]
      if (allow) allowSet.add(JSON.stringify(allow))
      if (deny) denySet.add(JSON.stringify(deny))
    })

    return {
      allow: allowSet.size ? [...allowSet].map(JSON.parse) : undefined,
      deny: denySet.size ? [...denySet].map(JSON.parse) : undefined,
    }
  }

  ensureFieldsWrapped(objectType) {
    const stateKey = `_${this.name}`
    const sentinelKey = `_${this.name}FieldsWrapped`
    // Mark the object to avoid re-wrapping:
    if (objectType[sentinelKey]) return
    objectType[sentinelKey] = true

    const fields = objectType.getFields()

    Object.keys(fields).forEach(fieldName => {
      const field = fields[fieldName]
      const { resolve = defaultFieldResolver } = field
      field.resolve = (...args) => {
        // Get the required role from the first match
        // field first, or then the object or finally undefined
        const { roles, group } = field[stateKey] || objectType[stateKey] || {}

        // if there's no auth just move along...
        if (!roles && !group) {
          return resolve.apply(this, args)
        }

        // make sure there is a user
        const context = args[2]
        const userId = context.userId
        if (!userId) throwNotAuthorized()

        const userIsInRole = Roles.userIsInRole(userId, roles, group)
        const notAuthorized =
          (this.name === POLARITY.DENY && userIsInRole) ||
          (this.name === POLARITY.ALLOW && !userIsInRole)

        if (notAuthorized) {
          throwNotAuthorized()
        }

        return resolve.apply(this, args)
      }
    })
  }
}

/**
 * Returns an array of mutations that have at least one argument of the given type
 * @param {GraphQLSchema} schema
 * @param {String} typeName
 */
function getMutationsWithArgType(schema, typeName) {
  return Object.values(schema.getMutationType().getFields()).filter(
    mutation => {
      return mutation.args.some(arg => {
        return arg.type.name === typeName
      })
    }
  )
}

export class AllowDirective extends RolesDirective {}
export class DenyDirective extends RolesDirective {}
export const directives = {
  [POLARITY.ALLOW]: AllowDirective,
  [POLARITY.DENY]: DenyDirective,
}
