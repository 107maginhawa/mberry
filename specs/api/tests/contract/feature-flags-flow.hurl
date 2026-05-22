# Public feature flags endpoint. No auth required.

GET {{api}}/feature-flags/feature-flags
HTTP 200
[Asserts]
jsonpath "$" isCollection
