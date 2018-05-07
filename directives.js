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

  ensureFieldsWrapped(objectType) {
    // Mark the object to avoid re-wrapping:
    if (objectType[`${this.name}FieldsWrapped`]) return
    objectType[`${this.name}FieldsWrapped`] = true

    const fields = objectType.getFields()

    Object.keys(fields).forEach(fieldName => {
      const field = fields[fieldName]
      const { resolve = defaultFieldResolver } = field
      field.resolve = (...args) => {
        const context = args[2]
        const userId = context.userId
        if (!userId) throwNotAuthorized()

        // Get the required role from the field first, falling back
        // to the objectType if no role is required by the field:
        const { roles, group } =
          field[`_${this.name}`] || objectType[`_${this.name}`]

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

export class AllowDirective extends RolesDirective {}
export class DenyDirective extends RolesDirective {}
export const directives = {
  [POLARITY.ALLOW]: AllowDirective,
  [POLARITY.DENY]: DenyDirective,
}
