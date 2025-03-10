from urllib.parse import urljoin
from src.crawler.utils.files import save_json
from src.crawler.utils.url import construct_url
from tqdm import tqdm
from src.crawler.spiders.BaseCrawler import BaseCrawler
from lxml import html


class UrlExtractor(BaseCrawler):
    def __init__(
        self,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.kwargs = kwargs
        self.targets = kwargs.get("targets")

    def fetch_page(self, url):
        """Override fetch_page to trace what's happening with the response."""
        response = super().fetch_page(url)
        self.logger.debug(f"fetch_page returned type: {type(response)}")
        if response is not None:
            self.logger.debug(f"Response is of type: {type(response)}")
            # This is the key issue - we're returning a string but somewhere code expects an object with .text
            # Add detailed logging to help pinpoint the issue
            if hasattr(response, "text"):
                self.logger.debug("Response has 'text' attribute")
            else:
                self.logger.debug("Response does NOT have 'text' attribute")
        return response

    def crawl(self):

        initial_target = self.targets[0]
        initial_url = construct_url(
            initial_target["url"], initial_target.get("params", {})
        )
        current_urls = [{"url": initial_url, "text": "", "path": ""}]
        last_level_urls = []

        result_urls = []

        # Process each depth level
        for depth, target in enumerate(
            tqdm(self.targets, desc="Crawling depth levels")
        ):
            self.logger.info(f"Processing depth {depth+1}/{len(self.targets)}")
            next_urls = self.process_depth(
                current_urls, target["xpath"], depth, target.get("params", {})
            )

            # Store URLs found at this depth level
            last_level_urls = [
                {"url": url["url"], "path": url["path"], "depth": depth}
                for url in next_urls
            ]

            # Set up for the next depth
            current_urls = next_urls
            self.logger.info(f"Found {len(current_urls)} URLs to process at next depth")
            for url in current_urls:
                result_urls.append(
                    {
                        "depth": depth,
                        "url": url["url"],
                        "path": url["path"],
                    }
                )
            # If this is the last depth or no URLs were found, we're done
            if depth == len(self.targets) - 1 or not next_urls:
                break

        save_json(
            result_urls,
            self.kwargs.get("output_dir"),
            self.kwargs.get("source_name"),
            filename=None,
        )

        return last_level_urls

    def process_depth(self, current_urls, xpath, depth, params):
        next_urls = []

        # Process all URLs at the current depth
        for url_data in tqdm(
            current_urls, desc=f"Processing URLs at depth {depth+1}", leave=False
        ):

            try:
                extracted_elements = self.extract_url_elements(url_data["url"], xpath)

                for element in extracted_elements:

                    # Convert relative URLs to absolute
                    joined_url = urljoin(url_data["url"], element["url"])
                    full_url = construct_url(joined_url, params)

                    current_text = element["text"]

                    # Build the navigation path
                    new_path = self.build_path(url_data["path"], current_text)

                    # Add to next_urls if not a duplicate
                    if not any(item["url"] == full_url for item in next_urls):
                        next_urls.append(
                            {"url": full_url, "text": current_text, "path": new_path}
                        )
            except Exception as e:

                self.logger.error(f"Error processing {url_data['url']}: {e}")

        return next_urls

    def extract_url_elements(self, url, xpath):
        try:
            # Get the HTML content as a string
            html_content = self.fetch_page(url)

            if html_content is None:
                self.logger.error(f"Failed to fetch {url}")
                return []

            # Ensure html_content is a string
            if not isinstance(html_content, str):
                raise TypeError(
                    f"Expected string from fetch_page but got {type(html_content)}"
                )

            # Parse the HTML
            page = html.fromstring(html_content)

            # Create a more inclusive XPath that finds text in descendants
            # If the original XPath contains "text()", replace it to search in descendants
            if "text()" in xpath:
                # This is a more inclusive XPath that searches in all descendant text nodes
                improved_xpath = xpath.replace(
                    "contains(text(), 'China')", "contains(., 'China')"
                )
                elements = page.xpath(improved_xpath)
                self.logger.info(f"Using improved XPath: '{improved_xpath}'")
                self.logger.info(f"Found {len(elements)} elements")
            else:
                elements = page.xpath(xpath)
                self.logger.info(f"Using original XPath: '{xpath}'")
                self.logger.info(f"Found {len(elements)} elements")

            # Extract the needed information from each element
            result = []
            for element in elements:
                try:
                    url_attr = element.get("href")
                    if not url_attr:  # Skip elements without href
                        continue

                    text_content = element.text_content().strip("\t\r\n")

                    # Skip empty links or fragments
                    if not url_attr or url_attr.startswith("#"):
                        continue

                    result.append({"url": url_attr, "text": text_content})
                except Exception as e:
                    self.logger.error(f"Error extracting element data: {e}")

            self.logger.info(f"Returning {len(result)} valid elements with links")
            return result
        except Exception as e:
            self.logger.error(f"Error in extract_url_elements for {url}: {e}")
            import traceback

            self.logger.error(traceback.format_exc())
            return []

    def build_path(self, parent_path, current_text):

        if parent_path:
            return f"{parent_path}/{current_text}"
        return current_text
