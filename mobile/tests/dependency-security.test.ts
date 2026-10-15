const { quote, parse } = require('shell-quote');

// GHSA-pqg4-j6r4-53mv: an argument after a shell comment must not introduce
// another shell line. Exercise the real resolved package without executing it.
test.each(['\n', '\r', '\u2028', '\u2029'])(
  'shell-quote rejects a line terminator %j after a comment',
  terminator => {
    expect(() => quote(['echo', 'ok', { comment: 'note' }, `value${terminator}unexpected-command;#`])).toThrow(TypeError);
  },
);

test('ordinary development-tool arguments still round-trip through quoting', () => {
  const args = ['node', '/tmp/Nail Lab/index.js', '--label', 'minimal & chrome'];
  expect(parse(quote(args))).toEqual(args);
});
