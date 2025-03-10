from urllib.parse import urljoin
import os
import json
from tqdm import tqdm
from src.crawler.spiders.BaseCrawler import BaseCrawler
from src.crawler.utils.files import save_json
from lxml import html


class TextExtractor(BaseCrawler):
    def __init__(
        self,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.kwargs = kwargs
        self.targets = kwargs.get("targets")

    def crawl(self):
        """Process each target and extract text content."""
        results = []

        for depth, target in enumerate(
            tqdm(self.targets, desc="Processing text targets")
        ):
            self.logger.info(f"Processing target {depth+1}/{len(self.targets)}")

            input_url = target.get("url")
            xpath = target.get("xpath")

            if not input_url or not xpath:
                self.logger.error(f"Missing URL or XPath in target: {target}")
                continue

            try:
                text_items = self.extract_text(input_url, xpath)
                self.logger.info(f"Found {len(text_items)} text items from {input_url}")

                for text_item in text_items:
                    text_item["source_url"] = input_url
                    text_item["depth"] = depth
                    results.append(text_item)

            except Exception as e:
                self.logger.error(f"Error processing target {input_url}: {e}")

        # Save all extracted text
        save_json(
            results,
            self.kwargs.get("output_dir"),
            self.kwargs.get("source_name"),
            filename=self.kwargs.get("output_filename"),
        )

        return results

    def extract_text(self, url, xpath):
        """Extract text matching the XPath from the webpage."""
        try:
            # Get the HTML content
            html_content = self.fetch_page(url)

            if html_content is None:
                self.logger.error(f"Failed to fetch {url}")
                return []

            # Parse the HTML
            page = html.fromstring(html_content)
            elements = page.xpath(xpath)

            self.logger.info(
                f"Found {len(elements)} text elements with XPath '{xpath}'"
            )

            # Extract text information
            text_items = []
            for i, element in enumerate(elements):
                try:
                    # Get the text content
                    text_content = element.text_content().strip()
                    if not text_content:
                        continue

                    # Get element attributes as metadata
                    attributes = {k: v for k, v in element.attrib.items()}

                    # Create a unique ID for the text item
                    item_id = f"text_{i}_{hash(text_content) % 10000}"

                    text_items.append(
                        {
                            "id": item_id,
                            "text": text_content,
                            "attributes": attributes,
                            "element_type": element.tag,
                        }
                    )

                except Exception as e:
                    self.logger.error(f"Error extracting text data: {e}")

            return text_items
        except Exception as e:
            self.logger.error(f"Error in extract_text for {url}: {e}")
            import traceback

            self.logger.error(traceback.format_exc())
            return []
