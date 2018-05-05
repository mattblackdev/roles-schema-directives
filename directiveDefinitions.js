export default `
  directive @allow(
    roles: [String]
    group: String
  ) on OBJECT | FIELD_DEFINITION
  directive @deny(
    roles: [String]
    group: String
  ) on OBJECT | FIELD_DEFINITION
`
