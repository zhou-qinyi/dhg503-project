from urllib.parse import urljoin
import os
import requests
from src.crawler.utils.files import save_json
from src.crawler.utils.url import construct_url
from tqdm import tqdm
from src.crawler.spiders.BaseCrawler import BaseCrawler
from lxml import html


class ImageExtractor(BaseCrawler):
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
        """Process each target and extract images."""
        results = []

        for depth, target in enumerate(
            tqdm(self.targets, desc="Processing image targets")
        ):
            self.logger.info(f"Processing target {depth+1}/{len(self.targets)}")

            input_url = target.get("url")
            xpath = target.get("xpath")

            if not input_url or not xpath:
                self.logger.error(f"Missing URL or XPath in target: {target}")
                continue

            try:
                images = self.extract_images(input_url, xpath)
                self.logger.info(f"Found {len(images)} images from {input_url}")

                # Save all images
                for img_data in images:
                    img_data["source_url"] = input_url
                    img_data["depth"] = depth
                    results.append(img_data)

                    # Download and save the image if requested
                    if target.get("save_images", True):
                        self.save_image(img_data)

            except Exception as e:
                self.logger.error(f"Error processing target {input_url}: {e}")

        return results

    def extract_images(self, url, xpath):
        """Extract images matching the XPath from the webpage."""
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
                f"Found {len(elements)} image elements with XPath '{xpath}'"
            )

            # Extract image information
            images = []
            for element in elements:
                try:
                    # For img elements
                    if element.tag == "img":
                        src = element.get("src")
                        alt = element.get("alt", "")
                    # For elements containing imgs
                    else:
                        img_elements = element.xpath(".//img")
                        if img_elements:
                            src = img_elements[0].get("src")
                            alt = img_elements[0].get("alt", "")
                        else:
                            continue

                    if not src:
                        continue

                    # Convert relative URLs to absolute
                    full_url = urljoin(url, src)

                    # Generate filename from URL
                    filename = os.path.basename(full_url.split("?")[0])
                    if not filename:
                        filename = f"image_{len(images)}.jpg"

                    images.append({"url": full_url, "alt": alt, "filename": filename})
                except Exception as e:
                    self.logger.error(f"Error extracting image data: {e}")

            return images
        except Exception as e:
            self.logger.error(f"Error in extract_images for {url}: {e}")
            import traceback

            self.logger.error(traceback.format_exc())
            return []

    def save_image(self, img_data):
        """Download and save the image."""
        try:
            output_dir = self.kwargs.get("output_dir")
            if not output_dir:
                self.logger.error("No output directory specified")
                return False

            os.makedirs(output_dir, exist_ok=True)

            img_url = img_data["url"]
            filename = img_data["filename"]
            output_path = os.path.join(output_dir, filename)

            # Check if file already exists
            if os.path.exists(output_path):
                self.logger.info(f"Image already exists: {output_path}")
                return True

            # Download the image
            response = self.session.get(img_url, stream=True)
            response.raise_for_status()

            # Save the image
            with open(output_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            self.logger.info(f"Saved image: {output_path}")
            return True
        except Exception as e:
            self.logger.error(f"Error saving image {img_data['url']}: {e}")
            return False
