module.exports = function viteEnvPlugin({ types: t }) {
  return {
    name: 'vite-env-for-jest',
    visitor: {
      MemberExpression(path) {
        const object = path.node.object
        const property = path.node.property

        if (
          t.isMemberExpression(object)
          && t.isMetaProperty(object.object)
          && object.object.meta.name === 'import'
          && object.object.property.name === 'meta'
          && t.isIdentifier(object.property, { name: 'env' })
          && t.isIdentifier(property)
        ) {
          path.replaceWith(
            t.memberExpression(
              t.memberExpression(t.identifier('process'), t.identifier('env')),
              t.identifier(property.name),
            ),
          )
        }
      },
    },
  }
}
