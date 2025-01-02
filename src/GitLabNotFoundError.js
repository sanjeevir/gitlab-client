const { GitLabAPIError } = require("./GitLabAPIError");

class GitLabNotFoundError extends GitLabAPIError {
  constructor(message, statusCode, responseBody, url) {
    super(message, statusCode, responseBody, url);
    this.name = "GitLabNotFoundError";
  }
}

exports.GitLabNotFoundError = GitLabNotFoundError;
