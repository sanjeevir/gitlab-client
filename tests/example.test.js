const exampleFunction = require('../src/index');

/**
 * Unit test for the exampleFunction.
 */
test('exampleFunction returns the correct string', () => {
  expect(exampleFunction()).toBe('Hello from GitLab Node Client!');
});
