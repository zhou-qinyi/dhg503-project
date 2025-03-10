import asyncio
from tqdm import tqdm
from src.crawler.spiders.BaseCrawler import BaseCrawler
from src.crawler.utils.clean_html import clean_html
from src.crawler.utils.files import (
    load_json,
    get_filepath,
    save_html_async,
    get_resumable_urls,
)
from src.crawler.utils.url import get_clean_url


class HTMLCrawler(BaseCrawler):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.targets = kwargs.get("targets")
        self.concurrency_limit = kwargs.get("concurrency_limit", 20)
        self.semaphore = asyncio.Semaphore(self.concurrency_limit)

    def crawl(self):
        for target in self.targets:
            self.xpath = target.get("xpath")
            self.input_file = target.get("input_file")
            self.file_key = target.get("file_key")
            self.resumable = target.get("resumable", False)
            target_urls = load_json(self.input_file)
            max_depth = max([t.get("depth", 0) for t in target_urls])
            target_urls = [t for t in target_urls if t.get("depth", 0) == max_depth]
            if self.resumable:
                resumable_target_urls = get_resumable_urls(
                    [t["url"] for t in target_urls], self.file_key, self.output_dir
                )
                target_urls = [
                    t for t in target_urls if t["url"] in resumable_target_urls
                ]
            if not target_urls:
                self.logger.warning("No target_urls found in the input file.")
                continue
            return asyncio.run(self.crawl_async(target_urls))

    async def crawl_async(self, targets):
        results = []
        tasks = []

        try:
            progress = tqdm(total=len(targets), desc="Crawling")
            for target in targets:
                task = asyncio.create_task(self.process_target_async(target, progress))
                tasks.append(task)

            for completed_task in asyncio.as_completed(tasks):
                try:
                    result = await completed_task
                    if result:
                        results.append(result)
                except Exception as e:
                    self.logger.error(f"Error in async task: {str(e)}")
            progress.close()
            return results
        finally:
            await self.close_async_session()

    async def process_target_async(self, target, progress):
        async with self.semaphore:
            clean_url = get_clean_url(target["url"])
            try:
                html_text = await self.fetch_page_async(clean_url)
                html_content = clean_html(html_text, self.xpath)
                file_path = get_filepath(clean_url, self.file_key, self.output_dir)

                await save_html_async(
                    html_content, clean_url, self.file_key, self.output_dir
                )
                progress.update(1)
                return {
                    "url": clean_url,
                    "html": file_path,
                }

            except Exception as e:
                error_message = f"Error processing URL {clean_url}: {str(e)}"
                self.logger.error(error_message)

                progress.update(1)
                return None
