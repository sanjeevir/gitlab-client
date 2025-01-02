const { GitLabAPIError } = require("./GitLabAPIError");

class GitLabAuthenticationError extends GitLabAPIError {
  constructor(message, statusCode, responseBody, url) {
    super(message, statusCode, responseBody, url);
    this.name = "GitLabAuthenticationError";
  }
}
exports.GitLabAuthenticationError = GitLabAuthenticationError;
