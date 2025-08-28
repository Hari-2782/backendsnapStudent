/**
 * Standardized API Response Helper
 * Ensures consistent response format across all endpoints
 */

class ApiResponse {
  static success(message = "Operation completed successfully", data = null) {
    return {
      status: "success",
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static error(message = "Operation failed", error = null, statusCode = 400) {
    return {
      status: "error",
      message,
      error: error?.message || error,
      statusCode,
      timestamp: new Date().toISOString()
    };
  }

  static notFound(message = "Resource not found") {
    return this.error(message, null, 404);
  }

  static unauthorized(message = "Unauthorized access") {
    return this.error(message, null, 401);
  }

  static serverError(message = "Internal server error", error = null) {
    return this.error(message, error, 500);
  }
}

module.exports = ApiResponse;
