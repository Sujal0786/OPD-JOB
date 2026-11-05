package com.citycare.platform.common.exception;

import com.citycare.platform.common.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException ex) {
        log.warn("Business rule violation: [{}] {}", ex.getErrorCode(), ex.getMessage());
        return ResponseEntity.status(ex.getStatus())
                .body(ApiResponse.error(ex.getErrorCode(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationException(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        log.warn("Validation error: {}", errors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("VALIDATION_FAILED", "Invalid request parameters.", errors));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadCredentials(BadCredentialsException ex) {
        log.warn("Authentication failed: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("INVALID_CREDENTIALS", "Invalid email or password."));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("ACCESS_DENIED", "You do not have permission to access this resource."));
    }

    @ExceptionHandler(AsyncRequestTimeoutException.class)
    public ResponseEntity<Void> handleAsyncRequestTimeout() {
        // Normal lifecycle event when SSE client disconnects or reaches inactivity timeout
        return ResponseEntity.noContent().build();
    }

    // Fix C: Protect GlobalExceptionHandler from writing JSON after SSE failure
    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public void handleAsyncRequestNotUsableException(AsyncRequestNotUsableException ex, HttpServletRequest request) {
        // SSE or async client closed connection or response is no longer usable.
        // Do NOT attempt to write JSON to avoid secondary Broken Pipe errors.
        log.debug("Async request no longer usable for URI [{}]: {}",
                request != null ? request.getRequestURI() : "unknown", ex.getMessage());
    }

    // Fix C: Protect against broken pipes during SSE without globally suppressing genuine I/O errors
    @ExceptionHandler(IOException.class)
    public ResponseEntity<ApiResponse<Void>> handleIOException(IOException ex, HttpServletRequest request) {
        if (isClientDisconnect(ex, request)) {
            // Client closed connection during SSE stream or response transmission
            log.debug("Client disconnected prematurely for URI [{}]: {}",
                    request != null ? request.getRequestURI() : "unknown", ex.getMessage());
            return null; // Return null so Spring MVC does not attempt to write JSON to a closed socket
        }

        // Genuine I/O error - log and return 500 error response
        log.error("I/O error processing request for URI [{}]: ",
                request != null ? request.getRequestURI() : "unknown", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("IO_ERROR", "An internal I/O error occurred."));
    }

    // Fix C: Protect when an SSE emitter is already completed
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalStateException(IllegalStateException ex, HttpServletRequest request) {
        if (isSseEmitterCompleted(ex, request)) {
            // Emitter was already completed when an event or callback occurred
            log.debug("SSE emitter already completed for URI [{}]: {}",
                    request != null ? request.getRequestURI() : "unknown", ex.getMessage());
            return null; // Do not attempt to write JSON to closed SSE stream
        }

        log.error("Illegal state processing request for URI [{}]: ",
                request != null ? request.getRequestURI() : "unknown", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("ILLEGAL_STATE", "An internal state error occurred."));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String paramName = ex.getName();
        String message = String.format("Invalid format for parameter '%s'.", paramName);
        log.warn("Parameter type mismatch: {} = '{}'", paramName, ex.getValue());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("INVALID_PARAMETER", message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneralException(Exception ex) {
        log.error("Unhandled internal server error: ", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("INTERNAL_SERVER_ERROR", "An unexpected error occurred. Please contact support."));
    }

    private boolean isClientDisconnect(Throwable ex, HttpServletRequest request) {
        if (request != null) {
            String uri = request.getRequestURI();
            String accept = request.getHeader("Accept");
            boolean isSse = (uri != null && uri.contains("/stream")) ||
                            (accept != null && accept.contains("text/event-stream"));
            if (isSse) {
                return true;
            }
        }
        return isClientDisconnectCause(ex);
    }

    private boolean isClientDisconnectCause(Throwable ex) {
        if (ex == null) return false;
        String name = ex.getClass().getName();
        String msg = ex.getMessage();
        if (name.contains("ClientAbortException")) {
            return true;
        }
        if (msg != null) {
            String lower = msg.toLowerCase();
            if (lower.contains("broken pipe") ||
                lower.contains("connection reset") ||
                lower.contains("connection abort") ||
                lower.contains("an established connection was aborted")) {
                return true;
            }
        }
        return isClientDisconnectCause(ex.getCause());
    }

    private boolean isSseEmitterCompleted(IllegalStateException ex, HttpServletRequest request) {
        if (request != null) {
            String uri = request.getRequestURI();
            String accept = request.getHeader("Accept");
            boolean isSse = (uri != null && uri.contains("/stream")) ||
                            (accept != null && accept.contains("text/event-stream"));
            if (isSse) {
                return true;
            }
        }
        String msg = ex.getMessage();
        if (msg != null) {
            String lower = msg.toLowerCase();
            return lower.contains("already completed") ||
                   lower.contains("already committed") ||
                   lower.contains("responsebodyemitter");
        }
        return false;
    }
}
