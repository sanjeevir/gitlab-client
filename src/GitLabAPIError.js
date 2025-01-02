class GitLabAPIError extends Error {
  constructor(message, statusCode, responseBody, url) {
    super(message);
    this.name = "GitLabAPIError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.url = url;
  }
}

exports.GitLabAPIError = GitLabAPIError;
