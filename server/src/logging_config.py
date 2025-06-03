# ABOUTME: Centralized logging configuration for structured logging
# ABOUTME: Sets up JSON-formatted logs with request context and structured fields

import logging
import logging.config
import json
import sys
from typing import Dict, Any
from datetime import datetime, timezone


class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs structured JSON logs.

    Includes timestamp, level, logger name, message, and any extra fields.
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON."""
        # Base log entry
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Add any extra fields from the log call
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in {
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
                "message",
                "exc_info",
                "exc_text",
                "stack_info",
                "getMessage",
            }:
                extra_fields[key] = value

        if extra_fields:
            log_entry["extra"] = extra_fields

        return json.dumps(log_entry, default=str)


def setup_logging(log_level: str = "INFO", structured: bool = True) -> None:
    """
    Set up application logging.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        structured: Whether to use structured JSON logging
    """
    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "structured": {
                "()": StructuredFormatter,
            },
            "simple": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": log_level,
                "formatter": "structured" if structured else "simple",
                "stream": sys.stdout,
            },
        },
        "loggers": {
            # Application loggers
            "src": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False,
            },
            # FastAPI loggers
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
            "uvicorn.access": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
            # SQLAlchemy loggers (reduce verbosity)
            "sqlalchemy.engine": {
                "level": "WARNING",
                "handlers": ["console"],
                "propagate": False,
            },
            "sqlalchemy.pool": {
                "level": "WARNING",
                "handlers": ["console"],
                "propagate": False,
            },
        },
        "root": {
            "level": log_level,
            "handlers": ["console"],
        },
    }

    logging.config.dictConfig(config)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with structured logging support.

    Args:
        name: Logger name (usually __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


def log_request_start(
    logger: logging.Logger,
    method: str,
    path: str,
    user_agent: str = None,
    api_key_id: str = None,
) -> None:
    """
    Log the start of a request with structured context.

    Args:
        logger: Logger instance
        method: HTTP method
        path: Request path
        user_agent: User agent string
        api_key_id: API key identifier (masked)
    """
    logger.info(
        "Request started",
        extra={
            "event_type": "request_start",
            "http_method": method,
            "request_path": path,
            "user_agent": user_agent,
            "api_key_id": api_key_id,
        },
    )


def log_request_end(
    logger: logging.Logger,
    method: str,
    path: str,
    status_code: int,
    response_time_ms: float,
    api_key_id: str = None,
) -> None:
    """
    Log the end of a request with performance metrics.

    Args:
        logger: Logger instance
        method: HTTP method
        path: Request path
        status_code: HTTP response status code
        response_time_ms: Response time in milliseconds
        api_key_id: API key identifier (masked)
    """
    log_level = logging.INFO if status_code < 400 else logging.WARNING

    logger.log(
        log_level,
        "Request completed",
        extra={
            "event_type": "request_end",
            "http_method": method,
            "request_path": path,
            "status_code": status_code,
            "response_time_ms": round(response_time_ms, 2),
            "api_key_id": api_key_id,
        },
    )


def mask_api_key(api_key: str) -> str:
    """
    Mask API key for logging (show first 4 and last 4 characters).

    Args:
        api_key: Full API key

    Returns:
        Masked API key string
    """
    if not api_key or len(api_key) < 8:
        return "****"

    return f"{api_key[:4]}...{api_key[-4:]}"
