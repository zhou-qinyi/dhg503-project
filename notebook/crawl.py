import aiohttp
import asyncio
from lxml import html
import re
import json
import random
from tqdm.asyncio import tqdm_asyncio

# Define a list of user agents for random selection
user_agents = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
]


async def get_random_headers():
    return {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://sillok.history.go.kr",
        "Pragma": "no-cache",
        "Referer": "https://sillok.history.go.kr/mc/inspectionMonthList.do",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": random.choice(user_agents),
        "sec-ch-ua": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
    }


async def fetch_month_ids(session, semaphore, king_id):
    async with semaphore:
        try:
            headers = await get_random_headers()
            data = {"id": king_id}
            url = (
                "https://sillok.history.go.kr/mc/inspectionMonthList.do"
                if king_id[0] == "m"
                else "https://sillok.history.go.kr/mc/inspectionMonthList.do?treeType=C"
            )
            async with session.post(url, headers=headers, data=data) as response:
                text = await response.text()
                month_url = html.fromstring(text).xpath(
                    '//*[@id="cont_area"]/div/div[2]/ul[2]/li/ul/li/a/@href'
                )
                month_id = [
                    re.search(r"([m,q]silok_.*?)'", month).group(1)
                    for month in month_url
                ]
                month_name = [
                    re.search(r"(\d{4}년 .*월?)'", month).group(1)
                    for month in month_url
                ]
                return list(zip(month_id, month_name))
        except Exception as e:
            print(f"Failed to fetch month IDs for {king_id}: {e}")
            return []


async def fetch_day_ids(session, semaphore, month_id):
    async with semaphore:
        try:
            headers = await get_random_headers()
            data = {"id": month_id[0], "dateInfo": month_id[1]}
            url = (
                "https://sillok.history.go.kr/mc/inspectionDayList.do?treeType=M"
                if month_id[0][0] == "m"
                else "https://sillok.history.go.kr/mc/inspectionDayList.do?treeType=C"
            )
            async with session.post(url, headers=headers, data=data) as response:
                text = await response.text()
                days = html.fromstring(text).xpath(
                    '//*[@id="cont_area"]/div/div[1]/div/span[2]/ul/li/a/@href'
                )
                day_ids = [
                    re.search(r"([m,q]silok_.*?)'", day).group(1) for day in days
                ]
                date_info = [re.findall(r"'([^']*)'", day)[-1] for day in days]
                return list(zip(day_ids, date_info))
        except Exception as e:
            print(f"Failed to fetch day IDs for {month_id}: {e}")
            return []


async def fetch_article_ids(session, semaphore, day_id):
    async with semaphore:
        try:
            headers = await get_random_headers()
            data = {"id": day_id[0], "dateInfo": day_id[1]}
            async with session.post(
                "https://sillok.history.go.kr/mc/inspectionDayList.do",
                headers=headers,
                data=data,
            ) as response:
                text = await response.text()
                articles = html.fromstring(text).xpath(
                    "//*[@id='cont_area']/div/div[3]/div/div[1]/ul/li/a/@id"
                )
                return [str(a) for a in articles]
        except Exception as e:
            print(f"Failed to fetch article IDs for {day_id}: {e}")
            return []


async def main():
    semaphore = asyncio.Semaphore(30)
    async with aiohttp.ClientSession() as session:
        # Create king IDs for the two types
        mking_ids = [f"msilok_{i:03d}" for i in range(1, 16)]
        qking_ids = [f"qsilok_{i:03d}" for i in range(1, 14)]
        king_ids = mking_ids + qking_ids

        # Fetch month IDs
        month_tasks = [
            fetch_month_ids(session, semaphore, king_id) for king_id in king_ids
        ]
        month_ids = []
        for result in await tqdm_asyncio.gather(
            *month_tasks, desc="Fetching month IDs"
        ):
            month_ids.extend(result)

        # Fetch day IDs
        day_tasks = [
            fetch_day_ids(session, semaphore, month_id) for month_id in month_ids
        ]
        day_ids = []
        for result in await tqdm_asyncio.gather(*day_tasks, desc="Fetching day IDs"):
            day_ids.extend(result)

        # Fetch article IDs
        article_tasks = [
            fetch_article_ids(session, semaphore, day_id) for day_id in day_ids
        ]
        article_ids = []
        for result in await tqdm_asyncio.gather(
            *article_tasks, desc="Fetching article IDs"
        ):
            article_ids.extend(result)

        # Save results
        with open("results.json", "w", encoding="utf-8") as f:
            json.dump(article_ids, f, ensure_ascii=False, indent=4)


if __name__ == "__main__":
    asyncio.run(main())
    print("Scraping complete. Results saved to results.json")
