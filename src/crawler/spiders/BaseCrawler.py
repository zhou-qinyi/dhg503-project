import logging
import requests
import random
import aiohttp
from aiohttp import ClientSession


class BaseCrawler:
    """
    Responsible for crawling websites. All requests should be handled here.
    This class does not contain logic for data extraction.
    """

    DEFAULT_USER_AGENTS = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:40.0) Gecko/20100101 Firefox/40.0",
        "Mozilla/5.0 (compatible, MSIE 11, Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko",
        "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.0 Safari/537.36",
    ]

    def __init__(self, **kwargs):
        self.base_url = kwargs.get("base_url")
        self.params = kwargs.get("params")
        self.output_dir = kwargs.get("output_dir")

        self.user_agent = kwargs.get("user_agent", self._get_random_user_agent())
        self.rate_limit = kwargs.get("rate_limit", 1)
        self.retries = kwargs.get("retries", 8)
        self.backoff_factor = kwargs.get("backoff_factor", 2)

        self.session = self._create_session()
        self._async_session = None

        self.logger = logging.getLogger(self.__class__.__name__)

    def _get_random_user_agent(self):
        """Returns a random User-Agent string."""
        return random.choice(self.DEFAULT_USER_AGENTS)

    def _create_session(self):
        """Creates a persistent requests session with a User-Agent."""
        session = requests.Session()
        session.headers.update({"User-Agent": self.user_agent})
        return session

    @property
    async def async_session(self):
        """Get or create an async session as needed within an async context."""
        if self._async_session is None or self._async_session.closed:
            self._async_session = ClientSession(headers={"User-Agent": self.user_agent})
        return self._async_session

    def refresh_user_agent(self):
        """Refreshes the User-Agent for all sessions."""
        self.user_agent = self._get_random_user_agent()
        self.session.headers.update({"User-Agent": self.user_agent})
        if self._async_session and not self._async_session.closed:
            self._async_session.headers.update({"User-Agent": self.user_agent})

    def fetch_page(self, url):
        """Fetch a page using the requests session."""
        try:
            response = self.session.get(url, headers={"User-Agent": self.user_agent})
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            self.logger.error(f"Failed to fetch {url}: {e}")
            return None

    async def fetch_page_async(self, url):
        """Fetch a page asynchronously using aiohttp."""
        session = await self.async_session
        try:
            async with session.get(url) as response:
                response.raise_for_status()
                return await response.text()
        except aiohttp.ClientError as e:
            self.logger.error(f"Failed to fetch {url} asynchronously: {e}")
            return None

    def crawl(self):
        """Placeholder for the crawl method."""
        pass

    async def close_async_session(self):
        """Close the async session if it exists."""
        if self._async_session and not self._async_session.closed:
            await self._async_session.close()
