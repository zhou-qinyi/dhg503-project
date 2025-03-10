from pathlib import Path
import sys
import logging
import logging.handlers


def setup_logging(module_name="crawler", num_log_files=5):
    """
    Set up logging configuration.

    Args:
        module_name (str): Name of the module for the log directory and filename
        num_log_files (int): Maximum number of log files to keep
    """

    log_dir = Path("logs") / module_name
    log_dir.mkdir(parents=True, exist_ok=True)
    # Use a fixed filename without timestamp for proper rotation
    log_file = log_dir / f"{module_name}.log"

    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    logger = logging.getLogger(__name__)

    # Configure root logger
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # Add rotating file handler
    file_handler = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=1024 * 1024, backupCount=num_log_files
    )
    file_handler.setFormatter(logging.Formatter(log_format))
    logging.getLogger().addHandler(file_handler)

    logger.info(f"Starting {module_name} script")
    return logger
