import yaml
import logging
import json
import os
from jsonschema import validate, ValidationError


def load_yaml(file_path):
    with open(file_path, "r") as f:
        return yaml.safe_load(f)


def load_json_schema(schema_path):
    with open(schema_path, "r") as file:
        return json.load(file)


def validate_yaml(yaml_data, schema_data):
    try:
        validate(instance=yaml_data, schema=schema_data)
        return True
    except ValidationError as err:
        logging.error(f"YAML validation error: {err}")
        return False


def load_config(
    config_path="config.yaml", schema_path="config_schema.json", default_config=None
):
    """
    Load configuration from YAML file and validate it against a JSON schema.

    Args:
        config_path (str): Path to the configuration file.
        schema_path (str): Path to the JSON schema file for validation.
        default_config (dict): Default configuration to return if loading fails.

    Returns:
        dict: Configuration dictionary or default_config if loading/validation fails.
    """
    if default_config is None:
        default_config = {}

    # Check if files exist
    if not os.path.exists(config_path):
        logging.error(f"Configuration file not found: {config_path}")
        return default_config

    if not os.path.exists(schema_path):
        logging.error(f"Schema file not found: {schema_path}")
        return default_config

    # Load configuration and schema
    try:
        config_file = load_yaml(config_path)
        schema_file = load_json_schema(schema_path)
    except yaml.YAMLError as e:
        logging.error(f"Error parsing YAML configuration: {e}")
        return default_config
    except json.JSONDecodeError as e:
        logging.error(f"Error parsing JSON schema: {e}")
        return default_config
    except Exception as e:
        logging.error(f"Error loading configuration files: {e}")
        return default_config

    # Validate configuration
    if not validate_yaml(config_file, schema_file):
        logging.error(f"Configuration validation failed for {config_path}")
        return default_config

    return config_file
