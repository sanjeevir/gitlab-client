const { GitLabAPIError } = require("./GitLabAPIError");

class GitLabRateLimitError extends GitLabAPIError {
  constructor(message, statusCode, responseBody, url) {
    super(message, statusCode, responseBody, url);
    this.name = "GitLabRateLimitError";
  }
}

exports.GitLabRateLimitError = GitLabRateLimitError;
