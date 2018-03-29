export default `
  directive @mongo(
    name: String!
  ) on FIELD_DEFINITION

  directive @link(
    field: String
    to: String
  ) on FIELD_DEFINITION

  directive @map(
    to: String
  ) on FIELD_DEFINITION
`;