import sys
import os
import json
import logging
from pathlib import Path

from src.utils.logging import setup_logging
from src.utils.config import load_config
from src.crawler.utils.files import save_json

# Import the classes directly from their respective modules
from src.crawler.spiders.BaseCrawler import BaseCrawler
from src.crawler.spiders.UrlExtractor import UrlExtractor
from src.crawler.spiders.ImageExtractor import ImageExtractor
from src.crawler.spiders.TextExtractor import TextExtractor
from src.crawler.spiders.HTMLCrawler import HTMLCrawler


def main():
    # Setup logging

    # Map of crawler names to their class objects
    crawler_class_map = {
        "base_crawler": BaseCrawler,
        "url_extractor": UrlExtractor,
        "image_extractor": ImageExtractor,
        "text_extractor": TextExtractor,
        "html_crawler": HTMLCrawler,
    }

    try:

        config = load_config()
        crawler_config = config.get("crawler", {})

        if not crawler_config:
            raise ValueError("No crawler configuration found in config.yaml")

        for crawler_class_name, crawler_class_config in crawler_config.items():
            # Get the correct crawler class from the map
            crawler_class = crawler_class_map.get(crawler_class_name)

            if not crawler_class:
                raise ValueError(f"Unknown crawler class: {crawler_class_name}")
            logger = setup_logging(
                module_name=f"crawler.{crawler_class_name}", num_log_files=5
            )
            logger.info(f"Starting {crawler_class_name} script")
            logger.info(f"Running crawler: {crawler_class_name}")

            sources = crawler_class_config.get("sources", {})
            if not sources:
                logger.error("No sources defined in crawler configuration")
                sys.exit(1)

            for source_name, source_config in sources.items():
                logger.info(f"Running {crawler_class_name} on {source_name}")

                # Get required parameters
                base_url = source_config.get("base_url")
                if not base_url:
                    logger.error(f"No Base URL defined for source: {source_name}")
                    sys.exit(1)

                targets = source_config.get("targets", [])
                source_config["source_name"] = source_name

                if not targets:
                    logger.error(f"No targets defined for source: {source_name}")
                    sys.exit(1)

                # Set URL for targets if not specified
                for target in targets:
                    if "url" not in target:
                        target["url"] = base_url

                # Set up output directory
                output_dir = source_config.get("output_dir", "data/raw")
                os.makedirs(output_dir, exist_ok=True)

                try:

                    crawler = crawler_class(
                        **source_config,
                    )
                    # Run the crawler and save the data
                    crawler.crawl()
                    logger.info(f"Completed crawling for source: {source_name}")

                except Exception as e:
                    logger.exception(f"Error with source {source_name}: {e}")
                    continue

            logger.info(f"Completed crawling for crawler: {crawler_class_name}")

    except Exception as e:
        logger.exception(f"Error running crawler script: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
